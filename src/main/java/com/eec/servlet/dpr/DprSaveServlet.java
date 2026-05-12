package com.eec.servlet.dpr;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.DatabaseUtil;
import com.eec.util.DprCreateSupport;

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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Сохранение правок исходящей DPR (одна транзакция): DPR (MODIFICATIONDATETIME, при FAILED/ERROR → NEW), DPRXML, DPRSTATUSHIST.
 * POST /api/dpr/save
 * Тело: guid, dprid, authorityId?, authorityName?, authorityBriefName?, descriptionText?
 */
public class DprSaveServlet extends HttpServlet {

    private static final int STATUS_FAILED = 8;
    private static final int STATUS_ERROR = 9;
    private static final int STATUS_NEW = 5;

    private static final String SQL_READ_CLOB = "SELECT DPRXMLBODY FROM DPRXML WHERE DPRID = ?";
    private static final String SQL_UPDATE_XML = "UPDATE DPRXML SET DPRXMLBODY = ? WHERE DPRID = ?";
    private static final String SQL_UPDATE_DPR = ""
            + "UPDATE DPR SET MODIFICATIONDATETIME = SYSDATE, DPRSTATUSID = ? WHERE DPRID = ? "
            + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = '2'";
    private static final String SQL_INSERT_HIST = ""
            + "INSERT INTO DPRSTATUSHIST (DPRID, DPRSTATUSID, DPRSTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, ?)";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String body = readBody(request);
        String guid = jsonStringField(body, "guid");
        String dpridStr = jsonStringField(body, "dprid");
        if (guid == null || guid.isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid в теле запроса");
            return;
        }
        if (dpridStr == null || dpridStr.isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите dprid в теле запроса");
            return;
        }
        long dprId;
        try {
            dprId = Long.parseLong(dpridStr.trim());
        } catch (NumberFormatException e) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный dprid");
            return;
        }

        String authorityId = jsonStringField(body, "authorityId");
        String authorityName = jsonStringField(body, "authorityName");
        String authorityBriefName = jsonStringField(body, "authorityBriefName");
        String descriptionText = jsonStringField(body, "descriptionText");

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            DprCreateSupport.GateResult gate = DprCreateSupport.evaluateEditGate(conn, dprId, guid);
            if (!gate.allowed) {
                sendErr(response, HttpServletResponse.SC_FORBIDDEN,
                        gate.reason != null ? gate.reason : "Сохранение карты DPR недоступно");
                return;
            }
            Integer userId = getUserIdFromRightsByGuid(guid);
            if (userId == null) {
                sendErr(response, HttpServletResponse.SC_BAD_REQUEST,
                        "В карте прав доступа укажите атрибут userId (для записи DPRSTATUSHIST)");
                return;
            }

            int currentStatusId = loadCurrentStatusId(conn, dprId);
            if (currentStatusId < 0) {
                sendErr(response, HttpServletResponse.SC_NOT_FOUND, "Карта DPR не найдена");
                return;
            }

            String xmlOld = readXmlBody(conn, dprId);
            if (xmlOld == null) {
                sendErr(response, HttpServletResponse.SC_NOT_FOUND, "XML карты DPR не найден");
                return;
            }
            String xmlNew = DprXmlPatcher.patchAuthorityAndDescription(xmlOld, authorityId, authorityName,
                    authorityBriefName, descriptionText);

            int newStatusId = currentStatusId;
            if (currentStatusId == STATUS_FAILED || currentStatusId == STATUS_ERROR) {
                newStatusId = STATUS_NEW;
            }

            conn.setAutoCommit(false);
            try {
                try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_DPR)) {
                    ps.setInt(1, newStatusId);
                    ps.setLong(2, dprId);
                    int n = ps.executeUpdate();
                    if (n != 1) {
                        throw new SQLException("UPDATE DPR: ожидалась одна строка, обновлено " + n);
                    }
                }
                try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_XML)) {
                    ps.setString(1, xmlNew);
                    ps.setLong(2, dprId);
                    int n = ps.executeUpdate();
                    if (n != 1) {
                        throw new SQLException("UPDATE DPRXML: ожидалась одна строка, обновлено " + n);
                    }
                }
                if (newStatusId != currentStatusId) {
                    try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                        ps.setLong(1, dprId);
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
            out.print("{\"ok\":true,\"dprStatusId\":" + newStatusId + "}");
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

    private static int loadCurrentStatusId(Connection conn, long dprId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT DPRSTATUSID FROM DPR WHERE DPRID = ?")) {
            ps.setLong(1, dprId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return -1;
                }
                return rs.getInt("DPRSTATUSID");
            }
        }
    }

    private static String readXmlBody(Connection conn, long dprId) throws SQLException, IOException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_READ_CLOB)) {
            ps.setLong(1, dprId);
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
