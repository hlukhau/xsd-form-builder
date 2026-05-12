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
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Первое сохранение черновика DPR (ответ на входящую PPV) в одной транзакции: DPR, DPRXML, DPRSTATUSHIST.
 * POST /api/dpr/create-save
 * Тело JSON: {@code guid}, {@code ppvid}; опционально {@code authorityId}, {@code authorityName}, {@code authorityBriefName}, {@code descriptionText}.
 */
public class DprCreateSaveServlet extends HttpServlet {

    private static final String SQL_NEXT_DPRID = "SELECT sqdpr.NEXTVAL AS N FROM DUAL";

    private static final String SQL_INSERT_DPR = ""
            + "INSERT INTO DPR (DPRID, PPVID, INCIDENTID, DATASOURCEKINDCODE, DPRSTATUSID, "
            + "CREATIONDATETIME, MODIFICATIONDATETIME, RESPONSECOUNTRYID, DPRVERSION) "
            + "VALUES (?, ?, ?, 2, ?, SYSDATE, SYSDATE, ?, 1)";

    private static final String SQL_INSERT_DPR_MIN = ""
            + "INSERT INTO DPR (DPRID, PPVID, DATASOURCEKINDCODE, DPRSTATUSID, "
            + "CREATIONDATETIME, MODIFICATIONDATETIME, RESPONSECOUNTRYID, DPRVERSION) "
            + "VALUES (?, ?, 2, ?, SYSDATE, SYSDATE, ?, 1)";

    private static final String SQL_INSERT_DPRXML = "INSERT INTO DPRXML (DPRID, DPRXMLBODY) VALUES (?, ?)";

    private static final String SQL_INSERT_HIST = ""
            + "INSERT INTO DPRSTATUSHIST (DPRID, DPRSTATUSID, DPRSTATUSDATETIME, USERID) "
            + "VALUES (?, ?, SYSDATE, ?)";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String body = readBody(request);
        String guid = jsonStringField(body, "guid");
        String ppvidStr = jsonStringField(body, "ppvid");
        if (guid == null || guid.isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid в теле запроса");
            return;
        }
        if (ppvidStr == null || ppvidStr.isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите ppvid в теле запроса");
            return;
        }
        long ppvid;
        try {
            ppvid = Long.parseLong(ppvidStr.trim());
        } catch (NumberFormatException e) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный ppvid");
            return;
        }

        String authorityId = jsonStringField(body, "authorityId");
        String authorityName = jsonStringField(body, "authorityName");
        String authorityBriefName = jsonStringField(body, "authorityBriefName");
        String descriptionText = jsonStringField(body, "descriptionText");

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            DprCreateSupport.GateResult gate = DprCreateSupport.evaluateGate(conn, ppvid, guid);
            if (!gate.allowed) {
                sendErr(response, HttpServletResponse.SC_FORBIDDEN, gate.reason != null ? gate.reason : "Создание карты DPR недоступно");
                return;
            }

            Integer userId = getUserIdFromRightsByGuid(guid);
            if (userId == null) {
                sendErr(response, HttpServletResponse.SC_BAD_REQUEST,
                        "В карте прав доступа укажите атрибут userId (для записи DPRSTATUSHIST)");
                return;
            }

            long dprId;
            try (PreparedStatement ps = conn.prepareStatement(SQL_NEXT_DPRID); ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    sendErr(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Не удалось получить DPRID из последовательности sqdpr");
                    return;
                }
                dprId = rs.getLong("N");
            }

            String xml = DprDraftXmlBuilder.buildDraftXml(
                    gate.incidentId,
                    gate.alertCountryCode,
                    gate.incidentKindCode,
                    gate.docCreationDate,
                    authorityId,
                    authorityName,
                    authorityBriefName,
                    descriptionText
            );

            conn.setAutoCommit(false);
            try {
                insertDprWithOptionalIncident(conn, dprId, ppvid, gate.incidentId, gate.draftDprStatusId,
                        gate.responseCountryId);
                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_DPRXML)) {
                    ps.setLong(1, dprId);
                    ps.setString(2, xml);
                    ps.executeUpdate();
                }
                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                    ps.setLong(1, dprId);
                    ps.setInt(2, gate.draftDprStatusId);
                    ps.setInt(3, userId);
                    ps.executeUpdate();
                }
                conn.commit();
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(true);
            }

            PrintWriter out = response.getWriter();
            response.setStatus(HttpServletResponse.SC_OK);
            out.print("{\"dprid\":" + dprId + "}");
            out.flush();
        } catch (SQLException e) {
            try {
                if (conn != null && !conn.getAutoCommit()) {
                    conn.rollback();
                }
            } catch (SQLException ignored) {
            }
            String msg = e.getMessage() != null ? e.getMessage() : "Ошибка БД";
            if (msg.contains("ORA-02289")) {
                sendErr(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Последовательность sqdpr не найдена в БД (ORA-02289). Создайте sequence sqdpr.");
            } else if (msg.contains("ORA-00904")) {
                sendErr(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Ошибка схемы БД (несовпадение имён колонок таблицы DPR). Детали: " + msg);
            } else {
                sendErr(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка сохранения: " + msg);
            }
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static void insertDprWithOptionalIncident(Connection conn, long dprId, long ppvid, String incidentId,
                                                      int draftStatusId, long responseCountryId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_DPR)) {
            ps.setLong(1, dprId);
            ps.setLong(2, ppvid);
            ps.setString(3, incidentId);
            ps.setInt(4, draftStatusId);
            ps.setLong(5, responseCountryId);
            ps.executeUpdate();
        } catch (SQLException e) {
            String m = e.getMessage() != null ? e.getMessage() : "";
            if (!m.contains("ORA-00904")) {
                throw e;
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_DPR_MIN)) {
                ps.setLong(1, dprId);
                ps.setLong(2, ppvid);
                ps.setInt(3, draftStatusId);
                ps.setLong(4, responseCountryId);
                ps.executeUpdate();
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
