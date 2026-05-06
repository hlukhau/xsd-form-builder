package com.eec.servlet.ppv;

import com.eec.rights.RightsRegistryProvider;
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
import java.sql.Savepoint;
import java.sql.Timestamp;
import java.sql.Types;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Сервлет для получения метаданных карты из вью VW_PPV (шапка карты).
 * GET /api/ppv/metadata/{PPVID}
 * <p>
 * Входящие сведения (DATASOURCEKINDCODE=1): при первом открытии карты для просмотра, если текущий статус
 * RECEIVED (PPVSTATUSCODE), в той же транзакции выполняется переход в PROCESSING и запись в PPVSTATUSHIST
 * (USERID — из JSON прав по параметру {@code guid}).
 */
public class PpvMetadataServlet extends HttpServlet {

    private static final String SQL = ""
            + "SELECT vw.INCIDENTID, vw.ALERTCOUNTRYNAME, vw.ALERTCOUNTRYID, vw.DATASOURCEKINDCODE, t1.DATASOURCEKINDNAME, "
            + "       vw.CREATIONDATETIME, vw.MODIFICATIONDATETIME, vw.PPVSTATUSID, vw.PPVSTATUSNAME, c.COUNTRYCODE AS ALERTCOUNTRYCODE, "
            + "       a.AUTHORITYUID AS AUTHORITY_UID, a.AUTHORITYNAME AS AUTHORITY_NAME, a.AUTHORITYBRIEFNAME AS AUTHORITY_BRIEFNAME, a.COUNTRYCODE AS AUTHORITY_COUNTRYCODE "
            + "FROM VW_PPV vw "
            + "LEFT JOIN DATASOURCEKIND t1 ON vw.DATASOURCEKINDCODE = t1.DATASOURCEKINDCODE "
            + "LEFT JOIN COUNTRY c ON vw.ALERTCOUNTRYID = c.COUNTRYID AND c.COUNTRYSDATE <= SYSDATE AND c.COUNTRYEDATE >= SYSDATE "
            + "LEFT JOIN PPV d ON d.PPVID = vw.PPVID "
            + "LEFT JOIN AUTHORITY a ON a.AUTHORITYID = d.AUTHORITYID "
            + "WHERE vw.PPVID = ?";

    private static final String SQL_STATUS_ID_BY_CODE_INCOMING = ""
            + "SELECT PPVSTATUSID FROM PPVSTATUS "
            + "WHERE TRIM(UPPER(PPVSTATUSCODE)) = TRIM(UPPER(?)) "
            + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
            + "AND PPVSTATUSACTFL = 1 AND ROWNUM = 1";

    private static final String SQL_UPDATE_INCOMING_RECEIVED_TO_PROCESSING = ""
            + "UPDATE PPV SET PPVSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE "
            + "WHERE PPVID = ? AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = '1' AND PPVSTATUSID = ?";

