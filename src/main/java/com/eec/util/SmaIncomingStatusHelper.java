package com.eec.util;

import com.eec.servlet.sma.SmaCardKind;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Идентификаторы статусов входящих SMAQ/SMAR из {@code SMAQSTATUS}/{@code SMARSTATUS}
 * ({@code DATASOURCEKINDCODE = 1}, {@code *STATUSACTFL = 1}), по коду {@code *STATUSCODE}.
 */
public final class SmaIncomingStatusHelper {

    private static final String DSC_IN = "1";

    private SmaIncomingStatusHelper() {
    }

    /** @return идентификатор статуса или {@code null}, если строка справочника не найдена */
    public static Integer resolveIncomingStatusId(Connection conn, SmaCardKind kind, String statusCode)
            throws SQLException {
        if (kind == null || statusCode == null || statusCode.trim().isEmpty()) {
            return null;
        }
        String sql = kind == SmaCardKind.SMAQ
                ? "SELECT SMAQSTATUSID FROM SMAQSTATUS WHERE TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
                + "AND TRIM(UPPER(SMAQSTATUSCODE)) = TRIM(UPPER(?)) AND SMAQSTATUSACTFL = 1 AND ROWNUM = 1"
                : "SELECT SMARSTATUSID FROM SMARSTATUS WHERE TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
                + "AND TRIM(UPPER(SMARSTATUSCODE)) = TRIM(UPPER(?)) AND SMARSTATUSACTFL = 1 AND ROWNUM = 1";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, DSC_IN);
            ps.setString(2, statusCode.trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                int id = rs.getInt(1);
                return rs.wasNull() ? null : id;
            }
        }
    }

    public static String resolveIncomingStatusName(Connection conn, SmaCardKind kind, int statusId)
            throws SQLException {
        String sql = kind == SmaCardKind.SMAQ
                ? "SELECT TRIM(SMAQSTATUSNAME) AS NM FROM SMAQSTATUS WHERE SMAQSTATUSID = ? AND ROWNUM = 1"
                : "SELECT TRIM(SMARSTATUSNAME) AS NM FROM SMARSTATUS WHERE SMARSTATUSID = ? AND ROWNUM = 1";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, statusId);
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
     *
     * @return {@code true}, если переход выполнен
     */
    public static boolean applyReceivedToProcessingOnFirstOpen(Connection conn, SmaCardKind kind, long cardId,
                                                               Integer userId) throws SQLException {
        if (cardId <= 0 || kind == null) {
            return false;
        }
        Integer processingId = resolveIncomingStatusId(conn, kind, "PROCESSING");
        Integer receivedId = resolveIncomingStatusId(conn, kind, "RECEIVED");
        if (processingId == null || receivedId == null) {
            return false;
        }
        String updateSql;
        String histSql;
        if (kind == SmaCardKind.SMAQ) {
            updateSql = "UPDATE SMAQ SET SMAQSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE "
                    + "WHERE SMAQID = ? AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? AND SMAQSTATUSID = ?";
            histSql = "INSERT INTO SMAQSTATUSHIST (SMAQID, SMAQSTATUSID, SMAQSTATUSDATETIME, USERID) "
                    + "VALUES (?, ?, SYSDATE, ?)";
        } else {
            updateSql = "UPDATE SMAR SET SMARSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE "
                    + "WHERE SMARID = ? AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? AND SMARSTATUSID = ?";
            histSql = "INSERT INTO SMARSTATUSHIST (SMARID, SMARSTATUSID, SMARSTATUSDATETIME, USERID) "
                    + "VALUES (?, ?, SYSDATE, ?)";
        }
        int updated;
        try (PreparedStatement ps = conn.prepareStatement(updateSql)) {
            ps.setInt(1, processingId);
            ps.setLong(2, cardId);
            ps.setString(3, DSC_IN);
            ps.setInt(4, receivedId);
            updated = ps.executeUpdate();
        }
        if (updated == 0) {
            return false;
        }
        try (PreparedStatement ps = conn.prepareStatement(histSql)) {
            ps.setLong(1, cardId);
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
