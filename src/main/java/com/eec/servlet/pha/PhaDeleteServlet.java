package com.eec.servlet.pha;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Удаление карты исходящих сведений PHA (только статус «Новое», PHASTATUSID = 5).
 * POST /api/pha/delete — JSON { "phaid": number, "guid": "..." }.
 * Условия: DATASOURCEKINDCODE = 2, PHASTATUSID = 5, пересечение publicHealthOut:edit с PHADEPPERMIS.
 */
public class PhaDeleteServlet extends HttpServlet {

    private static final String DATASOURCEKINDCODE_OUTGOING = "2";
    /** «Новое» */
    private static final int PHASTATUSID_NEW = 5;

    private static final String SQL_CHECK = ""
            + "SELECT p.INCIDENTID FROM PHA p "
            + "WHERE p.PHAID = ? AND TRIM(p.DATASOURCEKINDCODE) = ? AND p.PHASTATUSID = ?";

    private static final String SQL_DEPS = "SELECT DEPID FROM PHADEPPERMIS WHERE PHAID = ?";

    private static final String SQL_DELETE_STATUSHIST = "DELETE FROM PHASTATUSHIST WHERE PHAID = ?";
    private static final String SQL_DELETE_DEPPERMIS = "DELETE FROM PHADEPPERMIS WHERE PHAID = ?";
    private static final String SQL_DELETE_PHAXML = "DELETE FROM PHAXML WHERE PHAID = ?";
    private static final String SQL_DELETE_PHA = "DELETE FROM PHA WHERE PHAID = ?";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");

        String body = readBody(request);
        if (body == null || body.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Тело запроса пусто");
            return;
        }
        Long phaidLong = extractJsonLong(body, "phaid");
        String guid = extractJsonString(body, "guid");
        if (phaidLong == null || phaidLong <= 0) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите phaid в теле запроса");
            return;
        }
        if (guid == null || guid.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid для проверки права на удаление");
            return;
        }
        long phaid = phaidLong;
        guid = guid.trim();

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            conn.setAutoCommit(false);

            String incidentId;
            try (PreparedStatement ps = conn.prepareStatement(SQL_CHECK)) {
                ps.setLong(1, phaid);
                ps.setString(2, DATASOURCEKINDCODE_OUTGOING);
                ps.setInt(3, PHASTATUSID_NEW);
                ResultSet rs = ps.executeQuery();
                if (!rs.next()) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                            "Удаление возможно только для исходящей карты в статусе «Новое» (PHA не найдена или условия не выполнены).");
                    return;
                }
                incidentId = rs.getString(1);
                if (incidentId == null) incidentId = "";
            }

            boolean commandInvoke = Boolean.TRUE.equals(request.getAttribute("com.eec.command.invoke"));
            if (!commandInvoke) {
                Set<String> cardDepIds = new HashSet<>();
                try (PreparedStatement ps = conn.prepareStatement(SQL_DEPS)) {
                    ps.setLong(1, phaid);
                    ResultSet rs = ps.executeQuery();
                    while (rs.next()) {
                        String depId = rs.getString(1);
                        if (depId != null && !depId.trim().isEmpty()) {
                            cardDepIds.add(depId.trim());
                        }
                    }
                }
                if (cardDepIds.isEmpty()) {
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                            "Нет доступа к карте: в доступе к карте нет подразделений.");
                    return;
                }
                String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
                if (rightsJson == null || rightsJson.isEmpty()) {
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Права по GUID не найдены.");
                    return;
                }
                Set<String> userEditDepIds = parsePublicHealthOutEditDepIds(rightsJson);
                boolean hasEditInCardDeps = false;
                for (String depId : userEditDepIds) {
                    if (cardDepIds.contains(depId)) {
                        hasEditInCardDeps = true;
                        break;
                    }
                }
                if (!hasEditInCardDeps) {
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                            "Нет права на редактирование исходящих сведений в пределах ни одного подразделения, имеющего доступ к данной карте.");
                    return;
                }
            }

            try (PreparedStatement ps = conn.prepareStatement(SQL_DELETE_STATUSHIST)) {
                ps.setLong(1, phaid);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_DELETE_DEPPERMIS)) {
                ps.setLong(1, phaid);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_DELETE_PHAXML)) {
                ps.setLong(1, phaid);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_DELETE_PHA)) {
                ps.setLong(1, phaid);
                int n = ps.executeUpdate();
                if (n == 0) {
                    conn.rollback();
                    sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Запись PHA не удалена.");
                    return;
                }
            }

            conn.commit();
            response.setStatus(HttpServletResponse.SC_OK);
            String regNumber = incidentId.isEmpty() ? String.valueOf(phaid) : incidentId;
            response.getWriter().print("{\"success\":true,\"registrationNumber\":\"" + escapeJson(regNumber) + "\"}");
        } catch (SQLException e) {
            if (conn != null) {
                try {
                    conn.rollback();
                } catch (SQLException ignored) {
                }
            }
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static Set<String> parsePublicHealthOutEditDepIds(String json) {
        Set<String> out = new HashSet<>();
        int outStart = json.indexOf("\"publicHealthOut\"");
        if (outStart < 0) return out;
        int editStart = json.indexOf("\"edit\"", outStart);
        if (editStart < 0) return out;
        int braceStart = json.indexOf('{', editStart);
        if (braceStart < 0) return out;
        int depth = 1;
        int i = braceStart + 1;
        while (i < json.length() && depth > 0) {
            char c = json.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') depth--;
            i++;
        }
        String editBlock = depth == 0 ? json.substring(braceStart, i) : "";
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(editBlock);
        while (keyM.find()) {
            out.add(keyM.group(1).trim());
        }
        return out;
    }

    private static String readBody(HttpServletRequest request) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (java.io.BufferedReader reader = request.getReader()) {
            char[] buf = new char[4096];
            int n;
            while ((n = reader.read(buf)) >= 0) sb.append(buf, 0, n);
        }
        return sb.toString();
    }

    private static Long extractJsonLong(String json, String key) {
        Pattern p = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(-?\\d+)");
        Matcher m = p.matcher(json);
        return m.find() ? Long.parseLong(m.group(1)) : null;
    }

    private static String extractJsonString(String json, String key) {
        Pattern p = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher m = p.matcher(json);
        return m.find() ? m.group(1) : null;
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ");
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.getWriter().print("{\"error\":\"" + escapeJson(message) + "\"}");
    }
}
