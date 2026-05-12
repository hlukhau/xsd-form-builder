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
import java.sql.Timestamp;

/**
 * Метаданные карты DPR (шапка) из VW_DPR.
 * GET /api/dpr/metadata/{DPRID}?guid=...
 */
public class DprMetadataServlet extends HttpServlet {

    private static final String SQL = ""
            + "SELECT vw.INCIDENTID, vw.RESPONSECOUNTRYNAME, "
            + "       TRIM(TO_CHAR(vw.DATASOURCEKINDCODE)) AS DATASOURCEKINDCODE, t1.DATASOURCEKINDNAME, "
            + "       vw.DPRSTATUSNAME, vw.CREATIONDATETIME, vw.MODIFICATIONDATETIME, "
            + "       (SELECT MIN(p.PPVID) FROM PPV p WHERE TRIM(p.INCIDENTID) = TRIM(vw.INCIDENTID)) AS LINKED_PPVID "
            + "FROM VW_DPR vw "
            + "LEFT JOIN DATASOURCEKIND t1 ON TRIM(TO_CHAR(vw.DATASOURCEKINDCODE)) = TRIM(TO_CHAR(t1.DATASOURCEKINDCODE)) "
            + "WHERE vw.DPRID = ?";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите DPRID: /api/dpr/metadata/{DPRID}");
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

        response.setContentType("application/json;charset=UTF-8");
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
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            if (!DprAccessHelper.canViewDpr(conn, dprId, guid)) {
                sendError(response, HttpServletResponse.SC_FORBIDDEN, "Нет доступа к просмотру карты DPR (требуется доступ к связанной карте PPV).");
                return;
            }

            try (PreparedStatement ps = conn.prepareStatement(SQL)) {
                ps.setLong(1, dprId);
                ResultSet rs = ps.executeQuery();
                if (!rs.next()) {
                    sendError(response, HttpServletResponse.SC_NOT_FOUND, "Карта DPR с указанным идентификатором не найдена.");
                    return;
                }

                String incidentId = rs.getString("INCIDENTID");
                String responseCountry = rs.getString("RESPONSECOUNTRYNAME");
                String dscCode = rs.getString("DATASOURCEKINDCODE");
                String dscName = rs.getString("DATASOURCEKINDNAME");
                String statusName = rs.getString("DPRSTATUSNAME");
                Timestamp created = rs.getTimestamp("CREATIONDATETIME");
                Timestamp modified = rs.getTimestamp("MODIFICATIONDATETIME");
                long linkedPpvid = rs.getLong("LINKED_PPVID");
                if (rs.wasNull()) {
                    linkedPpvid = 0;
                }

                PrintWriter out = response.getWriter();
                out.print("{");
                out.print("\"incidentId\":" + quote(incidentId));
                out.print(",\"responseCountryName\":" + quote(responseCountry));
                out.print(",\"datasourceKindCode\":" + quote(dscCode));
                out.print(",\"datasourceKindName\":" + quote(dscName));
                out.print(",\"dprStatusName\":" + quote(statusName));
                out.print(",\"creationDateTime\":" + quote(tsToIso(created)));
                out.print(",\"modificationDateTime\":" + quote(tsToIso(modified)));
                out.print(",\"linkedPpvid\":" + linkedPpvid);
                out.print("}");
                out.flush();
                response.setStatus(HttpServletResponse.SC_OK);
            }
        } catch (SQLException e) {
            sendError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static String tsToIso(Timestamp ts) {
        if (ts == null) return null;
        return ts.toInstant().toString();
    }

    private static String quote(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }

    private static void sendError(HttpServletResponse response, int status, String msg) throws IOException {
        response.setStatus(status);
        PrintWriter out = response.getWriter();
        out.print("{\"error\":" + quote(msg) + "}");
        out.flush();
    }
}
