package com.eec.servlet.smr;

import com.eec.util.DatabaseUtil;

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
 * XML карты SMR из SMRXML.SMRXMLBODY.
 * GET /api/smr/xml/{SMRID}?guid=...
 */
public class SmrXmlServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите SMRID: /api/smr/xml/{SMRID}");
            return;
        }

        String idStr = pathInfo.startsWith("/") ? pathInfo.substring(1).trim() : pathInfo.trim();
        String guid = request.getParameter("guid");
        if (guid != null) guid = guid.trim();
        if (guid == null || guid.isEmpty()) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid");
            return;
        }

        long smrId;
        try {
            smrId = Long.parseLong(idStr);
        } catch (NumberFormatException e) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный SMRID");
            return;
        }

        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;
        Reader reader = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            if (!SmrAccessHelper.canViewSmr(conn, smrId, guid)) {
                sendError(response, HttpServletResponse.SC_FORBIDDEN, "Нет доступа к просмотру карты SMR.");
                return;
            }

            response.setContentType("application/xml;charset=UTF-8");
            try (PreparedStatement ps = conn.prepareStatement(SmrDbSupport.SQL_SMR_XML)) {
                ps.setLong(1, smrId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        sendError(response, HttpServletResponse.SC_NOT_FOUND, "XML для SMRID " + idStr + " не найден.");
                        return;
                    }
                    Clob clob = rs.getClob("SMRXMLBODY");
                    if (clob == null) {
                        response.getWriter().write("<?xml version=\"1.0\" encoding=\"UTF-8\"?><empty/>");
                        return;
                    }
                    reader = clob.getCharacterStream();
                    char[] buf = new char[8192];
                    int n;
                    while ((n = reader.read(buf)) >= 0) {
                        response.getWriter().write(buf, 0, n);
                    }
                }
            }
        } catch (SQLException e) {
            sendError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            if (reader != null) try { reader.close(); } catch (IOException ignored) { }
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static void sendError(HttpServletResponse response, int status, String msg) throws IOException {
        response.setStatus(status);
        response.setContentType("text/plain;charset=UTF-8");
        response.getWriter().print(msg);
    }
}
