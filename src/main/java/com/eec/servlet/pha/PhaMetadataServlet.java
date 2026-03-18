package com.eec.servlet.pha;

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
import java.sql.Timestamp;

/**
 * Сервлет для получения метаданных карты PHA по PHAID из таблицы PHA.
 * GET /api/pha/metadata/{PHAID}
 * Возвращает JSON с полями: phaId, incidentId, phaVersion, alertCountryCode, creationDateTime, modificationDateTime, phaStatusName, phaStatusId.
 */
public class PhaMetadataServlet extends HttpServlet {

    private static final String SQL_SELECT =
            "SELECT PHAID, INCIDENTID, PHAVERSION, ALERTCOUNTRYID, CREATIONDATETIME, MODIFICATIONDATETIME, PHASTATUSID "
                    + "FROM PHA WHERE PHAID = ?";
    private static final String SQL_COUNTRY = "SELECT COUNTRYCODE FROM COUNTRY WHERE COUNTRYID = ?";
    private static final String SQL_STATUS = "SELECT PHASTATUSNAME FROM PHASTATUS WHERE PHASTATUSID = ?";

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[PhaMetadataServlet] Initialized");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите PHAID в пути: /api/pha/metadata/{PHAID}");
            return;
        }

        String phaidStr = pathInfo.startsWith("/") ? pathInfo.substring(1).trim() : pathInfo.trim();
        if (phaidStr.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "PHAID не задан");
            return;
        }

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        try (Connection conn = DatabaseUtil.getConnectionForRequest(request)) {
            long phaid;
            try {
                phaid = Long.parseLong(phaidStr);
            } catch (NumberFormatException e) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный PHAID");
                return;
            }

            try (PreparedStatement ps = conn.prepareStatement(SQL_SELECT)) {
                ps.setLong(1, phaid);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        sendJsonError(response, HttpServletResponse.SC_NOT_FOUND, "Карта с PHAID " + phaid + " не найдена");
                        return;
                    }
                    long phaId = rs.getLong("PHAID");
                    String incidentId = rs.getString("INCIDENTID");
                    int phaVersion = rs.getInt("PHAVERSION");
                    Integer alertCountryId = (Integer) rs.getObject("ALERTCOUNTRYID");
                    Timestamp creationDateTime = rs.getTimestamp("CREATIONDATETIME");
                    Timestamp modificationDateTime = rs.getTimestamp("MODIFICATIONDATETIME");
                    Integer phaStatusId = (Integer) rs.getObject("PHASTATUSID");

                    String alertCountryCode = null;
                    if (alertCountryId != null) {
                        try (PreparedStatement ps3 = conn.prepareStatement(SQL_COUNTRY)) {
                            ps3.setInt(1, alertCountryId);
                            try (ResultSet rs3 = ps3.executeQuery()) {
                                if (rs3.next()) alertCountryCode = rs3.getString("COUNTRYCODE");
                            }
                        }
                    }

                    String phaStatusName = null;
                    if (phaStatusId != null) {
                        try (PreparedStatement ps4 = conn.prepareStatement(SQL_STATUS)) {
                            ps4.setInt(1, phaStatusId);
                            try (ResultSet rs4 = ps4.executeQuery()) {
                                if (rs4.next()) phaStatusName = rs4.getString("PHASTATUSNAME");
                            }
                        }
                    }

                    StringBuilder json = new StringBuilder();
                    json.append("{");
                    json.append("\"phaId\":").append(phaId);
                    json.append(",\"incidentId\":\"").append(escapeJson(incidentId != null ? incidentId : ""));
                    json.append("\",\"phaVersion\":").append(phaVersion);
                    if (alertCountryCode != null) json.append(",\"alertCountryCode\":\"").append(escapeJson(alertCountryCode)).append("\"");
                    if (creationDateTime != null) json.append(",\"creationDateTime\":\"").append(creationDateTime.toInstant().toString()).append("\"");
                    if (modificationDateTime != null) json.append(",\"modificationDateTime\":\"").append(modificationDateTime.toInstant().toString()).append("\"");
                    if (phaStatusName != null) json.append(",\"phaStatusName\":\"").append(escapeJson(phaStatusName)).append("\"");
                    if (phaStatusId != null) json.append(",\"phaStatusId\":").append(phaStatusId);
                    json.append("}");
                    response.getWriter().print(json.toString());
                }
            }
        } catch (SQLException e) {
            System.err.println("[PhaMetadataServlet] DB error: " + e.getMessage());
            e.printStackTrace();
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        }
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        String escaped = message != null ? escapeJson(message) : "Unknown error";
        response.getWriter().print("{\"error\":\"" + escaped + "\"}");
    }
}
