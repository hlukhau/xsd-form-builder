package com.eec.servlet.smr;

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
 * История смены статуса SMR.
 * GET /api/smr/status-history/{SMRID}?guid=...
 */
public class SmrStatusHistoryServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите SMRID: /api/smr/status-history/{SMRID}");
            return;
        }

        String idStr = pathInfo.startsWith("/") ? pathInfo.substring(1).trim() : pathInfo.trim();
        String guid = request.getParameter("guid");
        if (guid != null) guid = guid.trim();
        if (guid == null || guid.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid");
            return;
        }

        long smrId;
        try {
            smrId = Long.parseLong(idStr);
        } catch (NumberFormatException e) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный SMRID");
            return;
        }

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            if (!SmrAccessHelper.canViewSmr(conn, smrId, guid)) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет доступа.");
                return;
            }

            List<String> items = new ArrayList<>();
            try (PreparedStatement ps = conn.prepareStatement(SmrDbSupport.SQL_STATUS_HISTORY)) {
                ps.setLong(1, smrId);
                ps.setLong(2, smrId);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        String status = rs.getString("SMRSTATUSNAME");
                        Timestamp ts = rs.getTimestamp("SMRSTATUSDATETIME");
                        String employee = rs.getString("EMPCODE");
                        if (rs.wasNull()) employee = null;
                        else if (employee != null && employee.trim().isEmpty()) employee = null;
                        String dateTime = ts != null ? ts.toInstant().toString() : null;
                        items.add(jsonItem(status, dateTime, employee));
                    }
                }
            }

            PrintWriter out = response.getWriter();
            out.write("[");
            for (int i = 0; i < items.size(); i++) {
                if (i > 0) out.write(",");
                out.write(items.get(i));
            }
            out.write("]");
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
