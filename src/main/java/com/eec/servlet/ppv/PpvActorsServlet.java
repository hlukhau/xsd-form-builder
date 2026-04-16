package com.eec.servlet.ppv;

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
import java.sql.Timestamp;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Адресаты карты PPV (реляционно, не из XML).
 * GET /api/ppv/actors/{PPVID}
 * Источник: PPVACTOR + наименование страны из COUNTRY.
 */
public class PpvActorsServlet extends HttpServlet {

    private static final ZoneId ZONE = ZoneId.systemDefault();
    private static final DateTimeFormatter RESPONSE_DT =
            DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm:ss").withZone(ZONE);

    private static final String SQL = ""
            + "SELECT a.PPVACTORID, a.PPVID, a.ACTORCOUNTRYCODE, a.ACTORCODE, a.EDOCID, a.PPVACTORACTFL, a.CDATE, "
            + "       c.COUNTRYNAME AS ACTOR_COUNTRY_NAME "
            + "FROM PPVACTOR a "
            + "LEFT JOIN COUNTRY c ON UPPER(TRIM(c.COUNTRYCODE)) = UPPER(TRIM(a.ACTORCOUNTRYCODE)) "
            + "     AND c.COUNTRYSDATE <= SYSDATE AND c.COUNTRYEDATE >= SYSDATE "
            + "WHERE a.PPVID = ? "
            + "ORDER BY a.PPVACTORID";

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[PpvActorsServlet] Initialized");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Укажите PPVID: /api/ppv/actors/{PPVID}");
            return;
        }

        String ppvidStr = pathInfo.startsWith("/") ? pathInfo.substring(1) : pathInfo;
        if (ppvidStr.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "PPVID не задан");
            return;
        }

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;

        try {
            conn = DatabaseUtil.getConnectionForRequest(request);
            ps = conn.prepareStatement(SQL);
            try {
                ps.setLong(1, Long.parseLong(ppvidStr));
            } catch (NumberFormatException e) {
                ps.setString(1, ppvidStr);
            }
            rs = ps.executeQuery();
            List<String> items = new ArrayList<>();
            while (rs.next()) {
                long actorId = rs.getLong("PPVACTORID");
                String countryName = trimOrNull(rs.getString("ACTOR_COUNTRY_NAME"));
                if (countryName == null || countryName.isEmpty()) {
                    countryName = trimOrNull(rs.getString("ACTORCOUNTRYCODE"));
                }
                Object edocObj = rs.getObject("EDOCID");
                boolean hasResponse = !rs.wasNull();
                String edocIdStr = null;
                if (hasResponse && edocObj != null) {
                    edocIdStr = String.valueOf(edocObj).trim();
                    if (edocIdStr.isEmpty()) {
                        hasResponse = false;
                        edocIdStr = null;
                    }
                } else {
                    hasResponse = false;
                }
                String responseDt = null;
                if (hasResponse) {
                    Timestamp cdate = rs.getTimestamp("CDATE");
                    if (cdate != null) {
                        responseDt = RESPONSE_DT.format(cdate.toInstant());
                    }
                }
                items.add(jsonRow(actorId, countryName, responseDt, edocIdStr));
            }

            response.setStatus(HttpServletResponse.SC_OK);
            PrintWriter out = response.getWriter();
            out.print("{\"actors\":[");
            for (int i = 0; i < items.size(); i++) {
                if (i > 0) out.print(",");
                out.print(items.get(i));
            }
            out.print("]}");
            out.flush();
            System.out.println("[PpvActorsServlet] Served " + items.size() + " row(s) for PPVID: " + ppvidStr);
        } catch (SQLException e) {
            System.err.println("[PpvActorsServlet] DB error for PPVID " + ppvidStr + ": " + e.getMessage());
            e.printStackTrace();
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            if (rs != null) try { rs.close(); } catch (SQLException ignored) { }
            if (ps != null) try { ps.close(); } catch (SQLException ignored) { }
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String jsonRow(long ppvActorId, String countryName, String responseDateTime, String edocId) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"ppvActorId\":").append(ppvActorId);
        sb.append(",\"countryName\":").append(quote(countryName));
        sb.append(",\"responseDateTime\":").append(quote(responseDateTime));
        sb.append(",\"edocId\":").append(quote(edocId));
        sb.append("}");
        return sb.toString();
    }

    private static String quote(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        String escaped = message != null ? message.replace("\\", "\\\\").replace("\"", "\\\"") : "Unknown error";
        response.getWriter().print("{\"error\":\"" + escaped + "\"}");
    }
}
