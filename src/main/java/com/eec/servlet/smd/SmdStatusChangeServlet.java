package com.eec.servlet.smd;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Смена статуса карты SMD.
 * POST /api/smd/status — JSON { "smdid", "action", "guid" }.
 * GET /api/smd/status?preview=incoming_complete&smdid=...&guid=... — { reviewOutcomeSent }.
 * <p>Исходящие:</p>
 * <ul>
 *   <li>{@code send} — NEW / FAILED / ERROR → PENDING; sanitaryMeasureOut:send ∩ SMDDEPPERMIS.</li>
 * </ul>
 * <p>Входящие:</p>
 * <ul>
 *   <li>{@code complete_processing} — PROCESSING → PROCESSED; sanitaryMeasureIn:status ∩ SMDDEPPERMIS.</li>
 *   <li>{@code close} — входящие PROCESSED → COMPLETED; исходящие NEW|FAILED|ERROR|DELIVERED → COMPLETED.</li>
 * </ul>
 */
public class SmdStatusChangeServlet extends HttpServlet {

    private static final String SQL_UPDATE_SMD = ""
            + "UPDATE SMD SET SMDSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE WHERE SMDID = ?";

    private static final String SQL_INSERT_HIST = ""
            + "INSERT INTO SMDSTATUSHIST (SMDID, SMDSTATUSID, SMDSTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, ?)";

