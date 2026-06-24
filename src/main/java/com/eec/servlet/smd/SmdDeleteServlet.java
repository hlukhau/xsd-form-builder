package com.eec.servlet.smd;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Удаление новой исходящей карты SMD.
 * POST /api/smd/delete — JSON { "smdid": number, "guid": "..." }.
 */
public class SmdDeleteServlet extends HttpServlet {

    private static final String SQL_DELETE_STATUSHIST = "DELETE FROM SMDSTATUSHIST WHERE SMDID = ?";
    private static final String SQL_DELETE_DEPPERMIS = "DELETE FROM SMDDEPPERMIS WHERE SMDID = ?";
    private static final String SQL_DELETE_SMDXML = "DELETE FROM SMDXML WHERE SMDID = ?";
    private static final String SQL_DELETE_SMD = "DELETE FROM SMD WHERE SMDID = ?";

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

        Long smdidLong = extractJsonLong(body, "smdid");
        String guid = extractJsonString(body, "guid");
        if (smdidLong == null || smdidLong <= 0) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите smdid в теле запроса");
            return;
        }
        if (guid == null || guid.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid для проверки права на удаление");
            return;
        }

        long smdid = smdidLong;
        guid = guid.trim();

        Connection conn = null;
        boolean committed = false;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            conn.setAutoCommit(false);

            String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
            SmdDeleteSupport.Eligibility eligibility = SmdDeleteSupport.checkEligibility(conn, smdid, rightsJson);
            if (!eligibility.allowed) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        eligibility.reason != null ? eligibility.reason : "Удаление недоступно");
                return;
            }

            try (PreparedStatement ps = conn.prepareStatement(SQL_DELETE_STATUSHIST)) {
                ps.setLong(1, smdid);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_DELETE_DEPPERMIS)) {
                ps.setLong(1, smdid);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_DELETE_SMDXML)) {
                ps.setLong(1, smdid);
                ps.executeUpdate();
            } catch (SQLException e) {
                if (!SmdDbSupport.isMissingObject(e)) {
                    throw e;
                }
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_DELETE_SMD)) {
                ps.setLong(1, smdid);
                int n = ps.executeUpdate();
                if (n == 0) {
                    conn.rollback();
                    sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Запись SMD не удалена");
                    return;
                }
            }

            conn.commit();
            committed = true;
            response.setStatus(HttpServletResponse.SC_OK);
            String docId = eligibility.docId != null ? eligibility.docId : String.valueOf(smdid);
            response.getWriter().print("{\"success\":true,\"docId\":\"" + escapeJson(docId) + "\"}");
        } catch (SQLException e) {
            if (conn != null && !committed) {
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

    private static String readBody(HttpServletRequest request) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (java.io.BufferedReader reader = request.getReader()) {
            char[] buf = new char[4096];
            int n;
            while ((n = reader.read(buf)) >= 0) {
                sb.append(buf, 0, n);
            }
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
        if (s == null) {
            return "";
        }
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ");
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.getWriter().print("{\"error\":\"" + escapeJson(message) + "\"}");
    }
}
