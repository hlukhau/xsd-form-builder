package com.eec.servlet;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Текущий пользователь: уровень ЦГЭ (TB_USER → TB_EMP → TB_DEP → TB_DEPKIND).
 * GET /api/current-user
 * Ответ: { "depKindCode": "dep0601", "depKindName": "Районный ЦГЭ" } или { "depKindCode": null, "depKindName": null }.
 * USERID берётся из заголовка X-User-Id или из сессии (атрибут "userId").
 */
public class CurrentUserServlet extends HttpServlet {

    private static final String SQL = ""
            + "SELECT dk.DEPKINDCODE, dk.DEPKINDNAME "
            + "FROM TB_USER u "
            + "JOIN TB_EMP e ON u.EMPID = e.EMPID "
            + "JOIN TB_DEP d ON e.DEPID = d.DEPID "
            + "JOIN TB_DEPKIND dk ON d.DEPKINDID = dk.DEPKINDID "
            + "WHERE u.USERID = ?";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Integer userId = null;
        String xUserId = request.getHeader("X-User-Id");
        if (xUserId != null && !xUserId.trim().isEmpty()) {
            try {
                userId = Integer.parseInt(xUserId.trim());
            } catch (NumberFormatException ignored) {
            }
        }
        if (userId == null) {
            HttpSession session = request.getSession(false);
            if (session != null && session.getAttribute("userId") != null) {
                Object o = session.getAttribute("userId");
                if (o instanceof Number) {
                    userId = ((Number) o).intValue();
                }
            }
        }
        if (userId == null) {
            String guid = request.getParameter("guid");
            if (guid != null && !guid.trim().isEmpty()) {
                userId = getUserIdFromRights(RightsRegistryProvider.get().getRightsJson(guid.trim()));
            }
        }

        if (userId == null) {
            response.getWriter().print("{\"depKindCode\":null,\"depKindName\":null}");
            return;
        }

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request);
            PreparedStatement ps = conn.prepareStatement(SQL);
            ps.setInt(1, userId);
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

    private static Integer getUserIdFromRights(String json) {
        if (json == null) return null;
        Matcher m = Pattern.compile("\"userId\"\\s*:\\s*(-?\\d+)").matcher(json);
        if (m.find()) {
            try { return Integer.parseInt(m.group(1)); } catch (NumberFormatException ignored) { }
        }
        m = Pattern.compile("\"userId\"\\s*:\\s*\"(-?\\d+)\"").matcher(json);
        if (m.find()) {
            try { return Integer.parseInt(m.group(1)); } catch (NumberFormatException ignored) { }
        }
        return null;
    }
}
