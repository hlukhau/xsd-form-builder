package com.eec.servlet.dpr;

import com.eec.util.DatabaseUtil;
import com.eec.util.DprAccessHelper;

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
 * История статусов DPR.
 * GET /api/dpr/status-history/{DPRID}?guid=...
 */
public class DprStatusHistoryServlet extends HttpServlet {

    private static final String SQL = ""
            + "SELECT st.DPRSTATUSNAME, hs.DPRSTATUSDATETIME, ep.EMPCODE "
            + "FROM DPRSTATUSHIST hs "
            + "JOIN DPRSTATUS st ON st.DPRSTATUSID = hs.DPRSTATUSID "
            + "LEFT JOIN TB_USER us ON hs.USERID = us.USERID "
            + "LEFT JOIN TB_EMP ep ON ep.EMPID = us.EMPID "
            + "WHERE hs.DPRID = ? "
            + "ORDER BY hs.DPRSTATUSDATETIME";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите DPRID: /api/dpr/status-history/{DPRID}");
            return;
        }

        String idStr = pathInfo.startsWith("/") ? pathInfo.substring(1).trim() : pathInfo.trim();
        String guid = request.getParameter("guid");
        if (guid != null) guid = guid.trim();
        if (guid == null || guid.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid");
            return;
        }

        long dprId;
        try {
            dprId = Long.parseLong(idStr);
        } catch (NumberFormatException e) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный DPRID");
            return;
        }

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            if (!DprAccessHelper.canViewDpr(conn, dprId, guid)) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет доступа.");
                return;
            }

            List<String> items = new ArrayList<>();
            try (PreparedStatement ps = conn.prepareStatement(SQL)) {
                ps.setLong(1, dprId);
                ResultSet rs = ps.executeQuery();
                while (rs.next()) {
                    String status = rs.getString("DPRSTATUSNAME");
                    Timestamp ts = rs.getTimestamp("DPRSTATUSDATETIME");
                    String employee = rs.getString("EMPCODE");
                    if (rs.wasNull()) employee = null;
                    String dateTime = ts != null ? ts.toInstant().toString() : null;
                    items.add(jsonItem(status, dateTime, employee));
                }
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
        } catch (SQLException e) {
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static String jsonItem(String status, String dateTime, String employee) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"status\":").append(quote(status));
        sb.append(",\"dateTime\":").append(quote(dateTime));
        sb.append(",\"employee\":").append(quote(employee));
        sb.append("}");
        return sb.toString();
    }

    private static String quote(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }

    private static void sendJsonError(HttpServletResponse response, int status, String msg) throws IOException {
        response.setStatus(status);
        response.getWriter().print("{\"error\":\"" + msg.replace("\"", "'") + "\"}");
    }
}
