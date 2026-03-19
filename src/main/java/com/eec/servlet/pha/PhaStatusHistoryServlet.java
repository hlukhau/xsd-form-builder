package com.eec.servlet.pha;

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
 * История смены статусов карты PHA из таблицы PHASTATUSHIST.
 * GET /api/pha/status-history/{PHAID}
 * Возвращает JSON: [{ "status", "dateTime", "employee" }].
 * Сотрудник пустой, если смена была автоматической.
 */
public class PhaStatusHistoryServlet extends HttpServlet {

    private static final String SQL = ""
            + "SELECT s.PHASTATUSNAME, hs.PHASTATUSDATETIME, ep.EMPCODE "
            + "FROM PHASTATUSHIST hs "
            + "JOIN PHASTATUS s ON s.PHASTATUSID = hs.PHASTATUSID "
            + "LEFT JOIN TB_USER us ON hs.USERID = us.USERID "
            + "LEFT JOIN TB_EMP ep ON ep.EMPID = us.EMPID "
            + "WHERE hs.PHAID = ? "
            + "ORDER BY hs.PHASTATUSDATETIME";

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[PhaStatusHistoryServlet] Initialized");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите PHAID: /api/pha/status-history/{PHAID}");
            return;
        }

        String phaidStr = pathInfo.startsWith("/") ? pathInfo.substring(1) : pathInfo;
        if (phaidStr.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "PHAID не задан");
            return;
        }

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;

        try {
            conn = DatabaseUtil.getConnectionForRequest(request);
            long phaId = Long.parseLong(phaidStr.trim());
            ps = conn.prepareStatement(SQL);
            ps.setLong(1, phaId);

            rs = ps.executeQuery();
            List<String> items = new ArrayList<>();

            while (rs.next()) {
                String status = rs.getString("PHASTATUSNAME");
                Timestamp ts = rs.getTimestamp("PHASTATUSDATETIME");
                String employee = rs.getString("EMPCODE");
                if (rs.wasNull()) {
                    employee = null;
                }
                if (status != null) status = status.trim();
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
            System.out.println("[PhaStatusHistoryServlet] Served " + items.size() + " items for PHAID: " + phaidStr);

        } catch (NumberFormatException e) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный PHAID: " + phaidStr);
        } catch (SQLException e) {
            System.err.println("[PhaStatusHistoryServlet] DB error for PHAID " + phaidStr + ": " + e.getMessage());
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
