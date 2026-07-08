package com.eec.util;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Идентификаторы статусов исходящей SMR из справочника {@code SMRSTATUS}
 * ({@code DATASOURCEKINDCODE = 2}, {@code SMRSTATUSACTFL = 1}), по коду {@code SMRSTATUSCODE}.
 */
public final class SmrOutgoingStatusHelper {

    private static final String DSC_OUT = "2";

    private static final String SQL_RESOLVE = ""
            + "SELECT SMRSTATUSID FROM SMRSTATUS "
            + "WHERE TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
            + "  AND TRIM(UPPER(SMRSTATUSCODE)) = TRIM(UPPER(?)) "
            + "  AND SMRSTATUSACTFL = 1 AND ROWNUM = 1";

    private SmrOutgoingStatusHelper() {
    }

    /**
     * @return {@code SMRSTATUSID} или {@code null}, если строка справочника не найдена
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
                int id = rs.getInt("SMRSTATUSID");
                return rs.wasNull() ? null : id;
            }
        }
    }

    /**
     * Начальный статус при создании исходящей SMR: DRAFT, если есть в справочнике, иначе NEW
     * (в SMRSTATUS для DATASOURCEKINDCODE=2 часто задан только NEW).
     */
    public static Integer resolveOutgoingInitialCreateStatusId(Connection conn) throws SQLException {
        Integer draft = resolveOutgoingStatusId(conn, "DRAFT");
        if (draft != null) {
            return draft;
        }
        return resolveOutgoingStatusId(conn, "NEW");
    }

    public static String resolveOutgoingStatusName(Connection conn, int statusId) throws SQLException {
        if (statusId <= 0) {
            return null;
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT TRIM(SMRSTATUSNAME) AS NM FROM SMRSTATUS WHERE SMRSTATUSID = ? AND ROWNUM = 1")) {
            ps.setInt(1, statusId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getString("NM") : null;
            }
        }
    }
}
