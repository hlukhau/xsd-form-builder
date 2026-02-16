package com.eec.servlet;

import com.eec.util.AccessRightService;
import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.BufferedReader;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Смена статуса карты DPA (входящие: Завершение обработки, Закрытие карты).
 * POST /api/dpa/status — тело JSON { "dpaid": "...", "action": "complete_processing" | "close" }.
 * Проверяется право dangerousProductIn:status для входящих.
 * Обновляется DPA.DPASTATUSID, в DPASTATUSHIST добавляется запись (USERID = null — автоматически).
 */
public class DpaStatusChangeServlet extends HttpServlet {

    /** Текущее состояние: DPAID, DPASTATUSID, DPASTATUSNAME, источник */
    private static final String SQL_CURRENT = ""
            + "SELECT vw.DPAID, vw.DPASTATUSID, vw.DPASTATUSNAME, t.DATASOURCEKINDNAME "
            + "FROM VW_DPA vw "
            + "LEFT JOIN DATASOURCEKIND t ON vw.DATASOURCEKINDCODE = t.DATASOURCEKINDCODE "
            + "WHERE vw.DPAID = ?";
    /** DPASTATUSID по названию статуса */
    private static final String SQL_STATUS_ID = "SELECT DPASTATUSID FROM SESINT.DPASTATUS WHERE TRIM(DPASTATUSNAME) = ?";
    /** Обновление текущего статуса (таблица DPA в той же схеме, что и view — подставьте схему при необходимости) */
    private static final String SQL_UPDATE = "UPDATE SESINT.DPA SET DPASTATUSID = ? WHERE DPAID = ?";
    private static final String SQL_INSERT_HIST = ""
            + "INSERT INTO SESINT.DPASTATUSHIST (DPAID, DPASTATUSID, DPASTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, NULL)";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String body = readBody(request);
        String dpaid = extractJsonString(body, "dpaid");
        String action = extractJsonString(body, "action");
        if (dpaid == null || dpaid.trim().isEmpty() || action == null || action.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Нужны dpaid и action");
            return;
        }
        dpaid = dpaid.trim();
        action = action.trim();

        if (!AccessRightService.hasDangerousProductInStatus(dpaid)) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права управления статусом входящих сведений");
            return;
        }

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
            if (!incoming) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Смена статуса по действию доступна только для входящих сведений");
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

            ps = conn.prepareStatement(SQL_STATUS_ID);
            ps.setString(1, newStatusName);
            rs = ps.executeQuery();
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
        } catch (SQLException e) {
            log("DpaStatusChange: " + e.getMessage());
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
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
