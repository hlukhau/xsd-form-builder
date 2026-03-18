package com.eec.servlet.pha;

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
 * Сервлет для получения XML карты PHA по PHAID из таблицы PHAXML (колонка PHAXMLBODY, CLOB).
 * GET /api/pha/xml/{PHAID}
 * Возвращает содержимое CLOB как application/xml; charset=UTF-8.
 */
public class PhaXmlServlet extends HttpServlet {

    private static final String SQL_SELECT = "SELECT PHAXMLBODY FROM PHAXML WHERE PHAID = ?";

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[PhaXmlServlet] Initialized");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите PHAID в пути: /api/pha/xml/{PHAID}");
            return;
        }

        String phaidStr = pathInfo.startsWith("/") ? pathInfo.substring(1).trim() : pathInfo.trim();
        if (phaidStr.isEmpty()) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "PHAID не задан");
            return;
        }

        response.setCharacterEncoding("UTF-8");
        response.setContentType("application/xml;charset=UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        Reader reader = null;

        try {
            conn = DatabaseUtil.getConnectionForRequest(request);
            ps = conn.prepareStatement(SQL_SELECT);
            try {
                ps.setLong(1, Long.parseLong(phaidStr));
            } catch (NumberFormatException e) {
                ps.setString(1, phaidStr);
            }

            rs = ps.executeQuery();
            if (!rs.next()) {
                sendError(response, HttpServletResponse.SC_NOT_FOUND, "Запись с PHAID " + phaidStr + " не найдена в PHAXML");
                return;
            }

            Clob clob = rs.getClob("PHAXMLBODY");
            if (clob == null) {
                response.getWriter().write("<?xml version=\"1.0\" encoding=\"UTF-8\"?><empty/>");
                response.getWriter().flush();
                System.out.println("[PhaXmlServlet] Served empty XML for PHAID: " + phaidStr);
                return;
            }

            reader = clob.getCharacterStream();
            char[] buf = new char[4096];
            int n;
            java.io.Writer out = response.getWriter();
            while ((n = reader.read(buf)) >= 0) {
                out.write(buf, 0, n);
            }
            out.flush();
            System.out.println("[PhaXmlServlet] Served XML for PHAID: " + phaidStr);

        } catch (SQLException e) {
            System.err.println("[PhaXmlServlet] DB error for PHAID " + phaidStr + ": " + e.getMessage());
            e.printStackTrace();
            sendError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            if (reader != null) {
                try {
                    reader.close();
                } catch (IOException e) {
                    System.err.println("[PhaXmlServlet] Error closing CLOB reader: " + e.getMessage());
                }
            }
            if (rs != null) try { rs.close(); } catch (SQLException ignored) { }
            if (ps != null) try { ps.close(); } catch (SQLException ignored) { }
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static void sendError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        String escaped = message != null ? message.replace("\\", "\\\\").replace("\"", "\\\"") : "Unknown error";
        response.getWriter().print("{\"error\":\"" + escaped + "\"}");
    }
}
