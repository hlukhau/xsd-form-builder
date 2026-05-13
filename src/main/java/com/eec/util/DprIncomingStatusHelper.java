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
}
