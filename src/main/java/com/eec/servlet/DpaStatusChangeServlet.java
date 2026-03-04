package com.eec.servlet;

import com.eec.util.AccessRightService;
import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.BufferedReader;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Смена статуса карты DPA.
 * Входящие: action complete_processing | close, право dangerousProductIn:status.
 * Исходящие: action mark_ready | send | close; mark_ready/close — dangerousProductOut:status, send — dangerousProductOut:send.
 * mark_ready: тело { "dpaid", "action": "mark_ready", "depKindCode": "dep0601"|"dep0602"|"dep0603" }.
 * Обновляется DPA.DPASTATUSID, DPASTATUSHIST (и при mark_ready — DPARESOLUTION).
 */
public class DpaStatusChangeServlet extends HttpServlet {

    private static final int OUTGOING_DRAFT = 5;
    private static final int OUTGOING_NEW = 6;
    private static final int OUTGOING_PENDING = 7;
    private static final int OUTGOING_FAILED = 9;
    private static final int OUTGOING_ERROR = 10;
    private static final int OUTGOING_DELIVERED = 11;
    private static final int OUTGOING_EDITED = 12;
    private static final int OUTGOING_COMPLETED = 13;

    /** Текущее состояние: DPAID, DPASTATUSID, DPASTATUSNAME, источник */
    private static final String SQL_CURRENT = ""
            + "SELECT vw.DPAID, vw.DPASTATUSID, vw.DPASTATUSNAME, t.DATASOURCEKINDNAME "
            + "FROM VW_DPA vw "
            + "LEFT JOIN DATASOURCEKIND t ON vw.DATASOURCEKINDCODE = t.DATASOURCEKINDCODE "
            + "WHERE vw.DPAID = ?";
    /** DPASTATUSID по названию статуса */
    private static final String SQL_STATUS_ID = "SELECT DPASTATUSID FROM SESINT.DPASTATUS WHERE TRIM(DPASTATUSNAME) = ?";
    private static final String SQL_UPDATE = "UPDATE SESINT.DPA SET DPASTATUSID = ? WHERE DPAID = ?";
    private static final String SQL_INSERT_HIST = ""
            + "INSERT INTO SESINT.DPASTATUSHIST (DPAID, DPASTATUSID, DPASTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, NULL)";
    /** DEPKINDID по DEPKINDCODE (SESDEV.TB_DEPKIND) */
    private static final String SQL_DEPKIND_ID = "SELECT DEPKINDID FROM SESDEV.TB_DEPKIND WHERE TRIM(UPPER(DEPKINDCODE)) = TRIM(UPPER(?))";
    /** Вставка резолюции (для mark_ready). При дубликате (DPAID,DEPKINDID) — игнорируем. */
    private static final String SQL_INSERT_RESOLUTION = ""
            + "INSERT INTO SESINT.DPARESOLUTION (DPAID, DEPKINDID, RESOLUTIONDATETIME, USERID) VALUES (?, ?, SYSDATE, NULL)";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String body = readBody(request);
        String dpaid = extractJsonString(body, "dpaid");
        String action = extractJsonString(body, "action");
        String depKindCode = extractJsonString(body, "depKindCode");
        if (dpaid == null || dpaid.trim().isEmpty() || action == null || action.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Нужны dpaid и action");
            return;
        }
        dpaid = dpaid.trim();
        action = action.trim();
        if (depKindCode != null) depKindCode = depKindCode.trim();

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnection();
            int currentStatusId = -1;
            String currentStatusName = null;
            String sourceName = null;
            PreparedStatement ps = conn.prepareStatement(SQL_CURRENT);
            bindDpaid(ps, 1, dpaid);
            ResultSet rs = ps.executeQuery();
            if (!rs.next()) {
                sendJsonError(response, HttpServletResponse.SC_NOT_FOUND, "Карта с DPAID " + dpaid + " не найдена");
                return;
            }
            currentStatusId = rs.getInt("DPASTATUSID");
            currentStatusName = rs.getString("DPASTATUSNAME");
            sourceName = rs.getString("DATASOURCEKINDNAME");
            rs.close();
            ps.close();

            boolean incoming = sourceName != null && sourceName.toLowerCase().contains("входящ");
            boolean outgoing = sourceName != null && sourceName.toLowerCase().contains("исходящ");

