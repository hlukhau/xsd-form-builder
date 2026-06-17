package com.eec.util;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Идентификаторы статусов входящей DPR из {@code DPRSTATUS}
 * ({@code DATASOURCEKINDCODE = 1}, {@code DPRSTATUSACTFL = 1}), по {@code DPRSTATUSCODE}.
 */
public final class DprIncomingStatusHelper {

    private static final String DSC_IN = "1";

    private static final String SQL_RESOLVE = ""
            + "SELECT DPRSTATUSID FROM DPRSTATUS "
            + "WHERE TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
            + "  AND TRIM(UPPER(DPRSTATUSCODE)) = TRIM(UPPER(?)) "
            + "  AND DPRSTATUSACTFL = 1 AND ROWNUM = 1";

    private static final String SQL_UPDATE_RECEIVED_TO_PROCESSING = ""
            + "UPDATE DPR SET DPRSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE "
            + "WHERE DPRID = ? AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? AND DPRSTATUSID = ?";

    private static final String SQL_INSERT_STATUS_HIST = ""
            + "INSERT INTO DPRSTATUSHIST (DPRID, DPRSTATUSID, DPRSTATUSDATETIME, USERID) "
            + "VALUES (?, ?, SYSDATE, ?)";

    private DprIncomingStatusHelper() {
    }

    /** @return {@code DPRSTATUSID} или {@code null}, если строка справочника не найдена */
    public static Integer resolveIncomingStatusId(Connection conn, String dprStatusCode) throws SQLException {
        if (dprStatusCode == null || dprStatusCode.trim().isEmpty()) {
            return null;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_RESOLVE)) {
            ps.setString(1, DSC_IN);
            ps.setString(2, dprStatusCode.trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                int id = rs.getInt("DPRSTATUSID");
                return rs.wasNull() ? null : id;
            }
        }
    }

    /** Наименование статуса для ответа API (после смены статуса). */
    public static String resolveIncomingStatusName(Connection conn, int dprStatusId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT TRIM(DPRSTATUSNAME) AS NM FROM DPRSTATUS WHERE DPRSTATUSID = ? AND ROWNUM = 1")) {
            ps.setInt(1, dprStatusId);
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
     * Получено (RECEIVED) → В обработке (PROCESSING) при первичном открытии входящей карты.
     * Безопасно при повторных открытиях (0 строк UPDATE).
     *
     * @return {@code true}, если переход выполнен
     */
    public static boolean applyReceivedToProcessingOnFirstOpen(Connection conn, long dprId, Integer userId)
            throws SQLException {
        if (dprId <= 0) {
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
            ps.setLong(2, dprId);
            ps.setString(3, DSC_IN);
            ps.setInt(4, receivedId);
            updated = ps.executeUpdate();
        }
        if (updated == 0) {
            return false;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_STATUS_HIST)) {
            ps.setLong(1, dprId);
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
}
