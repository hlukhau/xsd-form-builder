package com.eec.servlet.smd;

import com.eec.util.DatabaseUtil;
import com.eec.util.ServletRequestGuid;

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
 * Результаты рассмотрения меры (SMR) по карте SMD.
 * GET /api/smd/review-results/{SMDID}?guid=...
 */
public class SmdReviewResultsServlet extends HttpServlet {

    private static final ZoneId ZONE = ZoneId.systemDefault();
    private static final DateTimeFormatter RESPONSE_DT =
            DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm:ss").withZone(ZONE);

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Укажите SMDID: /api/smd/review-results/{SMDID}");
            return;
        }

        String smdidStr = pathInfo.startsWith("/") ? pathInfo.substring(1).trim() : pathInfo.trim();
        if (smdidStr.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "SMDID не задан");
            return;
        }

        String guid = ServletRequestGuid.resolve(request);
        if (guid == null) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Укажите guid в query (?guid=...) или заголовок X-GUID");
            return;
        }

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        try (Connection conn = DatabaseUtil.getConnectionForRequest(request, guid)) {
            long smdid = Long.parseLong(smdidStr);
            List<String> items = loadRows(conn, smdid);
            response.setStatus(HttpServletResponse.SC_OK);
            PrintWriter out = response.getWriter();
            out.print("{\"results\":[");
            for (int i = 0; i < items.size(); i++) {
                if (i > 0) out.print(',');
                out.print(items.get(i));
            }
            out.print("]}");
            out.flush();
        } catch (NumberFormatException e) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный SMDID");
        } catch (SQLException e) {
            System.err.println("[SmdReviewResultsServlet] DB error: " + e.getMessage());
            e.printStackTrace();
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        }
    }

    private static List<String> loadRows(Connection conn, long smdid) throws SQLException {
        List<String> items = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(SmdDbSupport.SQL_REVIEW_RESULTS)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long smrId = rs.getLong("SMRID");
                    String countryCode = trimOrNull(rs.getString("COUNTRYCODE"));
                    String countryName = trimOrNull(rs.getString("COUNTRYNAME"));
                    String creationDt = formatTs(rs.getTimestamp("CREATIONDATETIME"));
                    String statusName = trimOrNull(rs.getString("SMRSTATUSNAME"));
                    StringBuilder sb = new StringBuilder();
                    sb.append("{\"smrId\":").append(smrId);
                    sb.append(",\"countryCode\":").append(quote(countryCode));
                    sb.append(",\"countryName\":").append(quote(countryName));
                    sb.append(",\"creationDateTime\":").append(quote(creationDt));
                    sb.append(",\"statusName\":").append(quote(statusName));
                    sb.append("}");
                    items.add(sb.toString());
                }
            }
        }
        return items;
    }

    private static String formatTs(Timestamp ts) {
        if (ts == null) return null;
        return RESPONSE_DT.format(ts.toInstant());
    }

    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
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
