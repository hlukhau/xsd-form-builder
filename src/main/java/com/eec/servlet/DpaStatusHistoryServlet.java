package com.eec.servlet;

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
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

/**
 * История смены статусов карты из DPASTATUSHIST.
 * GET /api/dpa/status-history/{DPAID}
 * Возвращает JSON: [{ "status", "dateTime", "employee" }].
 * Сотрудник пустой, если смена была автоматической (нет привязки к пользователю).
 */
public class DpaStatusHistoryServlet extends HttpServlet {

    /** LEFT JOIN для USER/EMP — при автоматической смене (нет USERID) строка всё равно попадает в выборку */
    private static final String SQL = ""
            + "SELECT st.DPASTATUSNAME, hs.DPASTATUSDATETIME, ep.EMPCODE "
            + "FROM SESINT.DPASTATUSHIST hs "
            + "JOIN SESINT.DPASTATUS st ON st.DPASTATUSID = hs.DPASTATUSID "
            + "LEFT JOIN SESDEV.TB_USER us ON hs.USERID = us.USERID "
            + "LEFT JOIN SESDEV.TB_EMP ep ON ep.EMPID = us.EMPID "
            + "WHERE hs.DPAID = ? "
            + "ORDER BY hs.DPASTATUSDATETIME";

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[DpaStatusHistoryServlet] Initialized");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите DPAID: /api/dpa/status-history/{DPAID}");
            return;
        }

        String dpaidStr = pathInfo.startsWith("/") ? pathInfo.substring(1) : pathInfo;
        if (dpaidStr.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "DPAID не задан");
            return;
        }

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;

        try {
            conn = DatabaseUtil.getConnection();
            ps = conn.prepareStatement(SQL);
            try {
                ps.setLong(1, Long.parseLong(dpaidStr));
            } catch (NumberFormatException e) {
                ps.setString(1, dpaidStr);
            }

            rs = ps.executeQuery();
            List<String> items = new ArrayList<>();

            while (rs.next()) {
                String status = rs.getString("DPASTATUSNAME");
                Timestamp ts = rs.getTimestamp("DPASTATUSDATETIME");
                String employee = rs.getString("EMPCODE");
                if (rs.wasNull()) {
                    employee = null;
                }

                String dateTime = ts != null ? ts.toInstant().toString() : null;
                items.add(jsonItem(status, dateTime, employee));
            }

            response.setStatus(HttpServletResponse.SC_OK);
            PrintWriter out = response.getWriter();
            out.write("[");
            for (int i = 0; i < items.size(); i++) {
                if (i > 0) out.write(",");
                out.write(items.get(i));
            }
            out.write("]");
            out.flush();
            System.out.println("[DpaStatusHistoryServlet] Served " + items.size() + " items for DPAID: " + dpaidStr);

        } catch (SQLException e) {
            System.err.println("[DpaStatusHistoryServlet] DB error for DPAID " + dpaidStr + ": " + e.getMessage());
            e.printStackTrace();
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            if (rs != null) try { rs.close(); } catch (SQLException ignored) { }
            if (ps != null) try { ps.close(); } catch (SQLException ignored) { }
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static String jsonItem(String status, String dateTime, String employee) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"status\":").append(quote(status));
        sb.append(",\"dateTime\":").append(quote(dateTime));
        sb.append(",\"employee\":").append(employee == null ? "null" : quote(employee));
        sb.append("}");
        return sb.toString();
    }

    private static String quote(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        String escaped = message != null ? message.replace("\\", "\\\\").replace("\"", "\\\"") : "Unknown error";
        response.getWriter().print("{\"error\":\"" + escaped + "\"}");
    }
}
