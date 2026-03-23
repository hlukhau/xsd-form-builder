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
import java.sql.Date;
import java.sql.Timestamp;

/**
 * Сервлет для получения метаданных карты PHA по PHAID.
 * GET /api/pha/metadata/{PHAID}
 * <p>Сначала читается таблица {@code PHA}; наименование статуса — из справочника {@code PHASTATUS}
 * (join по {@code PHA.PHASTATUSID = PHASTATUS.PHASTATUSID}). Если строки нет — {@code VW_PHA}.</p>
 * Возвращает JSON: phaId, incidentId, phaVersion, alertCountryCode, dataSourceKindCode, dataSourceKindName (Источник),
 * creationDateTime, modificationDateTime, phaStatusName, phaStatusId, phaAccessibleDepIds (DEPID из PHADEPPERMIS).
 * <p>Справочник {@code PHASTATUS}: колонки {@code PHASTATUSID}, {@code PHASTATUSNAME}.</p>
 */
public class PhaMetadataServlet extends HttpServlet {

    /** Таблица PHA — приоритетный источник метаданных и статуса. */
    private static final String SQL_PHA =
            "SELECT p.PHAID, p.INCIDENTID, p.PHAVERSION, p.ALERTCOUNTRYID, p.CREATIONDATETIME, p.MODIFICATIONDATETIME, p.PHASTATUSID, p.DATASOURCEKINDCODE, p.ENDDATE, "
                    + "t1.DATASOURCEKINDNAME, c.COUNTRYCODE AS ALERTCOUNTRYCODE, ps.PHASTATUSNAME "
                    + "FROM PHA p "
                    + "LEFT JOIN DATASOURCEKIND t1 ON p.DATASOURCEKINDCODE = t1.DATASOURCEKINDCODE "
                    + "LEFT JOIN COUNTRY c ON p.ALERTCOUNTRYID = c.COUNTRYID "
                    + "LEFT JOIN PHASTATUS ps ON p.PHASTATUSID = ps.PHASTATUSID "
                    + "WHERE p.PHAID = ?";
    /** Резерв: представление VW_PHA, если по PHAID в PHA нет строки. */
    private static final String SQL_VW =
            "SELECT vw.PHAID, vw.INCIDENTID, vw.PHAVERSION, vw.ALERTCOUNTRYID, vw.CREATIONDATETIME, vw.MODIFICATIONDATETIME, vw.PHASTATUSID, vw.DATASOURCEKINDCODE, vw.ENDDATE, "
                    + "t1.DATASOURCEKINDNAME, c.COUNTRYCODE AS ALERTCOUNTRYCODE, ps.PHASTATUSNAME "
                    + "FROM VW_PHA vw "
                    + "LEFT JOIN DATASOURCEKIND t1 ON vw.DATASOURCEKINDCODE = t1.DATASOURCEKINDCODE "
                    + "LEFT JOIN COUNTRY c ON vw.ALERTCOUNTRYID = c.COUNTRYID "
                    + "LEFT JOIN PHASTATUS ps ON vw.PHASTATUSID = ps.PHASTATUSID "
                    + "WHERE vw.PHAID = ?";
    private static final String SQL_COUNTRY = "SELECT COUNTRYCODE FROM COUNTRY WHERE COUNTRYID = ?";
    private static final String SQL_STATUS = "SELECT PHASTATUSNAME FROM PHASTATUS WHERE PHASTATUSID = ?";
    private static final String SQL_DEPS = "SELECT DEPID FROM PHADEPPERMIS WHERE PHAID = ?";

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

