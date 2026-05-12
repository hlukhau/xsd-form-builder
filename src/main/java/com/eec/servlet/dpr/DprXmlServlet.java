package com.eec.servlet.dpr;

import com.eec.util.DatabaseUtil;
import com.eec.util.DprAccessHelper;

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
 * XML карты DPR из DPRXML.DPRXMLBODY.
 * GET /api/dpr/xml/{DPRID}?guid=...
 */
public class DprXmlServlet extends HttpServlet {

    private static final String SQL_SELECT = "SELECT DPRXMLBODY FROM DPRXML WHERE DPRID = ?";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите DPRID: /api/dpr/xml/{DPRID}");
            return;
        }

        String idStr = pathInfo.startsWith("/") ? pathInfo.substring(1).trim() : pathInfo.trim();
        if (idStr.isEmpty()) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "DPRID не задан");
            return;
        }

        String guid = request.getParameter("guid");
        if (guid != null) guid = guid.trim();
        if (guid == null || guid.isEmpty()) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid");
            return;
        }

        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        long dprId;
        try {
            dprId = Long.parseLong(idStr);
        } catch (NumberFormatException e) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный DPRID");
            return;
        }

        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        Reader reader = null;

        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            if (!DprAccessHelper.canViewDpr(conn, dprId, guid)) {
                sendError(response, HttpServletResponse.SC_FORBIDDEN, "Нет доступа к просмотру карты DPR.");
                return;
            }

            response.setContentType("application/xml;charset=UTF-8");

            ps = conn.prepareStatement(SQL_SELECT);
            ps.setLong(1, dprId);
            rs = ps.executeQuery();
            if (!rs.next()) {
                sendError(response, HttpServletResponse.SC_NOT_FOUND, "XML для DPRID " + idStr + " не найден.");
                return;
            }

            Clob clob = rs.getClob("DPRXMLBODY");
            if (clob == null) {
                response.getWriter().write("<?xml version=\"1.0\" encoding=\"UTF-8\"?><empty/>");
                response.getWriter().flush();
                return;
            }

            reader = clob.getCharacterStream();
            char[] buf = new char[8192];
            int n;
            while ((n = reader.read(buf)) >= 0) {
                response.getWriter().write(buf, 0, n);
            }
            response.getWriter().flush();
        } catch (SQLException e) {
            sendError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            if (reader != null) try { reader.close(); } catch (IOException ignored) { }
            if (rs != null) try { rs.close(); } catch (SQLException ignored) { }
            if (ps != null) try { ps.close(); } catch (SQLException ignored) { }
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static void sendError(HttpServletResponse response, int status, String msg) throws IOException {
        response.setStatus(status);
        response.setContentType("text/plain;charset=UTF-8");
        response.getWriter().print(msg);
    }
}
