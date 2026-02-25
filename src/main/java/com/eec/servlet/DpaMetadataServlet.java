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

/**
 * Сервлет для получения метаданных карты из вью VW_DPA (шапка карты).
 * GET /api/dpa/metadata/{DPAID}
 * Возвращает JSON: incidentId, alertCountryName, dpaVersion, datasourceKindName,
 * creationDateTime, modificationDateTime, dpaStatusId, dpaStatusName.
 */
public class DpaMetadataServlet extends HttpServlet {

    private static final String SQL = ""
            + "SELECT vw.INCIDENTID, vw.ALERTCOUNTRYNAME, vw.DPAVERSION, t1.DATASOURCEKINDNAME, "
            + "       vw.CREATIONDATETIME, vw.MODIFICATIONDATETIME, vw.DPASTATUSID, vw.DPASTATUSNAME "
            + "FROM VW_DPA vw "
            + "LEFT JOIN DATASOURCEKIND t1 ON vw.DATASOURCEKINDCODE = t1.DATASOURCEKINDCODE "
            + "WHERE vw.DPAID = ?";

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[DpaMetadataServlet] Initialized");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите DPAID в пути: /api/dpa/metadata/{DPAID}");
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
            if (!rs.next()) {
                sendJsonError(response, HttpServletResponse.SC_NOT_FOUND, "Запись с DPAID " + dpaidStr + " не найдена в VW_DPA");
                return;
            }

            String incidentId = getString(rs, "INCIDENTID");
            String alertCountryName = getString(rs, "ALERTCOUNTRYNAME");
            Integer dpaVersion = getInt(rs, "DPAVERSION");
            String datasourceKindName = getString(rs, "DATASOURCEKINDNAME");
            String creationDateTime = formatTimestamp(rs, "CREATIONDATETIME");
            String modificationDateTime = formatTimestamp(rs, "MODIFICATIONDATETIME");
            Integer dpaStatusId = getInt(rs, "DPASTATUSID");
            String dpaStatusName = getString(rs, "DPASTATUSNAME");

            StringBuilder json = new StringBuilder();
            json.append("{");
            json.append("\"incidentId\":").append(quote(incidentId));
            json.append(",\"alertCountryName\":").append(quote(alertCountryName));
            json.append(",\"dpaVersion\":").append(dpaVersion != null ? dpaVersion : "null");
            json.append(",\"datasourceKindName\":").append(quote(datasourceKindName));
            json.append(",\"creationDateTime\":").append(quote(creationDateTime));
            json.append(",\"modificationDateTime\":").append(quote(modificationDateTime));
            json.append(",\"dpaStatusId\":").append(dpaStatusId != null ? dpaStatusId : "null");
            json.append(",\"dpaStatusName\":").append(quote(dpaStatusName));
            json.append("}");

            response.setStatus(HttpServletResponse.SC_OK);
            PrintWriter out = response.getWriter();
            out.write(json.toString());
            out.flush();
            System.out.println("[DpaMetadataServlet] Served metadata for DPAID: " + dpaidStr);

        } catch (SQLException e) {
            System.err.println("[DpaMetadataServlet] DB error for DPAID " + dpaidStr + ": " + e.getMessage());
            e.printStackTrace();
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            if (rs != null) try { rs.close(); } catch (SQLException ignored) { }
            if (ps != null) try { ps.close(); } catch (SQLException ignored) { }
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static String getString(ResultSet rs, String column) throws SQLException {
        try {
            return rs.getString(column);
        } catch (SQLException e) {
            return null;
        }
    }

    private static Integer getInt(ResultSet rs, String column) throws SQLException {
        try {
            int v = rs.getInt(column);
            return rs.wasNull() ? null : v;
        } catch (SQLException e) {
            return null;
        }
    }

    private static String formatTimestamp(ResultSet rs, String column) throws SQLException {
        try {
            Timestamp ts = rs.getTimestamp(column);
            if (ts == null) return null;
            return ts.toInstant().toString();
        } catch (SQLException e) {
            return null;
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
