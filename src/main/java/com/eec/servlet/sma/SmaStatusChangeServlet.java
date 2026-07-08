package com.eec.servlet.sma;

import com.eec.util.DatabaseUtil;
import com.eec.util.SmaCreateSupport;
import com.eec.util.SmaIncomingStatusHelper;
import com.eec.util.SmaOutgoingStatusHelper;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Смена статуса SMAQ/SMAR.
 * POST /api/sma/status — тело: kind, id, action, guid.
 * Действия: send, complete_processing.
 */
public class SmaStatusChangeServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String body = SmaServletUtil.readBody(request);
        SmaCardKind kind = SmaServletUtil.parseKindFromJson(body);
        String idStr = SmaServletUtil.jsonStringField(body, "id");
        String action = SmaServletUtil.jsonStringField(body, "action");
        String guid = SmaServletUtil.jsonStringField(body, "guid");

        if (kind == null || idStr == null || idStr.trim().isEmpty() || action == null || action.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Нужны kind, id и action");
            return;
        }
        long cardId;
        try {
            cardId = Long.parseLong(idStr.trim());
        } catch (NumberFormatException e) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "id должен быть числом");
            return;
        }
        action = action.trim();
        if (guid != null) {
            guid = guid.trim();
        }
        Integer userId = SmaServletUtil.getUserIdFromRightsByGuid(guid);
        if (userId == null) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Укажите guid в теле запроса (в карте прав должен быть атрибут userId)");
            return;
        }

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            if ("complete_processing".equals(action)) {
                SmaCreateSupport.GateResult gate =
                        SmaCreateSupport.evaluateIncomingCompleteProcessingGate(conn, kind, cardId, guid);
                if (!gate.allowed) {
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                            gate.reason != null ? gate.reason : "Завершение обработки недоступно");
                    return;
                }
            } else if ("send".equals(action)) {
                SmaCreateSupport.GateResult gate = kind == SmaCardKind.SMAQ
                        ? SmaCreateSupport.evaluateSmaqSendGate(conn, cardId, guid)
                        : SmaCreateSupport.evaluateSmarSendGate(conn, cardId, guid);
                if (!gate.allowed) {
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                            gate.reason != null ? gate.reason : "Направление сведений недоступно");
                    return;
                }
            } else {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Неизвестное действие: " + action);
                return;
            }

            int currentStatusId;
            String currentStatusCode;
            String sqlCurrent = kind == SmaCardKind.SMAQ
                    ? "SELECT d.SMAQSTATUSID, TRIM(UPPER(NVL(st.SMAQSTATUSCODE, ''))) AS STCODE "
                    + "FROM SMAQ d LEFT JOIN SMAQSTATUS st ON st.SMAQSTATUSID = d.SMAQSTATUSID WHERE d.SMAQID = ?"
                    : "SELECT d.SMARSTATUSID, TRIM(UPPER(NVL(st.SMARSTATUSCODE, ''))) AS STCODE "
                    + "FROM SMAR d LEFT JOIN SMARSTATUS st ON st.SMARSTATUSID = d.SMARSTATUSID WHERE d.SMARID = ?";
            try (PreparedStatement ps = conn.prepareStatement(sqlCurrent)) {
                ps.setLong(1, cardId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        sendJsonError(response, HttpServletResponse.SC_NOT_FOUND, "Карта не найдена");
                        return;
                    }
                    currentStatusId = rs.getInt(1);
                    currentStatusCode = rs.getString("STCODE");
                    if (currentStatusCode == null) {
                        currentStatusCode = "";
                    }
                }
            }

            conn.setAutoCommit(false);
            try {
                if ("complete_processing".equals(action)) {
                    handleCompleteProcessing(response, conn, kind, cardId, currentStatusCode, userId);
                } else {
                    handleSend(response, conn, kind, cardId, currentStatusId, userId);
                }
            } catch (SQLException e) {
                DatabaseUtil.rollbackQuietly(conn);
                throw e;
            }
        } catch (SQLException e) {
            DatabaseUtil.rollbackQuietly(conn);
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private void handleSend(HttpServletResponse response, Connection conn, SmaCardKind kind, long cardId,
                            int currentStatusId, Integer userId) throws IOException, SQLException {
        Integer pendingId = SmaOutgoingStatusHelper.resolveOutgoingStatusId(conn, kind, "PENDING");
        if (pendingId == null) {
            fail(conn, response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "В справочнике не найден активный статус PENDING для исходящих (DATASOURCEKINDCODE=2)");
            return;
        }
        String updateSql = kind == SmaCardKind.SMAQ
                ? "UPDATE SMAQ SET SMAQSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE WHERE SMAQID = ? AND SMAQSTATUSID = ?"
                : "UPDATE SMAR SET SMARSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE WHERE SMARID = ? AND SMARSTATUSID = ?";
        try (PreparedStatement ps = conn.prepareStatement(updateSql)) {
            ps.setInt(1, pendingId);
            ps.setLong(2, cardId);
            ps.setInt(3, currentStatusId);
            if (ps.executeUpdate() == 0) {
                fail(conn, response, HttpServletResponse.SC_CONFLICT,
                        "Статус карты был изменён. Обновите страницу и повторите направление сведений.");
                return;
            }
        }
        insertHist(conn, kind, cardId, pendingId, userId);
        conn.commit();
        response.getWriter().print("{\"ok\":true,\"newStatus\":\"Ожидает отправки\",\"newStatusId\":" + pendingId + "}");
    }

    private void handleCompleteProcessing(HttpServletResponse response, Connection conn, SmaCardKind kind,
                                          long cardId, String currentStatusCode, Integer userId)
            throws IOException, SQLException {
        if (!"PROCESSING".equals(currentStatusCode)) {
            fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                    "Завершение обработки возможно только при статусе «В обработке» (PROCESSING)");
            return;
        }
        Integer processingId = SmaIncomingStatusHelper.resolveIncomingStatusId(conn, kind, "PROCESSING");
        Integer processedId = SmaIncomingStatusHelper.resolveIncomingStatusId(conn, kind, "PROCESSED");
        if (processingId == null || processedId == null) {
            fail(conn, response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "В справочнике не найдены статусы PROCESSING/PROCESSED для входящих (DATASOURCEKINDCODE=1)");
            return;
        }
        String updateSql = kind == SmaCardKind.SMAQ
                ? "UPDATE SMAQ SET SMAQSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE WHERE SMAQID = ? AND SMAQSTATUSID = ?"
                : "UPDATE SMAR SET SMARSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE WHERE SMARID = ? AND SMARSTATUSID = ?";
        try (PreparedStatement ps = conn.prepareStatement(updateSql)) {
            ps.setInt(1, processedId);
            ps.setLong(2, cardId);
            ps.setInt(3, processingId);
            if (ps.executeUpdate() == 0) {
                fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                        "Карта не в статусе «В обработке» или уже обновлена другим запросом");
                return;
            }
        }
        insertHist(conn, kind, cardId, processedId, userId);
        conn.commit();
        String displayName = SmaIncomingStatusHelper.resolveIncomingStatusName(conn, kind, processedId);
        if (displayName == null) {
            displayName = "Обработано";
        }
        String esc = displayName.replace("\\", "\\\\").replace("\"", "\\\"");
        response.getWriter().print("{\"ok\":true,\"newStatus\":\"" + esc + "\",\"newStatusId\":" + processedId + "}");
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

    private static void fail(Connection conn, HttpServletResponse response, int status, String msg) throws IOException {
        DatabaseUtil.rollbackQuietly(conn);
        sendJsonError(response, status, msg);
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        if (response.isCommitted()) {
            return;
        }
        response.setStatus(status);
        String escaped = message != null ? message.replace("\\", "\\\\").replace("\"", "\\\"") : "Unknown error";
        response.getWriter().print("{\"error\":\"" + escaped + "\"}");
    }
}
