package com.eec.servlet.smd;

import com.eec.util.DatabaseUtil;
import com.eec.util.ServletRequestGuid;

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
 * Сведения об электронных документах по SMDID.
 * GET /api/smd/electronic-docs/{SMDID}?guid=...
 * Источники: SMD + SMD2EDOCLINK + EDOC, LANG, CONTENTBODY из VW_PACKAGEMESSAGE (XML: ResourceItemStatusDetails).
 * Сортировка: EDOCDATETIME по убыванию.
 */
public class SmdElectronicDocsServlet extends HttpServlet {

    private static final String SQL = ""
            + "SELECT dc.INFENVELOPECODE, dc.EDOCCODE, dc.EDOCID, dc.EDOCDATETIME, dc.EDOCREFID, "
            + "(dc.LANGUAGECODE || CASE WHEN lg.LANGNAME IS NOT NULL THEN ' - ' || lg.LANGNAME ELSE '' END) AS LNG, "
            + "ms.CONTENTBODY "
            + "FROM SMD sm "
            + "JOIN SMD2EDOCLINK sme ON sme.SMDID = sm.SMDID "
            + "JOIN EDOC dc ON dc.EDOCID = sme.EDOCID "
            + "LEFT OUTER JOIN LANG lg ON lg.LANGALPHA2CODE = dc.LANGUAGECODE "
            + "AND dc.EDOCDATETIME BETWEEN lg.LANGSDATE AND lg.LANGEDATE "
            + "LEFT JOIN VW_PACKAGEMESSAGE ms ON ms.EDOCID = sme.EDOCID "
            + "WHERE sm.SMDID = ? "
            + "ORDER BY dc.EDOCDATETIME DESC";

    private static final String SQL_FALLBACK_NO_MESSAGE_VIEW = ""
            + "SELECT dc.INFENVELOPECODE, dc.EDOCCODE, dc.EDOCID, dc.EDOCDATETIME, dc.EDOCREFID, "
            + "(dc.LANGUAGECODE || CASE WHEN lg.LANGNAME IS NOT NULL THEN ' - ' || lg.LANGNAME ELSE '' END) AS LNG, "
            + "CAST(NULL AS CLOB) AS CONTENTBODY "
            + "FROM SMD sm "
            + "JOIN SMD2EDOCLINK sme ON sme.SMDID = sm.SMDID "
            + "JOIN EDOC dc ON dc.EDOCID = sme.EDOCID "
            + "LEFT OUTER JOIN LANG lg ON lg.LANGALPHA2CODE = dc.LANGUAGECODE "
            + "AND dc.EDOCDATETIME BETWEEN lg.LANGSDATE AND lg.LANGEDATE "
            + "WHERE sm.SMDID = ? "
            + "ORDER BY dc.EDOCDATETIME DESC";

    private static final String SQL_NO_LANG = ""
            + "SELECT dc.INFENVELOPECODE, dc.EDOCCODE, dc.EDOCID, dc.EDOCDATETIME, dc.EDOCREFID, "
            + "dc.LANGUAGECODE AS LNG, ms.CONTENTBODY "
            + "FROM SMD sm "
            + "JOIN SMD2EDOCLINK sme ON sme.SMDID = sm.SMDID "
            + "JOIN EDOC dc ON dc.EDOCID = sme.EDOCID "
            + "LEFT JOIN VW_PACKAGEMESSAGE ms ON ms.EDOCID = sme.EDOCID "
            + "WHERE sm.SMDID = ? "
            + "ORDER BY dc.EDOCDATETIME DESC";

    private static final String SQL_NO_LANG_NO_MESSAGE_VIEW = ""
            + "SELECT dc.INFENVELOPECODE, dc.EDOCCODE, dc.EDOCID, dc.EDOCDATETIME, dc.EDOCREFID, "
            + "dc.LANGUAGECODE AS LNG, CAST(NULL AS CLOB) AS CONTENTBODY "
            + "FROM SMD sm "
            + "JOIN SMD2EDOCLINK sme ON sme.SMDID = sm.SMDID "
            + "JOIN EDOC dc ON dc.EDOCID = sme.EDOCID "
            + "WHERE sm.SMDID = ? "
            + "ORDER BY dc.EDOCDATETIME DESC";

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[SmdElectronicDocsServlet] Initialized");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Укажите SMDID: /api/smd/electronic-docs/{SMDID}");
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
        PreparedStatement ps = null;
        ResultSet rs = null;

        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            long smdid = parseSmdid(smdidStr, response);
            if (smdid < 0) {
                return;
            }

            String[] sqlVariants = new String[] {
                    SQL,
                    SQL_FALLBACK_NO_MESSAGE_VIEW,
                    SQL_NO_LANG,
                    SQL_NO_LANG_NO_MESSAGE_VIEW,
            };
            SQLException last942 = null;
            for (int si = 0; si < sqlVariants.length; si++) {
                if (ps != null) try { ps.close(); } catch (SQLException ignored) { }
                ps = null;
                if (rs != null) try { rs.close(); } catch (SQLException ignored) { }
                rs = null;
                try {
                    ps = conn.prepareStatement(sqlVariants[si]);
                    ps.setLong(1, smdid);
                    rs = ps.executeQuery();
                    if (si > 0) {
                        System.err.println("[SmdElectronicDocsServlet] Использован запасной SQL #"
                                + (si + 1) + " для SMDID=" + smdidStr);
                    }
                    break;
                } catch (SQLException ex) {
                    final String msg = ex.getMessage() != null ? ex.getMessage() : "";
                    if (msg.contains("ORA-00942")) {
                        last942 = ex;
                        continue;
                    }
                    throw ex;
                }
            }
            if (rs == null) {
                throw last942 != null ? last942 : new SQLException("Не удалось выполнить запрос электронных документов");
            }

            List<String> items = new ArrayList<>();
            while (rs.next()) {
                String messageCode = getString(rs, "INFENVELOPECODE");
                String documentCode = getString(rs, "EDOCCODE");
                String documentId = getString(rs, "EDOCID");
                String documentDate = formatTimestamp(rs, "EDOCDATETIME");
                String language = getString(rs, "LNG");
                String sourceDocumentId = getString(rs, "EDOCREFID");
                String contentBody = getClobAsString(rs, "CONTENTBODY");
                items.add(jsonItem(messageCode, documentCode, documentId, documentDate, language,
                        sourceDocumentId, contentBody));
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
            System.out.println("[SmdElectronicDocsServlet] Served " + items.size() + " doc(s) for SMDID: " + smdidStr);

        } catch (SQLException e) {
            System.err.println("[SmdElectronicDocsServlet] DB error for SMDID " + smdidStr + ": " + e.getMessage());
            e.printStackTrace();
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            if (rs != null) try { rs.close(); } catch (SQLException ignored) { }
            if (ps != null) try { ps.close(); } catch (SQLException ignored) { }
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static long parseSmdid(String smdidStr, HttpServletResponse response) throws IOException {
        try {
            long smdid = Long.parseLong(smdidStr);
            if (smdid <= 0) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный SMDID");
                return -1;
            }
            return smdid;
        } catch (NumberFormatException e) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный SMDID");
            return -1;
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
                                   String documentDate, String language, String sourceDocumentId,
                                   String contentBody) {
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
