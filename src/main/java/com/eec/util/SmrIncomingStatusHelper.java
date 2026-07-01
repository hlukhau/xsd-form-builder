package com.eec.util;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Идентификаторы статусов входящей SMR из {@code SMRSTATUS}
 * ({@code DATASOURCEKINDCODE = 1}, {@code SMRSTATUSACTFL = 1}), по {@code SMRSTATUSCODE}.
 */
public final class SmrIncomingStatusHelper {

    private static final String DSC_IN = "1";

    private static final String SQL_RESOLVE = ""
            + "SELECT SMRSTATUSID FROM SMRSTATUS "
            + "WHERE TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
            + "  AND TRIM(UPPER(SMRSTATUSCODE)) = TRIM(UPPER(?)) "
            + "  AND SMRSTATUSACTFL = 1 AND ROWNUM = 1";

    private static final String SQL_UPDATE_RECEIVED_TO_PROCESSING = ""
            + "UPDATE SMR SET SMRSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE "
            + "WHERE SMRID = ? AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? AND SMRSTATUSID = ?";

    private static final String SQL_INSERT_STATUS_HIST = ""
            + "INSERT INTO SMRSTATUSHIST (SMRID, SMRSTATUSID, SMRSTATUSDATETIME, USERID) "
            + "VALUES (?, ?, SYSDATE, ?)";

    private SmrIncomingStatusHelper() {
    }

    /** @return {@code SMRSTATUSID} или {@code null}, если строка справочника не найдена */
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
                int id = rs.getInt("SMRSTATUSID");
                return rs.wasNull() ? null : id;
            }
        }
    }

    /** Наименование статуса для ответа API (после смены статуса). */
    public static String resolveIncomingStatusName(Connection conn, int dprStatusId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT TRIM(SMRSTATUSNAME) AS NM FROM SMRSTATUS WHERE SMRSTATUSID = ? AND ROWNUM = 1")) {
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
    public static boolean applyReceivedToProcessingOnFirstOpen(Connection conn, long smrId, Integer userId)
            throws SQLException {
        if (smrId <= 0) {
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
            ps.setLong(2, smrId);
            ps.setString(3, DSC_IN);
            ps.setInt(4, receivedId);
            updated = ps.executeUpdate();
        }
        if (updated == 0) {
            return false;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_STATUS_HIST)) {
            ps.setLong(1, smrId);
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