            boolean written = tryWriteMetadata(conn, response, phaid, SQL_PHA);
            if (!written) {
                try {
                    written = tryWriteMetadata(conn, response, phaid, SQL_VW);
                } catch (SQLException e) {
                    if (e.getMessage() == null
                            || (!e.getMessage().contains("ORA-00942")
                            && !e.getMessage().contains("invalid object name")
                            && !e.getMessage().contains("VW_PHA"))) {
                        throw e;
                    }
                }
            }
            if (!written) {
                sendJsonError(response, HttpServletResponse.SC_NOT_FOUND, "Карта с PHAID " + phaid + " не найдена");
            }
        } catch (SQLException e) {
            System.err.println("[PhaMetadataServlet] DB error: " + e.getMessage());
            e.printStackTrace();
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        }
    }

    /**
     * @return true если найдена строка и ответ записан
     */
    private static boolean tryWriteMetadata(Connection conn, HttpServletResponse response, long phaid, String sql)
            throws SQLException, IOException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, phaid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return false;
                }
                long phaId = rs.getLong("PHAID");
                String incidentId = rs.getString("INCIDENTID");
                int phaVersion = 1;
                int phaVersionRaw = rs.getInt("PHAVERSION");
                if (!rs.wasNull()) {
                    phaVersion = phaVersionRaw;
                }
                Integer alertCountryId = toNullableInt(rs.getObject("ALERTCOUNTRYID"));
                Timestamp creationDateTime = rs.getTimestamp("CREATIONDATETIME");
                Timestamp modificationDateTime = rs.getTimestamp("MODIFICATIONDATETIME");
                Integer phaStatusId = toNullableInt(rs.getObject("PHASTATUSID"));
                String alertCountryCode = rs.getString("ALERTCOUNTRYCODE");
                if (alertCountryCode != null) alertCountryCode = alertCountryCode.trim();
                String phaStatusName = rs.getString("PHASTATUSNAME");
                if (phaStatusName != null) phaStatusName = phaStatusName.trim();
                String dataSourceKindName = rs.getString("DATASOURCEKINDNAME");
                if (dataSourceKindName != null) dataSourceKindName = dataSourceKindName.trim();
                String dataSourceKindCode = rs.getString("DATASOURCEKINDCODE");
                if (dataSourceKindCode != null) dataSourceKindCode = dataSourceKindCode.trim();
                String situationEndDateIso = null;
                try {
                    Date endD = rs.getDate("ENDDATE");
                    if (endD != null && !rs.wasNull()) {
                        situationEndDateIso = endD.toLocalDate().toString();
                    }
                } catch (SQLException ignored) {
                    /* колонка ENDDATE может отсутствовать */
                }

                if (alertCountryCode == null || alertCountryCode.isEmpty()) {
                    if (alertCountryId != null) {
                        try (PreparedStatement ps3 = conn.prepareStatement(SQL_COUNTRY)) {
                            ps3.setInt(1, alertCountryId);
                            try (ResultSet rs3 = ps3.executeQuery()) {
                                if (rs3.next()) alertCountryCode = rs3.getString("COUNTRYCODE");
                            }
                        }
                    }
                }
                if (phaStatusName == null && phaStatusId != null) {
                    try (PreparedStatement ps4 = conn.prepareStatement(SQL_STATUS)) {
                        ps4.setInt(1, phaStatusId);
                        try (ResultSet rs4 = ps4.executeQuery()) {
                            if (rs4.next()) phaStatusName = rs4.getString("PHASTATUSNAME");
                            if (phaStatusName != null) phaStatusName = phaStatusName.trim();
                        }
                    }
                }

                StringBuilder json = new StringBuilder();
                json.append("{");
                json.append("\"phaId\":").append(phaId);
                json.append(",\"incidentId\":\"").append(escapeJson(incidentId != null ? incidentId : ""));
                json.append("\",\"phaVersion\":").append(phaVersion);
                if (alertCountryCode != null) json.append(",\"alertCountryCode\":\"").append(escapeJson(alertCountryCode)).append("\"");
                if (dataSourceKindName != null && !dataSourceKindName.isEmpty()) {
                    json.append(",\"dataSourceKindName\":\"").append(escapeJson(dataSourceKindName)).append("\"");
                }
                if (dataSourceKindCode != null && !dataSourceKindCode.isEmpty()) {
                    json.append(",\"dataSourceKindCode\":\"").append(escapeJson(dataSourceKindCode)).append("\"");
                }
                if (situationEndDateIso != null && !situationEndDateIso.isEmpty()) {
                    json.append(",\"situationEndDate\":\"").append(escapeJson(situationEndDateIso)).append("\"");
                }
                json.append(",\"phaAccessibleDepIds\":[");
                boolean firstDep = true;
                try (PreparedStatement psDep = conn.prepareStatement(SQL_DEPS)) {
                    psDep.setLong(1, phaId);
                    try (ResultSet rsDep = psDep.executeQuery()) {
                        while (rsDep.next()) {
                            String depId = rsDep.getString(1);
                            if (depId == null) continue;
                            depId = depId.trim();
                            if (depId.isEmpty()) continue;
                            if (!firstDep) json.append(',');
                            firstDep = false;
                            json.append('"').append(escapeJson(depId)).append('"');
                        }
                    }
                }
                json.append(']');
                if (creationDateTime != null) {
                    json.append(",\"creationDateTime\":\"").append(creationDateTime.toInstant().toString()).append("\"");
                }
                if (modificationDateTime != null) {
                    json.append(",\"modificationDateTime\":\"").append(modificationDateTime.toInstant().toString()).append("\"");
                }
                if (phaStatusName != null) json.append(",\"phaStatusName\":\"").append(escapeJson(phaStatusName)).append("\"");
                if (phaStatusId != null) json.append(",\"phaStatusId\":").append(phaStatusId);
                json.append("}");
                response.getWriter().print(json.toString());
                return true;
            }
        }
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }

    /**
     * Oracle NUMBER может приходить как BigDecimal, поэтому прямой cast к Integer небезопасен.
     */
    private static Integer toNullableInt(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).intValue();
        try {
            return Integer.valueOf(String.valueOf(v).trim());
        } catch (Exception e) {
            return null;
        }
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        String escaped = message != null ? escapeJson(message) : "Unknown error";
        response.getWriter().print("{\"error\":\"" + escaped + "\"}");
    }
}
