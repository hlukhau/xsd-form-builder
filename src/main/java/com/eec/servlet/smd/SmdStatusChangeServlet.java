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
 * Смена статуса карты SMD.
 * POST /api/smd/status — JSON { "smdid", "action", "guid" }.
 * <p>Исходящие:</p>
 * <ul>
 *   <li>{@code send} — NEW / FAILED / ERROR → PENDING («Ожидает отправки»); sanitaryMeasureOut:send ∩ SMDDEPPERMIS.</li>
 * </ul>
 */
public class SmdStatusChangeServlet extends HttpServlet {

    private static final String SQL_UPDATE_SMD = ""
            + "UPDATE SMD SET SMDSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE WHERE SMDID = ?";

    private static final String SQL_INSERT_HIST = ""
            + "INSERT INTO SMDSTATUSHIST (SMDID, SMDSTATUSID, SMDSTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, ?)";

    private static final String STATUS_PENDING_NAME = "Ожидает отправки";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        request.setCharacterEncoding("UTF-8");

        String body = readBody(request);
        String smdid = extractJsonString(body, "smdid");
        String action = extractJsonString(body, "action");
        String guid = extractJsonString(body, "guid");
        if (guid == null) {
            guid = extractJsonStringOrNumber(body, "guid");
        }
        if (guid != null) {
            guid = guid.trim();
        }

        if (smdid == null || smdid.trim().isEmpty() || action == null || action.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите smdid и action");
            return;
        }
        if (guid == null || guid.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid");
            return;
        }

        smdid = smdid.trim();
        action = action.trim();

        long smdidNum;
        try {
            smdidNum = Long.parseLong(smdid);
            if (smdidNum <= 0) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "smdid должен быть положительным числом");
                return;
            }
        } catch (NumberFormatException e) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный smdid");
            return;
        }

        if (!"send".equals(action)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Неподдерживаемое действие: " + action);
            return;
        }

        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        Integer userId = getUserIdFromRights(rightsJson);
        if (userId == null) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "В карте прав должен быть указан userId");
            return;
        }

        Connection conn = null;
        boolean committed = false;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            conn.setAutoCommit(false);

            SmdSendSupport.Eligibility eligibility = SmdSendSupport.checkEligibility(conn, smdidNum, rightsJson);
            if (!eligibility.allowed) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        eligibility.reason != null ? eligibility.reason : "Направление сведений недоступно");
                return;
            }

            int pendingStatusId = SmdDeleteSupport.resolveStatusId(conn, SmdSendSupport.STATUS_PENDING);
            if (pendingStatusId <= 0) {
                sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Не найден статус PENDING для исходящих SMD");
                return;
            }

            try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_SMD)) {
                ps.setInt(1, pendingStatusId);
                ps.setLong(2, smdidNum);
                int n = ps.executeUpdate();
                if (n == 0) {
                    conn.rollback();
                    sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Запись SMD не обновлена");
                    return;
                }
            }

            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                ps.setLong(1, smdidNum);
                ps.setInt(2, pendingStatusId);
                ps.setInt(3, userId);
                ps.executeUpdate();
            }

            conn.commit();
            committed = true;
            response.setStatus(HttpServletResponse.SC_OK);
            response.getWriter().print("{\"ok\":true,\"changed\":true,\"newStatus\":\""
                    + escapeJson(STATUS_PENDING_NAME) + "\",\"newStatusId\":" + pendingStatusId
                    + ",\"newStatusCode\":\"PENDING\"}");
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

    private static String extractJsonString(String json, String key) {
        if (json == null) {
            return null;
        }
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"([^\"]*)\"").matcher(json);
        return m.find() ? m.group(1) : null;
    }

    private static String extractJsonStringOrNumber(String json, String key) {
        if (json == null) {
            return null;
        }
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(-?\\d+)").matcher(json);
        return m.find() ? m.group(1) : null;
    }

    private static Integer getUserIdFromRights(String json) {
        if (json == null) {
            return null;
        }
        Matcher m = Pattern.compile("\"userId\"\\s*:\\s*(-?\\d+)").matcher(json);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        m = Pattern.compile("\"userId\"\\s*:\\s*\"(-?\\d+)\"").matcher(json);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static String escapeJson(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.getWriter().print("{\"error\":\"" + escapeJson(message) + "\"}");
    }
}
