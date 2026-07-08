package com.eec.util;

import com.eec.servlet.sma.SmaCardKind;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Идентификаторы статусов исходящих SMAQ/SMAR из справочников {@code SMAQSTATUS}/{@code SMARSTATUS}
 * ({@code DATASOURCEKINDCODE = 2}, {@code *STATUSACTFL = 1}), по коду {@code *STATUSCODE}.
 */
public final class SmaOutgoingStatusHelper {

    private static final String DSC_OUT = "2";

    private static final String SQL_SMAQ_RESOLVE = ""
            + "SELECT SMAQSTATUSID FROM SMAQSTATUS "
            + "WHERE TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
            + "  AND TRIM(UPPER(SMAQSTATUSCODE)) = TRIM(UPPER(?)) "
            + "  AND SMAQSTATUSACTFL = 1 AND ROWNUM = 1";

    private static final String SQL_SMAR_RESOLVE = ""
            + "SELECT SMARSTATUSID FROM SMARSTATUS "
            + "WHERE TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
            + "  AND TRIM(UPPER(SMARSTATUSCODE)) = TRIM(UPPER(?)) "
            + "  AND SMARSTATUSACTFL = 1 AND ROWNUM = 1";

    private SmaOutgoingStatusHelper() {
    }

    public static Integer resolveOutgoingStatusId(Connection conn, SmaCardKind kind, String statusCode)
            throws SQLException {
        if (kind == null || statusCode == null || statusCode.trim().isEmpty()) {
            return null;
        }
        String sql = kind == SmaCardKind.SMAQ ? SQL_SMAQ_RESOLVE : SQL_SMAR_RESOLVE;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, DSC_OUT);
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
}
