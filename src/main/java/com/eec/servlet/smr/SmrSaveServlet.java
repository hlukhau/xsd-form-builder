package com.eec.servlet.smr;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.DatabaseUtil;
import com.eec.util.SmrAuthorityDbSupport;
import com.eec.util.SmrCreateSupport;
import com.eec.util.SmrOutgoingStatusHelper;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.Reader;
import java.sql.Clob;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Сохранение правок исходящей SMR (одна транзакция): SMR (MODIFICATIONDATETIME; при FAILED/ERROR → NEW по справочнику), SMRXML, SMRSTATUSHIST.
 * POST /api/smr/save
 * Тело: guid, smrId, smrXmlB64 — полный XML карты SMR (UTF-8) в Base64 (корень doc:SanitaryMeasureConsiderationDetails).
 */
public class SmrSaveServlet extends HttpServlet {

    private static final String SQL_CURRENT_STATUS = ""
            + "SELECT d.SMRSTATUSID, TRIM(UPPER(NVL(st.SMRSTATUSCODE, ''))) AS STCODE "
            + "FROM SMR d "
            + "LEFT JOIN SMRSTATUS st ON st.SMRSTATUSID = d.SMRSTATUSID "
            + "WHERE d.SMRID = ?";
    private static final String SQL_READ_CLOB = "SELECT SMRXMLBODY FROM SMRXML WHERE SMRID = ?";
    private static final String SQL_UPDATE_XML = "UPDATE SMRXML SET SMRXMLBODY = ? WHERE SMRID = ?";
    private static final String SQL_UPDATE_SMR = ""
            + "UPDATE SMR SET MODIFICATIONDATETIME = SYSDATE, SMRSTATUSID = ?, AUTHORITYID = ? WHERE SMRID = ? "
            + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = '2'";
    private static final String SQL_UPDATE_SMR_NO_AUTH = ""
            + "UPDATE SMR SET MODIFICATIONDATETIME = SYSDATE, SMRSTATUSID = ? WHERE SMRID = ? "
            + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = '2'";
    private static final String SQL_INSERT_HIST = ""
            + "INSERT INTO SMRSTATUSHIST (SMRID, SMRSTATUSID, SMRSTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, ?)";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String body = readBody(request);
        String guid = jsonStringField(body, "guid");
        String smrIdStr = jsonStringField(body, "smrId");
        if (guid == null || guid.isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid в теле запроса");
            return;
        }
        if (smrIdStr == null || smrIdStr.isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите smrId в теле запроса");
            return;
        }
        long smrId;
        try {
            smrId = Long.parseLong(smrIdStr.trim());
        } catch (NumberFormatException e) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный smrId");
            return;
        }

        String smrXmlB64 = jsonStringField(body, "smrXmlB64");
        String authorityId = jsonStringField(body, "authorityId");

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            SmrCreateSupport.GateResult gate = SmrCreateSupport.evaluateEditGate(conn, smrId, guid);
            if (!gate.allowed) {
                sendErr(response, HttpServletResponse.SC_FORBIDDEN,
                        gate.reason != null ? gate.reason : "Сохранение карты SMR недоступно");
                return;
            }
            Integer userId = getUserIdFromRightsByGuid(guid);
            if (userId == null) {
                sendErr(response, HttpServletResponse.SC_BAD_REQUEST,
                        "В карте прав доступа укажите атрибут userId (для записи SMRSTATUSHIST)");
                return;
            }

            int currentStatusId;
            String currentStatusCode;
            try (PreparedStatement ps = conn.prepareStatement(SQL_CURRENT_STATUS)) {
                ps.setLong(1, smrId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        sendErr(response, HttpServletResponse.SC_NOT_FOUND, "Карта SMR не найдена");
                        return;
                    }
                    currentStatusId = rs.getInt("SMRSTATUSID");
                    currentStatusCode = rs.getString("STCODE");
                    if (currentStatusCode == null) {
                        currentStatusCode = "";
                    }
                }
            }

            Integer newStatusIdResolved = SmrOutgoingStatusHelper.resolveOutgoingStatusId(conn, "NEW");
            if (newStatusIdResolved == null) {
                sendErr(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "В справочнике SMRSTATUS не найден активный статус NEW для исходящих (DATASOURCEKINDCODE=2)");
                return;
            }

            boolean fromFailedOrError = "FAILED".equals(currentStatusCode) || "ERROR".equals(currentStatusCode);
            int newStatusId = currentStatusId;
            if (fromFailedOrError) {
                newStatusId = newStatusIdResolved;
            }

            String xmlOld = readXmlBody(conn, smrId);
            if (xmlOld == null) {
                sendErr(response, HttpServletResponse.SC_NOT_FOUND, "XML карты SMR не найден");
                return;
            }
            if (smrXmlB64 == null || smrXmlB64.trim().isEmpty()) {
                sendErr(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Укажите smrXmlB64: полный XML карты SMR (UTF-8) в кодировке Base64");
                return;
            }
            final String xmlNew;
            try {
                xmlNew = new String(Base64.getDecoder().decode(smrXmlB64.trim()), StandardCharsets.UTF_8);
            } catch (IllegalArgumentException e) {
                sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный Base64 в smrXmlB64");
                return;
            }
            if (xmlNew.trim().isEmpty()
                    || xmlNew.indexOf("SanitaryMeasureConsiderationDetails") < 0) {
                sendErr(response, HttpServletResponse.SC_BAD_REQUEST,
                        "В smrXmlB64 ожидается полный XML документа SMR (корень SanitaryMeasureConsiderationDetails)");
                return;
            }

            conn.setAutoCommit(false);
            try {
                Integer resolvedAuthorityId = SmrAuthorityDbSupport.resolveAuthorityId(conn, authorityId);
                try (PreparedStatement ps = conn.prepareStatement(
                        resolvedAuthorityId != null ? SQL_UPDATE_SMR : SQL_UPDATE_SMR_NO_AUTH)) {
                    ps.setInt(1, newStatusId);
                    if (resolvedAuthorityId != null) {
                        ps.setInt(2, resolvedAuthorityId);
                        ps.setLong(3, smrId);
                    } else {
                        ps.setLong(2, smrId);
                    }
                    int n = ps.executeUpdate();
                    if (n != 1) {
                        throw new SQLException("UPDATE SMR: ожидалась одна строка, обновлено " + n);
                    }
                } catch (SQLException e) {
                    if (resolvedAuthorityId == null || !(e.getMessage() != null && e.getMessage().contains("ORA-00904"))) {
                        throw e;
                    }
                    try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_SMR_NO_AUTH)) {
                        ps.setInt(1, newStatusId);
                        ps.setLong(2, smrId);
                        int n = ps.executeUpdate();
                        if (n != 1) {
                            throw new SQLException("UPDATE SMR: ожидалась одна строка, обновлено " + n);
                        }
                    }
                }
                try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_XML)) {
                    ps.setString(1, xmlNew);
                    ps.setLong(2, smrId);
                    int n = ps.executeUpdate();
                    if (n != 1) {
                        throw new SQLException("UPDATE SMRXML: ожидалась одна строка, обновлено " + n);
                    }
                }
                if (newStatusId != currentStatusId) {
                    try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                        ps.setLong(1, smrId);
                        ps.setInt(2, newStatusId);
                        ps.setInt(3, userId);
                        ps.executeUpdate();
                    }
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
            out.print("{\"ok\":true,\"smrStatusId\":" + newStatusId + "}");
            out.flush();
        } catch (SQLException e) {
            try {
                if (conn != null && !conn.getAutoCommit()) {
                    conn.rollback();
                }
            } catch (SQLException ignored) {
            }
            sendErr(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка сохранения: " + e.getMessage());
        } catch (IllegalArgumentException e) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
        } catch (IOException e) {
            sendErr(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка чтения XML: " + e.getMessage());
        } catch (Exception e) {
            sendErr(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "Ошибка обработки XML: " + (e.getMessage() != null ? e.getMessage() : e.getClass().getName()));
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static String readXmlBody(Connection conn, long smrId) throws SQLException, IOException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_READ_CLOB)) {
            ps.setLong(1, smrId);
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

    private static Integer getUserIdFromRightsByGuid(String guid) {
        if (guid == null || guid.isEmpty()) {
            return null;
        }
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid.trim());
        if (rightsJson == null || rightsJson.isEmpty()) {
            return null;
        }
        Matcher m = Pattern.compile("\"userId\"\\s*:\\s*(-?\\d+)").matcher(rightsJson);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        m = Pattern.compile("\"userId\"\\s*:\\s*\"(-?\\d+)\"").matcher(rightsJson);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private static String readBody(HttpServletRequest request) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = request.getReader()) {
            char[] buf = new char[8192];
            int n;
            while ((n = r.read(buf)) >= 0) {
                sb.append(buf, 0, n);
            }
        }
        return sb.toString();
    }

    private static String jsonStringField(String json, String field) {
        if (json == null) {
            return null;
        }
        Pattern p = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher m = p.matcher(json);
        if (m.find()) {
            return m.group(1);
        }
        Pattern pNum = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*(-?\\d+)");
        Matcher m2 = pNum.matcher(json);
        if (m2.find()) {
            return m2.group(1);
        }
        return null;
    }

    private static void sendErr(HttpServletResponse response, int status, String msg) throws IOException {
        response.setStatus(status);
        PrintWriter out = response.getWriter();
        out.print("{\"error\":" + quote(msg) + "}");
        out.flush();
    }

    private static String quote(String s) {
        if (s == null) {
            return "null";
        }
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }
}
