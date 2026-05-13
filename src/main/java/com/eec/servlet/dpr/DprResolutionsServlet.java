package com.eec.servlet.dpr;

import com.eec.util.DatabaseUtil;
import com.eec.util.DprAccessHelper;

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
 * Резолюции по карте DPR (DPRRESOLUTION + TB_DEPKIND).
 * GET /api/dpr/resolutions?dprid=...&guid=...
 */
public class DprResolutionsServlet extends HttpServlet {

    private static final String SQL = ""
            + "SELECT r.DEPKINDID, dk.DEPKINDCODE, dk.DEPKINDNAME "
            + "FROM DPRRESOLUTION r "
            + "JOIN TB_DEPKIND dk ON r.DEPKINDID = dk.DEPKINDID "
            + "WHERE r.DPRID = ? "
            + "ORDER BY dk.DEPKINDCODE";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String dprid = request.getParameter("dprid");
        String guid = request.getParameter("guid");
        if (guid != null) guid = guid.trim();
        if (dprid == null || dprid.trim().isEmpty()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"error\":\"Укажите dprid\"}");
            return;
        }
        if (guid == null || guid.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"error\":\"Укажите guid\"}");
            return;
        }
        dprid = dprid.trim();
        long dprId;
        try {
            dprId = Long.parseLong(dprid);
        } catch (NumberFormatException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().print("{\"error\":\"Некорректный dprid\"}");
            return;
        }

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            if (!DprAccessHelper.canViewDpr(conn, dprId, guid)) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.getWriter().print("{\"error\":\"Нет доступа к карте DPR\"}");
                return;
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL)) {
                ps.setLong(1, dprId);
                try (ResultSet rs = ps.executeQuery()) {
                    List<String> items = new ArrayList<>();
                    while (rs.next()) {
                        int depKindId = rs.getInt("DEPKINDID");
                        if (rs.wasNull()) {
                            depKindId = 0;
                        }
                        String code = rs.getString("DEPKINDCODE");
                        String name = rs.getString("DEPKINDNAME");
                        items.add("{\"depKindId\":" + depKindId
                                + ",\"depKindCode\":" + quote(code) + ",\"depKindName\":" + quote(name) + "}");
                    }
                    StringBuilder json = new StringBuilder();
                    json.append("{\"resolutions\":[");
                    for (int i = 0; i < items.size(); i++) {
                        if (i > 0) json.append(",");
                        json.append(items.get(i));
                    }
                    json.append("]}");
                    response.setStatus(HttpServletResponse.SC_OK);
                    PrintWriter out = response.getWriter();
                    out.print(json.toString());
                }
            }
        } catch (SQLException e) {
            String m = e.getMessage() != null ? e.getMessage() : "";
            if (m.contains("ORA-00942") || m.toLowerCase().contains("does not exist")) {
                response.setStatus(HttpServletResponse.SC_OK);
                response.getWriter().print("{\"resolutions\":[]}");
                return;
            }
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
