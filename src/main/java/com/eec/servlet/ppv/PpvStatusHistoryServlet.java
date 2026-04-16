package com.eec.servlet.ppv;

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
 * История смены статусов карты и резолюций: PPVSTATUSHIST + PPVRESOLUTION.
 * GET /api/ppv/status-history/{PPVID}
 * Возвращает JSON: [{ "status", "dateTime", "employee" }].
 * Строки резолюций имеют status вида «Резолюция: &lt;уровень&gt;» (DEPKINDNAME).
 * Сотрудник пустой, если смена была автоматической.
 */
public class PpvStatusHistoryServlet extends HttpServlet {

    private static final String SQL = ""
            + "SELECT st.PPVSTATUSNAME, hs.PPVSTATUSDATETIME AS PPVSTATUSDATETIME, ep.EMPCODE "
            + "FROM PPVSTATUSHIST hs "
            + "JOIN PPVSTATUS st ON st.PPVSTATUSID = hs.PPVSTATUSID "
            + "LEFT JOIN TB_USER us ON hs.USERID = us.USERID "
            + "LEFT JOIN TB_EMP ep ON ep.EMPID = us.EMPID "
            + "WHERE hs.PPVID = ? "
            + "UNION ALL "
            + "SELECT 'Резолюция: ' || kn.DEPKINDNAME AS PPVSTATUSNAME, rs.RESOLUTIONDATETIME AS PPVSTATUSDATETIME, ep.EMPCODE "
            + "FROM PPVRESOLUTION rs "
            + "JOIN TB_DEPKIND kn ON kn.DEPKINDID = rs.DEPKINDID "
            + "LEFT JOIN TB_USER us ON rs.USERID = us.USERID "
            + "LEFT JOIN TB_EMP ep ON ep.EMPID = us.EMPID "
            + "WHERE rs.PPVID = ? "
            + "ORDER BY 2";

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[PpvStatusHistoryServlet] Initialized");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите PPVID: /api/ppv/status-history/{PPVID}");
            return;
        }

        String dpaidStr = pathInfo.startsWith("/") ? pathInfo.substring(1) : pathInfo;
        if (dpaidStr.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "PPVID не задан");
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
            ps = conn.prepareStatement(SQL);
            bindDpaid(ps, 1, dpaidStr);
            bindDpaid(ps, 2, dpaidStr);

            rs = ps.executeQuery();
            List<String> items = new ArrayList<>();

            while (rs.next()) {
                String status = rs.getString("PPVSTATUSNAME");
                Timestamp ts = rs.getTimestamp("PPVSTATUSDATETIME");
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
            System.out.println("[PpvStatusHistoryServlet] Served " + items.size() + " items for PPVID: " + dpaidStr);

        } catch (SQLException e) {
            System.err.println("[PpvStatusHistoryServlet] DB error for PPVID " + dpaidStr + ": " + e.getMessage());
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

    private static void bindDpaid(PreparedStatement ps, int index, String dpaid) throws SQLException {
        try {
            ps.setLong(index, Long.parseLong(dpaid.trim()));
        } catch (NumberFormatException e) {
            ps.setString(index, dpaid.trim());
        }
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
