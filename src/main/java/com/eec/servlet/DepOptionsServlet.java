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

/**
 * Список подразделений из SESDEV.TB_DEP с видом из SESDEV.TB_DEPKIND (DEPKINDCODE).
 * GET /api/dep/options — все подразделения { id, name, depKindCode }.
 * dep0601 — районный ЦГЭ, dep0602 — областной ЦГЭ (для фильтра добавления/удаления).
 */
public class DepOptionsServlet extends HttpServlet {

    private static final String SQL = ""
            + "SELECT d.DEPID, d.DEPNAME, dk.DEPKINDCODE "
            + "FROM SESDEV.TB_DEP d "
            + "LEFT JOIN SESDEV.TB_DEPKIND dk ON d.DEPKINDID = dk.DEPKINDID "
            + "ORDER BY d.DEPNAME";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        try {
            conn = DatabaseUtil.getConnection();
            ps = conn.prepareStatement(SQL);
            rs = ps.executeQuery();
            StringBuilder json = new StringBuilder("[");
            boolean first = true;
            while (rs.next()) {
                if (!first) json.append(",");
                first = false;
                String id = rs.getString(1);
                String name = rs.getString(2);
                String depKindCode = rs.getString(3);
                if (id == null) id = "";
                if (name == null) name = "";
                if (depKindCode == null) depKindCode = "";
                json.append("{\"id\":").append(quote(id)).append(",\"name\":").append(quote(name)).append(",\"depKindCode\":").append(quote(depKindCode)).append("}");
            }
            json.append("]");
            response.getWriter().print(json.toString());
        } catch (SQLException e) {
            log("DepOptions: " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"error\":\"" + e.getMessage().replace("\"", "'") + "\"}");
        } finally {
            if (rs != null) try { rs.close(); } catch (SQLException ignored) { }
            if (ps != null) try { ps.close(); } catch (SQLException ignored) { }
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static String quote(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }
}
