package com.eec.servlet.sma;

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
 * История смены статуса SMAQ/SMAR.
 * GET /api/sma/status-history/{kind}/{id}?guid=...
 */
public class SmaStatusHistoryServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        SmaPathIds ids = SmaServletUtil.parseKindAndId(request.getPathInfo());
        if (ids == null) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Укажите вид и идентификатор: /api/sma/status-history/{smaq|smar}/{id}");
            return;
        }
        String guid = request.getParameter("guid");
        if (guid != null) {
            guid = guid.trim();
        }
        if (guid == null || guid.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid");
            return;
        }

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            if (!canView(conn, ids.kind, ids.id, guid)) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет доступа.");
                return;
            }

            String sql = ids.kind == SmaCardKind.SMAQ
                    ? SmaDbSupport.SQL_SMAQ_STATUS_HISTORY
                    : SmaDbSupport.SQL_SMAR_STATUS_HISTORY;
            String statusCol = ids.kind == SmaCardKind.SMAQ ? "SMAQSTATUSNAME" : "SMARSTATUSNAME";
            String dtCol = ids.kind == SmaCardKind.SMAQ ? "SMAQSTATUSDATETIME" : "SMARSTATUSDATETIME";

            List<String> items = new ArrayList<>();
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setLong(1, ids.id);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        String status = rs.getString(statusCol);
                        Timestamp ts = rs.getTimestamp(dtCol);
                        String employee = rs.getString("EMPCODE");
                        if (rs.wasNull()) {
                            employee = null;
                        } else if (employee != null && employee.trim().isEmpty()) {
                            employee = null;
                        }
                        String dateTime = ts != null ? ts.toInstant().toString() : null;
                        items.add(jsonItem(status, dateTime, employee));
                    }
                }
            }

            PrintWriter out = response.getWriter();
            out.write("[");
            for (int i = 0; i < items.size(); i++) {
                if (i > 0) {
                    out.write(",");
                }
                out.write(items.get(i));
            }
            out.write("]");
        } catch (SQLException e) {
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static boolean canView(Connection conn, SmaCardKind kind, long id, String guid) throws SQLException {
        return kind == SmaCardKind.SMAQ
                ? SmaAccessHelper.canViewSmaq(conn, id, guid)
                : SmaAccessHelper.canViewSmar(conn, id, guid);
    }

    private static String jsonItem(String status, String dateTime, String employee) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"status\":").append(SmaServletUtil.quote(status));
        sb.append(",\"dateTime\":").append(SmaServletUtil.quote(dateTime));
        sb.append(",\"employee\":").append(SmaServletUtil.quote(employee));
        sb.append("}");
        return sb.toString();
    }

    private static void sendJsonError(HttpServletResponse response, int status, String msg) throws IOException {
        response.setStatus(status);
        response.getWriter().print("{\"error\":\"" + msg.replace("\"", "'") + "\"}");
    }
}
