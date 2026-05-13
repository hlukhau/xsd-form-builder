package com.eec.util;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Идентификаторы статусов исходящей DPR из справочника {@code DPRSTATUS}
 * ({@code DATASOURCEKINDCODE = 2}, {@code DPRSTATUSACTFL = 1}), по коду {@code DPRSTATUSCODE}.
 */
public final class DprOutgoingStatusHelper {

    private static final String DSC_OUT = "2";

    private static final String SQL_RESOLVE = ""
            + "SELECT DPRSTATUSID FROM DPRSTATUS "
            + "WHERE TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
            + "  AND TRIM(UPPER(DPRSTATUSCODE)) = TRIM(UPPER(?)) "
            + "  AND DPRSTATUSACTFL = 1 AND ROWNUM = 1";

    private DprOutgoingStatusHelper() {
    }

    /**
     * @return {@code DPRSTATUSID} или {@code null}, если строка справочника не найдена
     */
    public static Integer resolveOutgoingStatusId(Connection conn, String dprStatusCode) throws SQLException {
        if (dprStatusCode == null || dprStatusCode.trim().isEmpty()) {
            return null;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_RESOLVE)) {
            ps.setString(1, DSC_OUT);
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
}
