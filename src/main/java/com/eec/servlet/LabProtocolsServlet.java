package com.eec.servlet;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.Reader;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Clob;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Запрос протоколов лабораторных исследований по документу соответствия (DocKindCode=25).
 * POST JSON: { "registrationCertificateId", "authorityCountryCode", "guid" }.
 * Ответ: { "status": "requested"|"no_info"|"with_info"|"response_error", "message"?: string, "xml"?: string }.
 */
public class LabProtocolsServlet extends HttpServlet {

    private static final int REQUEST_PENDING_STATUS_ID = 1;

    /** Статус по REGISTRATIONCERTIFICATEID и AUTHORITYCOUNTRYCODE */
    private static final String SQL_GET_STATUS = ""
            + "SELECT rq.LPREQUESTID, st.LPREQUESTSTATUSCODE "
            + "FROM LPREQUEST rq "
            + "JOIN LPREQUESTSTATUS st ON st.LPREQUESTSTATUSID = rq.LPREQUESTSTATUSID "
            + "WHERE rq.REGISTRATIONCERTIFICATEID = ? AND rq.AUTHORITYCOUNTRYCODE = ?";

    /** LPREQUESTID подставляется триггером TRLPREQUESTBIR из sqlprequest.NEXTVAL при INSERT с NULL. */
    private static final String SQL_INSERT_REQUEST = ""
            + "INSERT INTO LPREQUEST (REGISTRATIONCERTIFICATEID, AUTHORITYCOUNTRYCODE, LPREQUESTSTATUSID) "
            + "VALUES (?, ?, ?)";

    private static final String SQL_INSERT_REQUEST_HIST = ""
            + "INSERT INTO LPREQUESTSTATUSHIST (LPREQUESTID, LPREQUESTSTATUSDATETIME, LPREQUESTSTATUSID, USERID) "
            + "VALUES (?, SYSDATE, ?, ?)";

    private static final String SQL_UPDATE_REQUEST_PENDING = ""
            + "UPDATE LPREQUEST SET LPREQUESTSTATUSID = ?, CDATE = SYSDATE WHERE LPREQUESTID = ?";

    private static final String SQL_GET_XML = "SELECT LPXMLBODY FROM LPXML WHERE LPREQUESTID = ?";

    private static final String RESPONSE_ERROR_MESSAGE =
            "Невозможно получить запрошенные сведения из-за ошибки обработки запроса.";

    private static final String[] SCENARIO1_STATUSES = { "REQUEST_PENDING", "REQUEST_FAILED" };

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        request.setCharacterEncoding("UTF-8");

        String body = readBody(request);
        String docId = extractJsonString(body, "registrationCertificateId");
        String countryCode = extractJsonString(body, "authorityCountryCode");
        String guid = extractJsonString(body, "guid");
        if (guid == null) guid = request.getParameter("guid");
        if (guid != null) guid = guid.trim();
        if (docId != null) docId = docId.trim();
        if (countryCode != null) countryCode = countryCode.trim();

        if (docId == null || docId.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите registrationCertificateId (номер документа)");
            return;
        }
        if (countryCode == null || countryCode.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите authorityCountryCode (код страны уполномоченного органа)");
            return;
        }