    private static final String STATUS_PENDING_NAME = "Ожидает отправки";
    private static final String STATUS_PROCESSED_NAME = "Обработано";
    private static final String STATUS_COMPLETED_NAME = "Завершено";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String preview = request.getParameter("preview");
        if (!"incoming_complete".equals(preview)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите preview=incoming_complete");
            return;
        }
        String smdid = request.getParameter("smdid");
        String guid = request.getParameter("guid");
        if (smdid == null || smdid.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите smdid");
            return;
        }
        if (guid == null || guid.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid");
            return;
        }
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        long smdidNum;
        try {
            smdidNum = Long.parseLong(smdid.trim());
            if (smdidNum <= 0) {
                throw new NumberFormatException();
            }
        } catch (NumberFormatException e) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный smdid");
            return;
        }

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid.trim());
            boolean sent = SmdCompleteProcessingSupport.isReviewOutcomeSent(conn, smdidNum);
            PrintWriter out = response.getWriter();
            out.print("{\"reviewOutcomeSent\":" + sent + "}");
            out.flush();
        } catch (SQLException e) {
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

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

        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        Integer userId = getUserIdFromRights(rightsJson);
        if (userId == null) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "В карте прав должен быть указан userId");
            return;
        }

        if ("send".equals(action)) {
            handleSend(response, request, guid, rightsJson, userId, smdidNum);
            return;
        }
        if ("complete_processing".equals(action)) {
            handleCompleteProcessing(response, request, guid, rightsJson, userId, smdidNum);
            return;
        }
        if ("close".equals(action)) {
            handleClose(response, request, guid, rightsJson, userId, smdidNum);
            return;
        }

        sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Неподдерживаемое действие: " + action);
    }

    private void handleSend(HttpServletResponse response, HttpServletRequest request, String guid,
                            String rightsJson, Integer userId, long smdidNum) throws IOException {
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

            updateStatusAndHist(conn, smdidNum, pendingStatusId, userId);

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

    private void handleCompleteProcessing(HttpServletResponse response, HttpServletRequest request, String guid,
                                          String rightsJson, Integer userId, long smdidNum) throws IOException {
        Connection conn = null;
        boolean committed = false;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            conn.setAutoCommit(false);

            SmdCompleteProcessingSupport.Eligibility eligibility =
                    SmdCompleteProcessingSupport.checkEligibility(conn, smdidNum, rightsJson);
            if (!eligibility.allowed) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        eligibility.reason != null ? eligibility.reason : "Завершение обработки недоступно");
                return;
            }

            Integer processedId = SmdIncomingStatusHelper.resolveIncomingStatusId(conn, "PROCESSED");
            if (processedId == null) {
                sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Не найден статус PROCESSED для входящих SMD");
                return;
            }

            if (!SmdIncomingStatusHelper.applyProcessingToProcessedOnComplete(conn, smdidNum, userId)) {
                conn.rollback();
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Карта не в статусе «В обработке» или уже обновлена другим запросом");
                return;
            }

            String displayName = SmdIncomingStatusHelper.resolveIncomingStatusName(conn, processedId);
            if (displayName == null || displayName.isEmpty()) {
                displayName = STATUS_PROCESSED_NAME;
            }

            conn.commit();
            committed = true;
            response.setStatus(HttpServletResponse.SC_OK);
            response.getWriter().print("{\"ok\":true,\"changed\":true,\"newStatus\":\""
                    + escapeJson(displayName) + "\",\"newStatusId\":" + processedId
                    + ",\"newStatusCode\":\"PROCESSED\"}");
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

    private void handleClose(HttpServletResponse response, HttpServletRequest request, String guid,
                             String rightsJson, Integer userId, long smdidNum) throws IOException {
        Connection conn = null;
        boolean committed = false;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            conn.setAutoCommit(false);

            String dsc;
            try (PreparedStatement ps = conn.prepareStatement(SmdDbSupport.SQL_SMD_DATASOURCE)) {
                ps.setLong(1, smdidNum);
                try (ResultSet rs = ps.executeQuery()) {
                    dsc = rs.next() ? (rs.getString("DSC") != null ? rs.getString("DSC").trim() : "") : "";
                }
            }

            boolean applied;
            Integer completedId;
            if (SmdIncomingStatusHelper.DATASOURCE_INCOMING.equals(dsc)) {
                SmdCloseSupport.Eligibility eligibility =
                        SmdCloseSupport.checkIncomingCloseEligibility(conn, smdidNum, rightsJson);
                if (!eligibility.allowed) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                            eligibility.reason != null ? eligibility.reason : "Закрытие карты недоступно");
                    return;
                }
                completedId = SmdCloseSupport.resolveStatusId(conn,
                        SmdIncomingStatusHelper.DATASOURCE_INCOMING, "COMPLETED");
                if (completedId == null) {
                    sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                            "Не найден статус COMPLETED для входящих SMD");
                    return;
                }
                applied = SmdCloseSupport.applyIncomingClose(conn, smdidNum, userId);
            } else if (SmdSendSupport.DATASOURCE_OUTGOING.equals(dsc)) {
                SmdCloseSupport.Eligibility eligibility =
                        SmdCloseSupport.checkOutgoingCloseEligibility(conn, smdidNum, rightsJson);
                if (!eligibility.allowed) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                            eligibility.reason != null ? eligibility.reason : "Закрытие карты недоступно");
                    return;
                }
                completedId = SmdCloseSupport.resolveStatusId(conn,
                        SmdSendSupport.DATASOURCE_OUTGOING, "COMPLETED");
                if (completedId == null) {
                    sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                            "Не найден статус COMPLETED для исходящих SMD");
                    return;
                }
                applied = SmdCloseSupport.applyOutgoingClose(conn, smdidNum, userId);
            } else {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Закрытие карты недоступно для данного типа источника");
                return;
            }

            if (!applied) {
                conn.rollback();
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Карта не в допустимом статусе для закрытия или уже обновлена другим запросом");
                return;
            }

            String displayName = SmdCloseSupport.resolveStatusName(conn, completedId);
            if (displayName == null || displayName.isEmpty()) {
                displayName = STATUS_COMPLETED_NAME;
            }

            conn.commit();
            committed = true;
            response.setStatus(HttpServletResponse.SC_OK);
            response.getWriter().print("{\"ok\":true,\"changed\":true,\"newStatus\":\""
                    + escapeJson(displayName) + "\",\"newStatusId\":" + completedId
                    + ",\"newStatusCode\":\"COMPLETED\"}");
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

    private static void updateStatusAndHist(Connection conn, long smdidNum, int statusId, Integer userId)
            throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_SMD)) {
            ps.setInt(1, statusId);
            ps.setLong(2, smdidNum);
            int n = ps.executeUpdate();
            if (n == 0) {
                throw new SQLException("Запись SMD не обновлена");
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
            ps.setLong(1, smdidNum);
            ps.setInt(2, statusId);
            ps.setInt(3, userId);
            ps.executeUpdate();
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
