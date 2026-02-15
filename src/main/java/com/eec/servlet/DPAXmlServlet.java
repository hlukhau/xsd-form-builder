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
 * GET /api/dpa/xml/{DPAID}
 * Возвращает application/xml с содержимым CLOB-поля для указанного DPAID.
 * Если колонка с XML называется иначе (BODY, XMLDATA и т.д.) — измените SQL_SELECT.
 */
public class DpaXmlServlet extends HttpServlet {

    /** Таблица DPAXML: DPAID, DPAXMLBODY (CLOB) */
    private static final String SQL_SELECT = "SELECT DPAXMLBODY FROM DPAXML WHERE DPAID = ?";

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[DpaXmlServlet] Initialized");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            response.setContentType("application/json;charset=UTF-8");
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"error\":\"Укажите DPAID в пути: /api/dpa/xml/{DPAID}\"}");
            return;
        }

        String dpaidStr = pathInfo.startsWith("/") ? pathInfo.substring(1) : pathInfo;
        if (dpaidStr.isEmpty()) {
            response.setContentType("application/json;charset=UTF-8");
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"error\":\"DPAID не задан\"}");
            return;
        }

        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;

        try {
            conn = DatabaseUtil.getConnection();
            ps = conn.prepareStatement(SQL_SELECT);
            try {
                ps.setLong(1, Long.parseLong(dpaidStr));
            } catch (NumberFormatException e) {
                ps.setString(1, dpaidStr);
            }

            rs = ps.executeQuery();
            if (!rs.next()) {
                response.setContentType("application/json;charset=UTF-8");
                response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                response.getWriter().print("{\"error\":\"Запись с DPAID " + dpaidStr + " не найдена\"}");
                return;
            }

            String xml = null;
            try {
                Clob clob = rs.getClob(1);
                if (clob != null) {
                    Reader r = clob.getCharacterStream();
                    StringBuilder sb = new StringBuilder();
                    char[] buf = new char[8192];
                    int n;
                    while ((n = r.read(buf)) >= 0) {
                        sb.append(buf, 0, n);
                    }
                    r.close();
                    xml = sb.toString();
                }
            } catch (SQLException e) {
                try {
                    xml = rs.getString(1);
                } catch (SQLException e2) {
                    throw e;
                }
            }
            if (xml == null || xml.trim().isEmpty()) {
                response.setContentType("application/json;charset=UTF-8");
                response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                response.getWriter().print("{\"error\":\"XML для DPAID " + dpaidStr + " пуст\"}");
                return;
            }

            response.setContentType("application/xml;charset=UTF-8");
            response.setStatus(HttpServletResponse.SC_OK);
            PrintWriter out = response.getWriter();
            out.write(xml);
            out.flush();
            System.out.println("[DpaXmlServlet] Served XML for DPAID: " + dpaidStr);

        } catch (SQLException e) {
            System.err.println("[DpaXmlServlet] DB error for DPAID " + dpaidStr + ": " + e.getMessage());
            e.printStackTrace();
            response.setContentType("application/json;charset=UTF-8");
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            String msg = e.getMessage() != null ? e.getMessage().replace("\"", "'") : "Ошибка БД";
            response.getWriter().print("{\"error\":\"" + msg + "\"}");
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