            if (incoming) {
                handleIncoming(response, conn, dpaid, action, currentStatusId, currentStatusName);
                return;
            }
            if (outgoing) {
                handleOutgoing(response, conn, dpaid, action, depKindCode, currentStatusId, currentStatusName);
                return;
            }
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Смена статуса по действию доступна только для входящих или исходящих сведений");
        } catch (SQLException e) {
            log("DpaStatusChange: " + e.getMessage());
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private void handleIncoming(HttpServletResponse response, Connection conn, String dpaid, String action,
                                int currentStatusId, String currentStatusName) throws IOException, SQLException {
        if (!AccessRightService.hasDangerousProductInStatus(dpaid)) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права управления статусом входящих сведений");
            return;
        }
        String newStatusName = null;
        if ("complete_processing".equals(action)) {
            if (currentStatusName == null || !currentStatusName.toLowerCase().contains("обработке")) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Действие «Завершение обработки» возможно только при статусе «В обработке»");
                return;
            }
            newStatusName = "Обработано";
        } else if ("close".equals(action)) {
            if (currentStatusName == null || !currentStatusName.toLowerCase().contains("обработано")) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Действие «Закрытие карты» возможно только при статусе «Обработано»");
                return;
            }
            newStatusName = "Завершено";
        } else {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Неизвестное действие: " + action);
            return;
        }
        applyNewStatus(response, conn, dpaid, newStatusName);
    }

    private void handleOutgoing(HttpServletResponse response, Connection conn,
                                String dpaid, String action, String depKindCode,
                                int currentStatusId, String currentStatusName) throws IOException, SQLException {
        if ("mark_ready".equals(action)) {
            if (!AccessRightService.hasDangerousProductOutStatus(dpaid)) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права управления статусом исходящих сведений (dangerousProductOut:status)");
                return;
            }
            if (depKindCode == null || depKindCode.isEmpty()) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Для действия «Отметка готовности» укажите depKindCode (уровень ЦГЭ)");
                return;
            }
            int depKindId = resolveDepKindId(conn, depKindCode);
            if (depKindId <= 0) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Неизвестный код подразделения (depKindCode): " + depKindCode);
                return;
            }
            if (currentStatusId == OUTGOING_DRAFT) {
                try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE)) {
                    ps.setInt(1, OUTGOING_NEW);
                    bindDpaid(ps, 2, dpaid);
                    ps.executeUpdate();
                }
                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                    bindDpaid(ps, 1, dpaid);
                    ps.setInt(2, OUTGOING_NEW);
                    ps.executeUpdate();
                }
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_RESOLUTION)) {
                bindDpaid(ps, 1, dpaid);
                ps.setInt(2, depKindId);
                ps.executeUpdate();
            } catch (SQLException e) {
                String msg = e.getMessage();
                if (msg != null && (msg.contains("ORA-00001") || msg.contains("unique") || msg.contains("Unique"))) {
                    response.getWriter().print("{\"ok\":true,\"newStatus\":\"Новое\"}");
                    return;
                }
                throw e;
            }
            response.getWriter().print("{\"ok\":true,\"newStatus\":\"Новое\"}");
            return;
        }
        if ("send".equals(action)) {
            if (!AccessRightService.hasDangerousProductOutSend(dpaid)) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права на направление исходящих сведений (dangerousProductOut:send)");
                return;
            }
            if (currentStatusId != OUTGOING_NEW && currentStatusId != OUTGOING_FAILED && currentStatusId != OUTGOING_ERROR && currentStatusId != OUTGOING_EDITED) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Действие «Направление сведений» возможно только при статусе «Новое», «Отправка не удалась», «Ошибка обработки» или «Отредактировано»");
                return;
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE)) {
                ps.setInt(1, OUTGOING_PENDING);
                bindDpaid(ps, 2, dpaid);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                bindDpaid(ps, 1, dpaid);
                ps.setInt(2, OUTGOING_PENDING);
                ps.executeUpdate();
            }
            response.getWriter().print("{\"ok\":true,\"newStatus\":\"Ожидает отправки\"}");
            return;
        }
        if ("close".equals(action)) {
            if (!AccessRightService.hasDangerousProductOutStatus(dpaid)) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права управления статусом исходящих сведений (dangerousProductOut:status)");
                return;
            }
            if (currentStatusId != OUTGOING_NEW && currentStatusId != OUTGOING_FAILED && currentStatusId != OUTGOING_ERROR && currentStatusId != OUTGOING_EDITED && currentStatusId != OUTGOING_DELIVERED) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Действие «Закрытие карты» возможно только при статусе «Новое», «Отправка не удалась», «Ошибка обработки», «Отредактировано» или «Доставлено»");
                return;
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE)) {
                ps.setInt(1, OUTGOING_COMPLETED);
                bindDpaid(ps, 2, dpaid);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                bindDpaid(ps, 1, dpaid);
                ps.setInt(2, OUTGOING_COMPLETED);
                ps.executeUpdate();
            }
            response.getWriter().print("{\"ok\":true,\"newStatus\":\"Завершено\"}");
            return;
        }
        sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Неизвестное действие для исходящих: " + action);
    }

    private static int resolveDepKindId(Connection conn, String depKindCode) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_DEPKIND_ID)) {
            ps.setString(1, depKindCode);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                return rs.getInt(1);
            }
        }
        return -1;
    }

    private void applyNewStatus(HttpServletResponse response, Connection conn, String dpaid, String newStatusName) throws IOException, SQLException {
        PreparedStatement ps = conn.prepareStatement(SQL_STATUS_ID);
        ps.setString(1, newStatusName);
        ResultSet rs = ps.executeQuery();
        if (!rs.next()) {
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Статус «" + newStatusName + "» не найден в DPASTATUS");
            return;
        }
        int newStatusId = rs.getInt("DPASTATUSID");
        rs.close();
        ps.close();
        ps = conn.prepareStatement(SQL_UPDATE);
        ps.setInt(1, newStatusId);
        bindDpaid(ps, 2, dpaid);
        int updated = ps.executeUpdate();
        ps.close();
        if (updated == 0) {
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Не удалось обновить статус карты");
            return;
        }
        ps = conn.prepareStatement(SQL_INSERT_HIST);
        bindDpaid(ps, 1, dpaid);
        ps.setInt(2, newStatusId);
        ps.executeUpdate();
        ps.close();
        response.getWriter().print("{\"ok\":true,\"newStatus\":\"" + escapeJson(newStatusName) + "\"}");
    }

    private static String readBody(HttpServletRequest request) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = request.getReader()) {
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
        }
        return sb.toString();
    }

    private static String extractJsonString(String json, String key) {
        Pattern p = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher m = p.matcher(json);
        return m.find() ? m.group(1) : null;
    }

    private static void bindDpaid(PreparedStatement ps, int index, String dpaid) throws SQLException {
        try {
            ps.setLong(index, Long.parseLong(dpaid));
        } catch (NumberFormatException e) {
            ps.setString(index, dpaid);
        }
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        String escaped = message != null ? message.replace("\\", "\\\\").replace("\"", "\\\"") : "Unknown error";
        response.getWriter().print("{\"error\":\"" + escaped + "\"}");
    }
}
