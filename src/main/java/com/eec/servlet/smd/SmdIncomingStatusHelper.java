package com.eec.servlet.smd;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Статусы входящей карты SMD ({@code DATASOURCEKINDCODE = 1}) из {@code SMDSTATUS}.
 */
final class SmdIncomingStatusHelper {

    static final String DATASOURCE_INCOMING = "1";

    private static final String SQL_RESOLVE = ""
            + "SELECT SMDSTATUSID FROM SMDSTATUS "
            + "WHERE TRIM(UPPER(SMDSTATUSCODE)) = TRIM(UPPER(?)) "
            + "  AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
            + "  AND SMDSTATUSACTFL = 1 AND ROWNUM = 1";

    private static final String SQL_UPDATE_RECEIVED_TO_PROCESSING = ""
            + "UPDATE SMD SET SMDSTATUSID = ? "
            + "WHERE SMDID = ? "
            + "  AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
            + "  AND SMDSTATUSID = ?";

    private static final String SQL_INSERT_STATUS_HIST = ""
            + "INSERT INTO SMDSTATUSHIST (SMDID, SMDSTATUSID, SMDSTATUSDATETIME, USERID) "
            + "VALUES (?, ?, SYSDATE, ?)";

    private SmdIncomingStatusHelper() {
    }

    static Integer resolveIncomingStatusId(Connection conn, String smdStatusCode) throws SQLException {
        if (smdStatusCode == null || smdStatusCode.trim().isEmpty()) {
            return null;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_RESOLVE)) {
            ps.setString(1, smdStatusCode.trim());
            ps.setString(2, DATASOURCE_INCOMING);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                int id = rs.getInt("SMDSTATUSID");
                return rs.wasNull() ? null : id;
            }
        }
    }

    /**
     * Получено (RECEIVED) → В обработке (PROCESSING) при первичном открытии входящей карты.
     * Безопасно при повторных открытиях (0 строк UPDATE).
     *
     * @return {@code true}, если переход выполнен
     */
    static boolean applyReceivedToProcessingOnFirstOpen(Connection conn, long smdid, Integer userId)
            throws SQLException {
        if (smdid <= 0) {
            return false;
        }
        Integer processingId = resolveIncomingStatusId(conn, "PROCESSING");
        Integer receivedId = resolveIncomingStatusId(conn, "RECEIVED");
        if (processingId == null || receivedId == null) {
            return false;
        }
        int updated;
        try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_RECEIVED_TO_PROCESSING)) {
            ps.setInt(1, processingId);
            ps.setLong(2, smdid);
            ps.setString(3, DATASOURCE_INCOMING);
            ps.setInt(4, receivedId);
            updated = ps.executeUpdate();
        }
        if (updated == 0) {
            return false;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_STATUS_HIST)) {
            ps.setLong(1, smdid);
            ps.setInt(2, processingId);
            if (userId != null) {
                ps.setInt(3, userId);
            } else {
                ps.setNull(3, java.sql.Types.INTEGER);
            }
            ps.executeUpdate();
        }
        return true;
    }

    static String resolveIncomingStatusName(Connection conn, int smdStatusId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT TRIM(SMDSTATUSNAME) AS NM FROM SMDSTATUS WHERE SMDSTATUSID = ? AND ROWNUM = 1")) {
            ps.setInt(1, smdStatusId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    String n = rs.getString("NM");
                    return n != null && !n.trim().isEmpty() ? n.trim() : null;
                }
            }
        }
        return null;
    }

    /**
     * В обработке (PROCESSING) → Обработано (PROCESSED) при завершении обработки входящей карты.
     *
     * @return {@code true}, если переход выполнен
     */
    static boolean applyProcessingToProcessedOnComplete(Connection conn, long smdid, Integer userId)
            throws SQLException {
        if (smdid <= 0) {
            return false;
        }
        Integer processedId = resolveIncomingStatusId(conn, "PROCESSED");
        Integer processingId = resolveIncomingStatusId(conn, "PROCESSING");
        if (processedId == null || processingId == null) {
            return false;
        }
        int updated;
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE SMD SET SMDSTATUSID = ? "
                        + "WHERE SMDID = ? "
                        + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
                        + "AND SMDSTATUSID = ?")) {
            ps.setInt(1, processedId);
            ps.setLong(2, smdid);
            ps.setString(3, DATASOURCE_INCOMING);
            ps.setInt(4, processingId);
            updated = ps.executeUpdate();
        }
        if (updated == 0) {
            return false;
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO SMDSTATUSHIST (SMDID, SMDSTATUSID, SMDSTATUSDATETIME, USERID) "
                        + "VALUES (?, ?, SYSDATE, ?)")) {
            ps.setLong(1, smdid);
            ps.setInt(2, processedId);
            if (userId != null) {
                ps.setInt(3, userId);
            } else {
                ps.setNull(3, java.sql.Types.INTEGER);
            }
            ps.executeUpdate();
        }
        return true;
    }
}
