package com.eec.servlet.smd;

import com.eec.util.DatabaseUtil;
import com.eec.util.ServletRequestGuid;

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
 * История смены статусов карты SMD: SMDSTATUSHIST / SESINT.SMDSTATUSHIST.
 * GET /api/smd/status-history/{SMDID}?guid=...
 * Подключение к БД — по кредам из JSON прав (реестр GUID).
 * Возвращает JSON: [{ "status", "dateTime", "employee" }].
 */
public class SmdStatusHistoryServlet extends HttpServlet {

    private static final String[] SQL_STATUS_HISTORY_CHAIN = {
            SmdDbSupport.SQL_STATUS_HISTORY,
            SmdDbSupport.SQL_STATUS_HISTORY_SESINT,
            SmdDbSupport.SQL_STATUS_HISTORY_SESINT_MINIMAL,
    };

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[SmdStatusHistoryServlet] Initialized");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите SMDID: /api/smd/status-history/{SMDID}");
            return;
        }

        String smdidStr = pathInfo.startsWith("/") ? pathInfo.substring(1).trim() : pathInfo.trim();
        if (smdidStr.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "SMDID не задан");
            return;
        }

        String guid = ServletRequestGuid.resolve(request);
        if (guid == null) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Укажите guid в query (?guid=...) или заголовок X-GUID");
            return;
        }

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;

        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            long smdid = parseSmdid(smdidStr, response);
            if (smdid < 0) {
                return;
            }

            List<String> items = loadStatusHistory(conn, smdid);

            response.setStatus(HttpServletResponse.SC_OK);
            PrintWriter out = response.getWriter();
            out.write("[");
            for (int i = 0; i < items.size(); i++) {
                if (i > 0) {
                    out.write(",");
                }
                out.write(items.get(i));
            }
            out.write("]");
            out.flush();
            System.out.println("[SmdStatusHistoryServlet] Served " + items.size() + " items for SMDID: " + smdidStr);

        } catch (SQLException e) {
            if (SmdDbSupport.isMissingObject(e)) {
                System.out.println("[SmdStatusHistoryServlet] Status history tables not available for SMDID "
                        + smdidStr + ", returning empty list");
                writeEmptyArray(response);
                return;
            }
            System.err.println("[SmdStatusHistoryServlet] DB error for SMDID " + smdidStr + ": " + e.getMessage());
            e.printStackTrace();
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static List<String> loadStatusHistory(Connection conn, long smdid) throws SQLException {
        SQLException last = null;
        for (String sql : SQL_STATUS_HISTORY_CHAIN) {
            try {
                return queryStatusHistory(conn, smdid, sql);
            } catch (SQLException e) {
                last = e;
                if (!SmdDbSupport.isMissingObject(e)) {
                    throw e;
                }
            }
        }
        if (last != null) {
            throw last;
        }
        return new ArrayList<>();
    }

    private static List<String> queryStatusHistory(Connection conn, long smdid, String sql) throws SQLException {
        List<String> items = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String status = rs.getString("SMDSTATUSNAME");
                    Timestamp ts = rs.getTimestamp("SMDSTATUSDATETIME");
                    String employee = rs.getString("EMPCODE");
                    if (rs.wasNull()) {
                        employee = null;
                    }
                    if (status != null) {
                        status = status.trim();
                    }
                    String dateTime = ts != null ? ts.toInstant().toString() : null;
                    items.add(jsonItem(status, dateTime, employee));
                }
            }
        }
        return items;
    }

    private static long parseSmdid(String smdidStr, HttpServletResponse response) throws IOException {
        try {
            return Long.parseLong(smdidStr.trim());
        } catch (NumberFormatException e) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный SMDID: " + smdidStr);
            return -1;
        }
    }

    private static void writeEmptyArray(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_OK);
        response.getWriter().write("[]");
        response.getWriter().flush();
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
        if (s == null) {
            return "null";
        }
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        String escaped = message != null ? message.replace("\\", "\\\\").replace("\"", "\\\"") : "Unknown error";
        response.getWriter().print("{\"error\":\"" + escaped + "\"}");
    }
}
