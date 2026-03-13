package com.eec.servlet;

import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.Reader;
import java.sql.Clob;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

/**
 * Сведения об электронных документах и записи общего ресурса по DPAID.
 * GET /api/dpa/electronic-docs/{DPAID}
 * Источники: DPA + DPA2EDOCLINK + EDOC, CONTENTBODY из VW_PACKAGEMESSAGE (XML: EDocHeader, ResourceItemStatusDetails).
 */
public class DpaElectronicDocsServlet extends HttpServlet {

    private static final String SQL = ""
            + "SELECT dc.INFENVELOPECODE, dc.EDOCCODE, dc.EDOCID, dc.EDOCDATETIME, dc.LANGUAGECODE, dc.EDOCREFID, ms.CONTENTBODY "
            + "FROM SESINT.DPA dp "
            + "JOIN SESINT.DPA2EDOCLINK dpe ON dpe.DPAID = dp.DPAID "
            + "JOIN SESINT.EDOC dc ON dc.EDOCID = dpe.EDOCID "
            + "LEFT JOIN SESINT.VW_PACKAGEMESSAGE ms ON ms.EDOCID = dpe.EDOCID "
            + "WHERE dp.DPAID = ? "
            + "ORDER BY dc.EDOCDATETIME";

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[DpaElectronicDocsServlet] Initialized");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите DPAID: /api/dpa/electronic-docs/{DPAID}");
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
            conn = DatabaseUtil.getConnectionForRequest(request);
            ps = conn.prepareStatement(SQL);
            try {
                ps.setLong(1, Long.parseLong(dpaidStr));
            } catch (NumberFormatException e) {
                ps.setString(1, dpaidStr);
            }

            rs = ps.executeQuery();
            List<String> items = new ArrayList<>();

            while (rs.next()) {
                String messageCode = getString(rs, "INFENVELOPECODE");
                String documentCode = getString(rs, "EDOCCODE");
                String documentId = getString(rs, "EDOCID");
                String documentDate = formatTimestamp(rs, "EDOCDATETIME");
                String language = getString(rs, "LANGUAGECODE");
                String sourceDocumentId = getString(rs, "EDOCREFID");
                String contentBody = getClobAsString(rs, "CONTENTBODY");

                items.add(jsonItem(messageCode, documentCode, documentId, documentDate, language, sourceDocumentId, contentBody));
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
            System.out.println("[DpaElectronicDocsServlet] Served " + items.size() + " doc(s) for DPAID: " + dpaidStr);

        } catch (SQLException e) {
            System.err.println("[DpaElectronicDocsServlet] DB error for DPAID " + dpaidStr + ": " + e.getMessage());
            e.printStackTrace();
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            if (rs != null) try { rs.close(); } catch (SQLException ignored) { }
            if (ps != null) try { ps.close(); } catch (SQLException ignored) { }
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static String getString(ResultSet rs, String col) throws SQLException {
        try {
            String s = rs.getString(col);
            return rs.wasNull() ? null : s;
        } catch (SQLException e) {
            return null;
        }
    }

    private static String formatTimestamp(ResultSet rs, String col) throws SQLException {
        try {
            Timestamp ts = rs.getTimestamp(col);
            return ts == null ? null : ts.toInstant().toString();
        } catch (SQLException e) {
            return null;
        }
    }

    private static String getClobAsString(ResultSet rs, String col) throws SQLException {
        try {
            Clob clob = rs.getClob(col);
            if (clob == null) return null;
            Reader r = clob.getCharacterStream();
            StringBuilder sb = new StringBuilder();
            char[] buf = new char[8192];
            int n;
            try {
                while ((n = r.read(buf)) >= 0) sb.append(buf, 0, n);
            } finally {
                try {
                    r.close();
                } catch (IOException ignored) { }
            }
            return sb.toString();
        } catch (IOException e) {
            throw new SQLException("Error reading CLOB: " + e.getMessage(), e);
        } catch (SQLException e) {
            try {
                return rs.getString(col);
            } catch (SQLException e2) {
                return null;
            }
        }
    }

    private static String jsonItem(String messageCode, String documentCode, String documentId,
                                   String documentDate, String language, String sourceDocumentId, String contentBody) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"messageCode\":").append(quote(messageCode));
        sb.append(",\"documentCode\":").append(quote(documentCode));
        sb.append(",\"documentId\":").append(quote(documentId));
        sb.append(",\"documentDate\":").append(quote(documentDate));
        sb.append(",\"language\":").append(quote(language));
        sb.append(",\"sourceDocumentId\":").append(quote(sourceDocumentId));
        sb.append(",\"contentBody\":").append(contentBody == null ? "null" : quoteContentBody(contentBody));
        sb.append("}");
        return sb.toString();
    }

    private static String quote(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }

    /** Экранирование для JSON-строки с XML (сохраняем \n \r как \\n \\r) */
    private static String quoteContentBody(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r") + "\"";
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        String escaped = message != null ? message.replace("\\", "\\\\").replace("\"", "\\\"") : "Unknown error";
        response.getWriter().print("{\"error\":\"" + escaped + "\"}");
    }
}
