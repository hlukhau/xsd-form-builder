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

/**
 * Сервлет для получения XML по DPAID из таблицы DPAXML.
 * GET /api/dpa-xml/{DPAID} — возвращает CLOB из колонки XML.
 * Таблица: DPAXML(DPAID, XML) — DPAID число или строка, XML — CLOB.
 */
public class DPAXmlServlet extends HttpServlet {

    private static final String SQL_SELECT = "SELECT XML FROM DPAXML WHERE DPAID = ?";

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[DPAXmlServlet] Initialized");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        // DPAID из path: /api/dpa-xml/123 -> pathInfo = /123
        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("text/plain;charset=UTF-8");
            response.getWriter().print("DPAID required: /api/dpa-xml/{DPAID}");
            return;
        }
        String dpaidRaw = pathInfo.startsWith("/") ? pathInfo.substring(1) : pathInfo;
        if (dpaidRaw.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("text/plain;charset=UTF-8");
            response.getWriter().print("DPAID required");
            return;
        }

        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;

        try {
            conn = DatabaseUtil.getConnection();
            ps = conn.prepareStatement(SQL_SELECT);
            // Поддержка и числа, и строки в БД
            try {
                long id = Long.parseLong(dpaidRaw);
                ps.setLong(1, id);
            } catch (NumberFormatException e) {
                ps.setString(1, dpaidRaw);
            }
            rs = ps.executeQuery();
            if (!rs.next()) {
                response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                response.setContentType("text/plain;charset=UTF-8");
                response.getWriter().print("DPAID not found: " + dpaidRaw);
                return;
            }
            String xml = null;
            Clob clob = rs.getClob("XML");
            if (clob != null) {
                Reader reader = clob.getCharacterStream();
                StringBuilder sb = new StringBuilder();
                char[] buf = new char[8192];
                int n;
                while ((n = reader.read(buf)) >= 0) {
                    sb.append(buf, 0, n);
                }
                reader.close();
                xml = sb.toString();
            }
            if (xml == null || xml.isEmpty()) {
                response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                response.setContentType("text/plain;charset=UTF-8");
                response.getWriter().print("XML is empty for DPAID: " + dpaidRaw);
                return;
            }
            response.setContentType("application/xml;charset=UTF-8");
            PrintWriter out = response.getWriter();
            out.print(xml);
        } catch (SQLException e) {
            System.err.println("[DPAXmlServlet] DB error for DPAID=" + dpaidRaw + ": " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.setContentType("text/plain;charset=UTF-8");
            try {
                response.getWriter().print("Database error");
            } catch (IOException ignored) {
            }
        } finally {
            if (rs != null) {
                try {
                    rs.close();
                } catch (SQLException ignored) {
                }
            }
            if (ps != null) {
                try {
                    ps.close();
                } catch (SQLException ignored) {
                }
            }
            DatabaseUtil.closeConnection(conn);
        }
    }
}
