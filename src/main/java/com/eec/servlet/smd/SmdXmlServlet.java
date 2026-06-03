package com.eec.servlet.smd;

import com.eec.util.DatabaseUtil;
import com.eec.util.ServletRequestGuid;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.Reader;
import java.sql.Clob;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * XML карты SMD из SMDXML (SMDXMLBODY), при отсутствии таблицы — пустой документ (карта работает на заготовке).
 * GET /api/smd/xml/{SMDID}?guid=...
 */
public class SmdXmlServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите SMDID: /api/smd/xml/{SMDID}");
            return;
        }

        String smdidStr = pathInfo.startsWith("/") ? pathInfo.substring(1).trim() : pathInfo.trim();
        if (smdidStr.isEmpty()) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "SMDID не задан");
            return;
        }

        String guid = ServletRequestGuid.resolve(request);
        if (guid == null) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Укажите guid в query (?guid=...) или заголовок X-GUID");
            return;
        }

        response.setCharacterEncoding("UTF-8");
        response.setContentType("application/xml;charset=UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            long smdid;
            try {
                smdid = Long.parseLong(smdidStr);
            } catch (NumberFormatException e) {
                sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный SMDID");
                return;
            }

            String xml = loadXmlBody(conn, smdid);
            if (xml == null) {
                System.out.println("[SmdXmlServlet] SMDXML not available for SMDID " + smdidStr + ", returning empty document");
                writeEmptyXml(response);
                return;
            }

            response.getWriter().write(xml);
            response.getWriter().flush();
            System.out.println("[SmdXmlServlet] Served XML for SMDID: " + smdidStr);

        } catch (SQLException e) {
            System.err.println("[SmdXmlServlet] DB error: " + e.getMessage());
            sendError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    /**
     * @return тело XML или null, если таблица/строка недоступны
     */
    private static String loadXmlBody(Connection conn, long smdid) throws SQLException, IOException {
        SQLException lastMissing = null;
        for (String sql : new String[] { SmdDbSupport.SQL_XML_SMDXML, SmdDbSupport.SQL_XML_SMDXML_SESINT }) {
            try {
                String body = queryXmlClob(conn, smdid, sql);
                if (body != null) {
                    return body;
                }
            } catch (SQLException e) {
                if (SmdDbSupport.isMissingObject(e)) {
                    lastMissing = e;
                } else {
                    throw e;
                }
            }
        }
        if (lastMissing != null) {
            return null;
        }
        return null;
    }

    private static String queryXmlClob(Connection conn, long smdid, String sql) throws SQLException, IOException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                Clob clob = rs.getClob("SMDXMLBODY");
                if (clob == null) {
                    return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><empty/>";
                }
                StringBuilder sb = new StringBuilder();
                try (Reader reader = clob.getCharacterStream()) {
                    char[] buf = new char[8192];
                    int n;
                    while ((n = reader.read(buf)) != -1) {
                        sb.append(buf, 0, n);
                    }
                }
                String text = sb.toString().trim();
                return text.isEmpty() ? "<?xml version=\"1.0\" encoding=\"UTF-8\"?><empty/>" : text;
            }
        }
    }

    private static void writeEmptyXml(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_OK);
        response.getWriter().write("<?xml version=\"1.0\" encoding=\"UTF-8\"?><empty/>");
        response.getWriter().flush();
    }

    private static void sendError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("text/plain;charset=UTF-8");
        response.getWriter().write(message != null ? message : "Error");
    }
}
