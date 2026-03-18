package com.eec.servlet.dpa;

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
import java.util.ArrayList;
import java.util.List;

/**
 * Список резолюций по карте (DPARESOLUTION + TB_DEPKIND) — какие уровни уже наложили резолюцию.
 * GET /api/dpa/resolutions?dpaid=...
 * Ответ: { "resolutions": [ { "depKindCode": "dep0601", "depKindName": "Районный ЦГЭ" }, ... ] }
 */
public class DpaResolutionsServlet extends HttpServlet {

    private static final String SQL = ""
            + "SELECT dk.DEPKINDCODE, dk.DEPKINDNAME "
            + "FROM DPARESOLUTION r "
            + "JOIN TB_DEPKIND dk ON r.DEPKINDID = dk.DEPKINDID "
            + "WHERE r.DPAID = ? "
            + "ORDER BY dk.DEPKINDCODE";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String dpaid = request.getParameter("dpaid");
        if (dpaid == null || dpaid.trim().isEmpty()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"error\":\"Укажите dpaid\"}");
            return;
        }
        dpaid = dpaid.trim();

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request);
            PreparedStatement ps = conn.prepareStatement(SQL);
            try {
                ps.setLong(1, Long.parseLong(dpaid));
            } catch (NumberFormatException e) {
                ps.setString(1, dpaid);
            }
            ResultSet rs = ps.executeQuery();
            List<String> items = new ArrayList<>();
            while (rs.next()) {
                String code = rs.getString("DEPKINDCODE");
                String name = rs.getString("DEPKINDNAME");
                items.add("{\"depKindCode\":" + quote(code) + ",\"depKindName\":" + quote(name) + "}");
            }
            rs.close();
            ps.close();

            StringBuilder json = new StringBuilder();
            json.append("{\"resolutions\":[");
            for (int i = 0; i < items.size(); i++) {
                if (i > 0) json.append(",");
                json.append(items.get(i));
            }
            json.append("]}");
            response.getWriter().print(json.toString());
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