        Integer userId = resolveUserId(guid);
        if (userId == null && guid != null) {
            String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
            if (rightsJson == null || rightsJson.isEmpty()) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "GUID не найден в карте прав или в карте прав отсутствует userId");
                return;
            }
        }

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
        } catch (SQLException e) {
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка подключения к БД: " + e.getMessage());
            return;
        }

        try {
            Long lpRequestId = null;
            String statusCode = null;

            try (PreparedStatement ps = conn.prepareStatement(SQL_GET_STATUS)) {
                ps.setString(1, docId);
                ps.setString(2, countryCode);
                ResultSet rs = ps.executeQuery();
                if (rs.next()) {
                    lpRequestId = rs.getLong("LPREQUESTID");
                    statusCode = rs.getString("LPREQUESTSTATUSCODE");
                    if (statusCode != null) statusCode = statusCode.trim();
                }
                rs.close();
            }

            // Сценарий 2: нет сведений у первоисточника
            if ("RESPONSE_NO_INFO".equals(statusCode)) {
                sendJson(response, "no_info", "Запрошенные сведения отсутствуют у первоисточника.", null);
                return;
            }

            // Ошибка обработки запроса — повторная постановка в очередь не выполняется
            if ("RESPONSE_ERROR".equals(statusCode)) {
                sendJson(response, "response_error", RESPONSE_ERROR_MESSAGE, null);
                return;
            }

            // Сценарий 3: данные есть в локальной БД
            if ("RESPONSE_WITH_INFO".equals(statusCode) && lpRequestId != null) {
                String xml = getXmlBody(conn, lpRequestId);
                if (xml != null) {
                    sendJson(response, "with_info", null, xml);
                    return;
                }
            }

            // Сценарий 1: нет данных или статус REQUEST_PENDING / REQUEST_FAILED
            boolean needCreate = (lpRequestId == null);
            boolean needRequeue = (lpRequestId != null && isScenario1Status(statusCode));

            if (needCreate) {
                try {
                    try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_REQUEST)) {
                        ps.setString(1, docId);
                        ps.setString(2, countryCode);
                        ps.setInt(3, REQUEST_PENDING_STATUS_ID);
                        ps.executeUpdate();
                    }
                    long newId;
                    try (PreparedStatement ps = conn.prepareStatement(SQL_GET_STATUS)) {
                        ps.setString(1, docId);
                        ps.setString(2, countryCode);
                        ResultSet rs = ps.executeQuery();
                        if (!rs.next()) {
                            throw new SQLException("Не удалось получить LPREQUESTID после вставки");
                        }
                        newId = rs.getLong("LPREQUESTID");
                        rs.close();
                    }
                    if (userId != null) {
                        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_REQUEST_HIST)) {
                            ps.setLong(1, newId);
                            ps.setInt(2, REQUEST_PENDING_STATUS_ID);
                            ps.setInt(3, userId);
                            ps.executeUpdate();
                        }
                    }
                } catch (SQLException insertEx) {
                    // ORA-00001: уникальное ограничение (например дубликат LPREQUESTID или пары документ+страна) — перечитываем строку и действуем по текущему статусу
                    if (insertEx.getErrorCode() == 1) {
                        long refetchedId = 0;
                        String refetchedCode = null;
                        try (PreparedStatement ps = conn.prepareStatement(SQL_GET_STATUS)) {
                            ps.setString(1, docId);
                            ps.setString(2, countryCode);
                            ResultSet rs = ps.executeQuery();
                            if (rs.next()) {
                                refetchedId = rs.getLong("LPREQUESTID");
                                refetchedCode = rs.getString("LPREQUESTSTATUSCODE");
                                if (refetchedCode != null) refetchedCode = refetchedCode.trim();
                            }
                            rs.close();
                        }
                        if (refetchedId > 0 && "RESPONSE_WITH_INFO".equals(refetchedCode)) {
                            String xml = getXmlBody(conn, refetchedId);
                            if (xml != null) {
                                sendJson(response, "with_info", null, xml);
                                return;
                            }
                        }
                        if (refetchedId > 0 && "RESPONSE_ERROR".equals(refetchedCode)) {
                            sendJson(response, "response_error", RESPONSE_ERROR_MESSAGE, null);
                            return;
                        }
                        if (refetchedId > 0 && isScenario1Status(refetchedCode)) {
                            try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_REQUEST_PENDING)) {
                                ps.setInt(1, REQUEST_PENDING_STATUS_ID);
                                ps.setLong(2, refetchedId);
                                ps.executeUpdate();
                            }
                            if (userId != null) {
                                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_REQUEST_HIST)) {
                                    ps.setLong(1, refetchedId);
                                    ps.setInt(2, REQUEST_PENDING_STATUS_ID);
                                    ps.setInt(3, userId);
                                    ps.executeUpdate();
                                }
                            }
                        }
                        sendJson(response, "requested", "Запрошенные сведения отсутствуют в локальной базе данных. Выполнен запрос сведений к первоисточнику.", null);
                        return;
                    }
                    throw insertEx;
                }
            } else if (needRequeue && lpRequestId != null) {
                try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_REQUEST_PENDING)) {
                    ps.setInt(1, REQUEST_PENDING_STATUS_ID);
                    ps.setLong(2, lpRequestId);
                    ps.executeUpdate();
                }
                if (userId != null) {
                    try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_REQUEST_HIST)) {
                        ps.setLong(1, lpRequestId);
                        ps.setInt(2, REQUEST_PENDING_STATUS_ID);
                        ps.setInt(3, userId);
                        ps.executeUpdate();
                    }
                }
            }

            sendJson(response, "requested", "Запрошенные сведения отсутствуют в локальной базе данных. Выполнен запрос сведений к первоисточнику.", null);
        } catch (SQLException e) {
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static boolean isScenario1Status(String code) {
        if (code == null) return true;
        for (String s : SCENARIO1_STATUSES) {
            if (s.equals(code)) return true;
        }
        return false;
    }

    private static String getXmlBody(Connection conn, long lpRequestId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_GET_XML)) {
            ps.setLong(1, lpRequestId);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                Object o = rs.getObject("LPXMLBODY");
                rs.close();
                if (o instanceof Clob) {
                    Clob clob = (Clob) o;
                    try (Reader r = clob.getCharacterStream()) {
                        StringBuilder sb = new StringBuilder();
                        char[] buf = new char[4096];
                        int n;
                        while ((n = r.read(buf)) >= 0) sb.append(buf, 0, n);
                        return sb.toString();
                    } catch (IOException e) {
                        throw new SQLException("Ошибка чтения LPXMLBODY", e);
                    }
                }
                if (o != null) return o.toString();
            }
        }
        return null;
    }

    private static void sendJson(HttpServletResponse response, String status, String message, String xml) throws IOException {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"status\":\"").append(escapeJson(status)).append("\"");
        if (message != null) sb.append(",\"message\":\"").append(escapeJson(message)).append("\"");
        if (xml != null) sb.append(",\"xml\":").append(escapeJsonForValue(xml));
        sb.append("}");
        response.getWriter().print(sb.toString());
    }

    private static String escapeJsonForValue(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r") + "\"";
    }

    private static String readBody(HttpServletRequest request) throws IOException {
        StringBuilder sb = new StringBuilder();
        char[] buf = new char[2048];
        try (Reader r = request.getReader()) {
            int n;
            while ((n = r.read(buf)) >= 0) sb.append(buf, 0, n);
        }
        return sb.toString();
    }

    private static String extractJsonString(String json, String key) {
        if (json == null) return null;
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"([^\"]*)\"").matcher(json);
        if (m.find()) return m.group(1);
        return null;
    }

    private static Integer resolveUserId(String guid) {
        if (guid == null || guid.isEmpty()) return null;
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) return null;
        Matcher m = Pattern.compile("\"userId\"\\s*:\\s*(-?\\d+)").matcher(rightsJson);
        if (m.find()) {
            try { return Integer.parseInt(m.group(1)); } catch (NumberFormatException e) { return null; }
        }
        m = Pattern.compile("\"userId\"\\s*:\\s*\"(-?\\d+)\"").matcher(rightsJson);
        if (m.find()) {
            try { return Integer.parseInt(m.group(1)); } catch (NumberFormatException e) { return null; }
        }
        return null;
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().print("{\"error\":\"" + escapeJson(message) + "\"}");
    }
}
