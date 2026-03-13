package com.eec.servlet;

import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Уровень ЦГЭ по DEPID (из карты прав доступа).
 * GET /api/dep/info?depid=... — ответ: { "depKindCode": "dep0601", "depKindName": "Районный ЦГЭ" } или null.
 */
public class DepInfoServlet extends HttpServlet {

    private static final String SQL = ""
            + "SELECT dk.DEPKINDCODE, dk.DEPKINDNAME "
            + "FROM SESDEV.TB_DEP d "
            + "LEFT JOIN SESDEV.TB_DEPKIND dk ON d.DEPKINDID = dk.DEPKINDID "
            + "WHERE d.DEPID = ?";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String depIdParam = request.getParameter("depid");
        if (depIdParam == null || depIdParam.trim().isEmpty()) {
            response.getWriter().print("{\"depKindCode\":null,\"depKindName\":null}");
            return;
        }
        int depid;
        try {
            depid = Integer.parseInt(depIdParam.trim());
        } catch (NumberFormatException e) {
            response.getWriter().print("{\"depKindCode\":null,\"depKindName\":null}");
            return;
        }

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request);
            PreparedStatement ps = conn.prepareStatement(SQL);
            ps.setInt(1, depid);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                String code = rs.getString("DEPKINDCODE");
                String name = rs.getString("DEPKINDNAME");
                rs.close();
                ps.close();
                String json = "{\"depKindCode\":" + quote(code) + ",\"depKindName\":" + quote(name) + "}";
                response.getWriter().print(json);
            } else {
                rs.close();
                ps.close();
                response.getWriter().print("{\"depKindCode\":null,\"depKindName\":null}");
            }
        } catch (SQLException e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"error\":\"" + escapeJson(e.getMessage()) + "\"}");
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static String quote(String s) {
        if (s == null) return "null";
        return "\"" + escapeJson(s) + "\"";
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ");
    }
}
