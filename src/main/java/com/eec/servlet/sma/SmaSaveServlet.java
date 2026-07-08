package com.eec.servlet.sma;

import com.eec.util.DatabaseUtil;
import com.eec.util.SmaCreateSupport;
import com.eec.util.SmaOutgoingStatusHelper;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.sql.Clob;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Сохранение правок исходящей SMAQ/SMAR.
 * POST /api/sma/save
 */
public class SmaSaveServlet extends HttpServlet {

    private static final String EDOC_VERSION = "1.0.0";
    private static final String EDOC_SMAR_INFO = "R.SM.SS.09.002";
    private static final String EDOC_SMAR_ABSENT = "R.006";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String body = SmaServletUtil.readBody(request);
        String guid = SmaServletUtil.jsonStringField(body, "guid");
        SmaCardKind kind = SmaServletUtil.parseKindFromJson(body);
        String idStr = SmaServletUtil.jsonStringField(body, "id");
        if (guid == null || guid.isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid в теле запроса");
            return;
        }
        if (kind == null) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите kind: smaq или smar");
            return;
        }
        if (idStr == null || idStr.isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите id в теле запроса");
            return;
        }
        long cardId = Long.parseLong(idStr.trim());
        String smaXmlB64 = SmaServletUtil.jsonStringField(body, "smaXmlB64");
        String responseKind = SmaServletUtil.jsonStringField(body, "responseKind");

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            SmaCreateSupport.GateResult gate = kind == SmaCardKind.SMAQ
                    ? SmaCreateSupport.evaluateSmaqEditGate(conn, cardId, guid)
                    : SmaCreateSupport.evaluateSmarEditGate(conn, cardId, guid);
            if (!gate.allowed) {
                sendErr(response, HttpServletResponse.SC_FORBIDDEN,
                        gate.reason != null ? gate.reason : "Сохранение карты недоступно");
                return;
            }
            Integer userId = SmaServletUtil.getUserIdFromRightsByGuid(guid);
            if (userId == null) {
                sendErr(response, HttpServletResponse.SC_BAD_REQUEST,
                        "В карте прав доступа укажите атрибут userId (для записи истории статусов)");
                return;
            }

            String sqlCurrent = kind == SmaCardKind.SMAQ
                    ? "SELECT d.SMAQSTATUSID, TRIM(UPPER(NVL(st.SMAQSTATUSCODE, ''))) AS STCODE "
                    + "FROM SMAQ d LEFT JOIN SMAQSTATUS st ON st.SMAQSTATUSID = d.SMAQSTATUSID WHERE d.SMAQID = ?"
                    : "SELECT d.SMARSTATUSID, TRIM(UPPER(NVL(st.SMARSTATUSCODE, ''))) AS STCODE "
                    + "FROM SMAR d LEFT JOIN SMARSTATUS st ON st.SMARSTATUSID = d.SMARSTATUSID WHERE d.SMARID = ?";

            int currentStatusId;
            String currentStatusCode;
            try (PreparedStatement ps = conn.prepareStatement(sqlCurrent)) {
                ps.setLong(1, cardId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        sendErr(response, HttpServletResponse.SC_NOT_FOUND, "Карта не найдена");
                        return;
                    }
                    currentStatusId = rs.getInt(1);
                    currentStatusCode = rs.getString("STCODE");
                    if (currentStatusCode == null) {
                        currentStatusCode = "";
                    }
                }
            }

            Integer newStatusIdResolved = SmaOutgoingStatusHelper.resolveOutgoingStatusId(conn, kind, "NEW");
            if (newStatusIdResolved == null) {
                sendErr(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "В справочнике не найден активный статус NEW для исходящих (DATASOURCEKINDCODE=2)");
                return;
            }

            boolean fromFailedOrError = "FAILED".equals(currentStatusCode) || "ERROR".equals(currentStatusCode);
            int newStatusId = fromFailedOrError ? newStatusIdResolved : currentStatusId;

            String xmlOld = readXmlBody(conn, kind, cardId);
            if (xmlOld == null) {
                sendErr(response, HttpServletResponse.SC_NOT_FOUND, "XML карты не найден");
                return;
            }
            if (smaXmlB64 == null || smaXmlB64.trim().isEmpty()) {
                sendErr(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Укажите smaXmlB64: полный XML карты (UTF-8) в кодировке Base64");
                return;
            }
            String xmlNew;
            try {
                xmlNew = new String(Base64.getDecoder().decode(smaXmlB64.trim()), StandardCharsets.UTF_8);
            } catch (IllegalArgumentException e) {
                sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный Base64 в smaXmlB64");
                return;
            }
            if (xmlNew.trim().isEmpty() || !SmaServletUtil.isValidSmaXmlBody(xmlNew)) {
                sendErr(response, HttpServletResponse.SC_BAD_REQUEST,
                        "В smaXmlB64 ожидается полный XML документа (корень AdditionalInfoDetails или ProcessingResultDetails)");
                return;
            }

            String edocCode = resolveEdocCode(kind, responseKind, xmlNew);

            conn.setAutoCommit(false);
            try {
                updateCard(conn, kind, cardId, newStatusId);
                updateXml(conn, kind, cardId, xmlNew, edocCode);
                if (newStatusId != currentStatusId) {
                    insertHist(conn, kind, cardId, newStatusId, userId);
                }
                conn.commit();
            } catch (Exception e) {
                conn.rollback();
                if (e instanceof SQLException) {
                    throw (SQLException) e;
                }
                throw new SQLException(e.getMessage(), e);
            } finally {
                conn.setAutoCommit(true);
            }

            PrintWriter out = response.getWriter();
            response.setStatus(HttpServletResponse.SC_OK);
            out.print("{\"ok\":true,\"statusId\":" + newStatusId + ",\"edocCode\":"
                    + SmaServletUtil.quote(edocCode) + "}");
            out.flush();
        } catch (SQLException e) {
            try {
                if (conn != null && !conn.getAutoCommit()) {
                    conn.rollback();
                }
            } catch (SQLException ignored) {
            }
            sendErr(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка сохранения: " + e.getMessage());
        } catch (NumberFormatException e) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный id");
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static String resolveEdocCode(SmaCardKind kind, String responseKind, String xmlNew) {
        if (kind != SmaCardKind.SMAR) {
            return "R.SM.SS.09.002";
        }
        if ("absent".equalsIgnoreCase(trim(responseKind))) {
            return EDOC_SMAR_ABSENT;
        }
        if ("info".equalsIgnoreCase(trim(responseKind))) {
            return EDOC_SMAR_INFO;
        }
        String fromXml = extractEdocCode(xmlNew);
        if (EDOC_SMAR_ABSENT.equals(fromXml)) {
            return EDOC_SMAR_ABSENT;
        }
        return EDOC_SMAR_INFO;
    }

    private static String extractEdocCode(String xml) {
        Matcher m = Pattern.compile("<csdo:EDocCode>([^<]+)</csdo:EDocCode>").matcher(xml);
        if (m.find()) {
            return m.group(1).trim();
        }
        return EDOC_SMAR_INFO;
    }

    private static void updateCard(Connection conn, SmaCardKind kind, long cardId, int statusId) throws SQLException {
        String sql = kind == SmaCardKind.SMAQ
                ? "UPDATE SMAQ SET MODIFICATIONDATETIME = SYSDATE, SMAQSTATUSID = ? WHERE SMAQID = ? "
                + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = '2'"
                : "UPDATE SMAR SET MODIFICATIONDATETIME = SYSDATE, SMARSTATUSID = ? WHERE SMARID = ? "
                + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = '2'";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, statusId);
            ps.setLong(2, cardId);
            int n = ps.executeUpdate();
            if (n != 1) {
                throw new SQLException("UPDATE: ожидалась одна строка, обновлено " + n);
            }
        }
    }

    private static void updateXml(Connection conn, SmaCardKind kind, long cardId, String xml, String edocCode)
            throws SQLException {
        if (kind == SmaCardKind.SMAQ) {
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE SMAQXML SET SMAQXMLBODY = ?, EDOCCODE = ?, EDOCVERSION = ? WHERE SMAQID = ?")) {
                ps.setString(1, xml);
                ps.setString(2, edocCode);
                ps.setString(3, EDOC_VERSION);
                ps.setLong(4, cardId);
                ps.executeUpdate();
                return;
            } catch (SQLException e) {
                if (!isMissingColumn(e)) {
                    throw e;
                }
            }
            try (PreparedStatement ps = conn.prepareStatement("UPDATE SMAQXML SET SMAQXMLBODY = ? WHERE SMAQID = ?")) {
                ps.setString(1, xml);
                ps.setLong(2, cardId);
                ps.executeUpdate();
            }
            return;
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE SMARXML SET SMARXMLBODY = ?, EDOCCODE = ?, EDOCVERSION = ? WHERE SMARID = ?")) {
            ps.setString(1, xml);
            ps.setString(2, edocCode);
            ps.setString(3, EDOC_VERSION);
            ps.setLong(4, cardId);
            ps.executeUpdate();
        } catch (SQLException e) {
            if (!isMissingColumn(e)) {
                throw e;
            }
            try (PreparedStatement ps = conn.prepareStatement("UPDATE SMARXML SET SMARXMLBODY = ? WHERE SMARID = ?")) {
                ps.setString(1, xml);
                ps.setLong(2, cardId);
                ps.executeUpdate();
            }
        }
    }

    private static void insertHist(Connection conn, SmaCardKind kind, long cardId, int statusId, int userId)
            throws SQLException {
        String sql = kind == SmaCardKind.SMAQ
                ? "INSERT INTO SMAQSTATUSHIST (SMAQID, SMAQSTATUSID, SMAQSTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, ?)"
                : "INSERT INTO SMARSTATUSHIST (SMARID, SMARSTATUSID, SMARSTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, ?)";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, cardId);
            ps.setInt(2, statusId);
            ps.setInt(3, userId);
            ps.executeUpdate();
        }
    }

    private static String readXmlBody(Connection conn, SmaCardKind kind, long cardId)
            throws SQLException, IOException {
        String sql = kind == SmaCardKind.SMAQ ? SmaDbSupport.SQL_SMAQ_XML : SmaDbSupport.SQL_SMAR_XML;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, cardId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                Clob clob = rs.getClob(1);
                if (clob == null) {
                    return null;
                }
                StringBuilder sb = new StringBuilder();
                try (Reader r = clob.getCharacterStream()) {
                    char[] buf = new char[8192];
                    int n;
                    while ((n = r.read(buf)) >= 0) {
                        sb.append(buf, 0, n);
                    }
                }
                return sb.toString();
            }
        }
    }

    private static boolean isMissingColumn(SQLException e) {
        String m = e.getMessage();
        return m != null && m.contains("ORA-00904");
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

    private static void sendErr(HttpServletResponse response, int status, String msg) throws IOException {
        response.setStatus(status);
        PrintWriter out = response.getWriter();
        out.print("{\"error\":" + SmaServletUtil.quote(msg) + "}");
        out.flush();
    }
}