    private static final String SQL_INSERT_STATUS_HIST = ""
            + "INSERT INTO PPVSTATUSHIST (PPVID, PPVSTATUSID, PPVSTATUSDATETIME, USERID) "
            + "VALUES (?, ?, SYSDATE, ?)";

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[PpvMetadataServlet] Initialized");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите PPVID в пути: /api/ppv/metadata/{PPVID}");
            return;
        }

        String dpaidStr = pathInfo.startsWith("/") ? pathInfo.substring(1) : pathInfo;
        if (dpaidStr.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "PPVID не задан");
            return;
        }

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String guidParam = request.getParameter("guid");
        if (guidParam != null) guidParam = guidParam.trim();
        if (guidParam != null && guidParam.isEmpty()) guidParam = null;

        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;

        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guidParam);
            conn.setAutoCommit(false);
            Savepoint beforeTransition = conn.setSavepoint("ppv_meta_before_incoming_open");
            try {
                long ppvidNum;
                try {
                    ppvidNum = Long.parseLong(dpaidStr.trim());
                } catch (NumberFormatException e) {
                    ppvidNum = -1;
                }
                if (ppvidNum > 0) {
                    applyIncomingReceivedToProcessingOnFirstOpen(conn, ppvidNum, guidParam);
                }
            } catch (SQLException e) {
                System.err.println("[PpvMetadataServlet] Incoming RECEIVED→PROCESSING skipped: " + e.getMessage());
                try {
                    conn.rollback(beforeTransition);
                } catch (SQLException rb) {
                    DatabaseUtil.rollbackQuietly(conn);
                }
            }

            ps = conn.prepareStatement(SQL);
            try {
                ps.setLong(1, Long.parseLong(dpaidStr));
            } catch (NumberFormatException e) {
                ps.setString(1, dpaidStr);
            }

            rs = ps.executeQuery();
            if (!rs.next()) {
                DatabaseUtil.rollbackQuietly(conn);
                sendJsonError(response, HttpServletResponse.SC_NOT_FOUND, "Запись с PPVID " + dpaidStr + " не найдена в VW_PPV");
                return;
            }

            String incidentId = getString(rs, "INCIDENTID");
            String alertCountryName = getString(rs, "ALERTCOUNTRYNAME");
            String alertCountryCode = getString(rs, "ALERTCOUNTRYCODE");
            Integer dpaVersion = null;
            String datasourceKindCode = getString(rs, "DATASOURCEKINDCODE");
            String datasourceKindName = getString(rs, "DATASOURCEKINDNAME");
            String creationDateTime = formatTimestamp(rs, "CREATIONDATETIME");
            String modificationDateTime = formatTimestamp(rs, "MODIFICATIONDATETIME");
            Integer dpaStatusId = getInt(rs, "PPVSTATUSID");
            String dpaStatusName = getString(rs, "PPVSTATUSNAME");
            String authorityUid = getString(rs, "AUTHORITY_UID");
            String authorityName = getString(rs, "AUTHORITY_NAME");
            String authorityBriefName = getString(rs, "AUTHORITY_BRIEFNAME");
            String authorityCountryCode = getString(rs, "AUTHORITY_COUNTRYCODE");

            StringBuilder json = new StringBuilder();
            json.append("{");
            json.append("\"incidentId\":").append(quote(incidentId));
            json.append(",\"alertCountryCode\":").append(quote(alertCountryCode));
            json.append(",\"alertCountryName\":").append(quote(alertCountryName));
            json.append(",\"dpaVersion\":").append(dpaVersion != null ? dpaVersion : "null");
            json.append(",\"datasourceKindCode\":").append(quote(datasourceKindCode));
            json.append(",\"datasourceKindName\":").append(quote(datasourceKindName));
            json.append(",\"creationDateTime\":").append(quote(creationDateTime));
            json.append(",\"modificationDateTime\":").append(quote(modificationDateTime));
            json.append(",\"dpaStatusId\":").append(dpaStatusId != null ? dpaStatusId : "null");
            json.append(",\"dpaStatusName\":").append(quote(dpaStatusName));
            json.append(",\"authorityUid\":").append(quote(authorityUid));
            json.append(",\"authorityName\":").append(quote(authorityName));
            json.append(",\"authorityBriefName\":").append(quote(authorityBriefName));
            json.append(",\"authorityCountryCode\":").append(quote(authorityCountryCode));
            json.append("}");

            conn.commit();
            response.setStatus(HttpServletResponse.SC_OK);
            PrintWriter out = response.getWriter();
            out.write(json.toString());
            out.flush();
            System.out.println("[PpvMetadataServlet] Served metadata for PPVID: " + dpaidStr);

        } catch (SQLException e) {
            DatabaseUtil.rollbackQuietly(conn);
            System.err.println("[PpvMetadataServlet] DB error for PPVID " + dpaidStr + ": " + e.getMessage());
            e.printStackTrace();
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            if (rs != null) try { rs.close(); } catch (SQLException ignored) { }
            if (ps != null) try { ps.close(); } catch (SQLException ignored) { }
            if (conn != null) {
                try {
                    conn.setAutoCommit(true);
                } catch (SQLException ignored) { }
            }
            DatabaseUtil.closeConnection(conn);
        }
    }

    /**
     * Получено (RECEIVED) → В обработке (PROCESSING) для входящей карты; безопасно при повторных открытиях (0 строк UPDATE).
     */
    private static void applyIncomingReceivedToProcessingOnFirstOpen(Connection conn, long ppvid, String guid)
            throws SQLException {
        Integer processingId = findIncomingPpvStatusIdByCode(conn, "PROCESSING");
        Integer receivedId = findIncomingPpvStatusIdByCode(conn, "RECEIVED");
        if (processingId == null || receivedId == null) {
            System.out.println("[PpvMetadataServlet] PPVSTATUS codes PROCESSING/RECEIVED not found for DATASOURCEKINDCODE=1; skip transition");
            return;
        }
        int updated;
        try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_INCOMING_RECEIVED_TO_PROCESSING)) {
            ps.setInt(1, processingId);
            ps.setLong(2, ppvid);
            ps.setInt(3, receivedId);
            updated = ps.executeUpdate();
        }
        if (updated == 0) {
            return;
        }
        Integer userId = resolveUserIdFromGuid(guid);
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_STATUS_HIST)) {
            ps.setLong(1, ppvid);
            ps.setInt(2, processingId);
            if (userId != null) {
                ps.setInt(3, userId);
            } else {
                ps.setNull(3, Types.INTEGER);
            }
            ps.executeUpdate();
        }
        System.out.println("[PpvMetadataServlet] Incoming first open: PPVID=" + ppvid + " RECEIVED→PROCESSING, userId=" + userId);
    }

    private static Integer findIncomingPpvStatusIdByCode(Connection conn, String statusCode) throws SQLException {
        if (statusCode == null || statusCode.trim().isEmpty()) {
            return null;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_STATUS_ID_BY_CODE_INCOMING)) {
            ps.setString(1, statusCode.trim());
            ps.setString(2, "1");
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                return rs.getInt("PPVSTATUSID");
            }
        }
    }

    private static Integer resolveUserIdFromGuid(String guid) {
        if (guid == null || guid.isEmpty()) {
            return null;
        }
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
            return null;
        }
        Matcher m = Pattern.compile("\"userId\"\\s*:\\s*(-?\\d+)").matcher(rightsJson);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        m = Pattern.compile("\"userId\"\\s*:\\s*\"(-?\\d+)\"").matcher(rightsJson);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private static String getString(ResultSet rs, String column) throws SQLException {
        try {
            return rs.getString(column);
        } catch (SQLException e) {
            return null;
        }
    }

    private static Integer getInt(ResultSet rs, String column) throws SQLException {
        try {
            int v = rs.getInt(column);
            return rs.wasNull() ? null : v;
        } catch (SQLException e) {
            return null;
        }
    }

    private static String formatTimestamp(ResultSet rs, String column) throws SQLException {
        try {
            Timestamp ts = rs.getTimestamp(column);
            if (ts == null) return null;
            return ts.toInstant().toString();
        } catch (SQLException e) {
            return null;
        }
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
