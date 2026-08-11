package com.eec.util;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Разрешение AUTHORITYUID → AUTHORITYID для таблицы SMR.
 */
public final class SmrAuthorityDbSupport {

    private static final String SQL_AUTHORITY_ID_BY_UID =
            "SELECT AUTHORITYID FROM AUTHORITY WHERE TRIM(AUTHORITYUID) = ?";

    private static final String SQL_AUTHORITY_ID_BY_UID_SESINT =
            "SELECT AUTHORITYID FROM SESINT.AUTHORITY WHERE TRIM(AUTHORITYUID) = ?";

    private static final String SQL_AUTHORITY_ID_EXISTS =
            "SELECT AUTHORITYID FROM AUTHORITY WHERE AUTHORITYID = ?";

    private static final String SQL_AUTHORITY_ID_EXISTS_SESINT =
            "SELECT AUTHORITYID FROM SESINT.AUTHORITY WHERE AUTHORITYID = ?";

    private static final String SQL_UPDATE_SMR_AUTHORITY =
            "UPDATE SMR SET AUTHORITYID = ? WHERE SMRID = ? "
            + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = '2'";

    private static final String SQL_UPDATE_SMAQ_AUTHORITY =
            "UPDATE SMAQ SET AUTHORITYID = ? WHERE SMAQID = ? "
            + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = '2'";

    private SmrAuthorityDbSupport() {
    }

    /**
     * Разрешает идентификатор УО из metadata (UID из справочника) в AUTHORITYID для SMR.
     */
    public static Integer resolveAuthorityId(Connection conn, String authorityIdStr) throws SQLException {
        if (authorityIdStr == null || authorityIdStr.trim().isEmpty()) {
            return null;
        }
        String trimmed = authorityIdStr.trim();
        Integer byUid = lookupAuthorityIdByUid(conn, SQL_AUTHORITY_ID_BY_UID, trimmed);
        if (byUid != null) {
            return byUid;
        }
        byUid = lookupAuthorityIdByUid(conn, SQL_AUTHORITY_ID_BY_UID_SESINT, trimmed);
        if (byUid != null) {
            return byUid;
        }
        try {
            int numericId = Integer.parseInt(trimmed);
            if (numericId > 0 && authorityIdExists(conn, numericId)) {
                return numericId;
            }
        } catch (NumberFormatException ignored) {
            // not a numeric AUTHORITYID
        }
        return null;
    }

    /** Записывает AUTHORITYID после INSERT SMR (как при редактировании через UPDATE). */
    public static void updateSmrAuthorityId(Connection conn, long smrId, Integer authorityId) throws SQLException {
        updateAuthorityId(conn, SQL_UPDATE_SMR_AUTHORITY, smrId, authorityId);
    }

    /** Записывает AUTHORITYID после INSERT SMAQ. */
    public static void updateSmaqAuthorityId(Connection conn, long smaqId, Integer authorityId) throws SQLException {
        updateAuthorityId(conn, SQL_UPDATE_SMAQ_AUTHORITY, smaqId, authorityId);
    }

    private static void updateAuthorityId(Connection conn, String sql, long cardId, Integer authorityId)
            throws SQLException {
        if (authorityId == null) {
            return;
        }
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, authorityId);
            ps.setLong(2, cardId);
            ps.executeUpdate();
        } catch (SQLException e) {
            String m = e.getMessage() != null ? e.getMessage() : "";
            if (!m.contains("ORA-00904")) {
                throw e;
            }
        }
    }

    private static Integer lookupAuthorityIdByUid(Connection conn, String sql, String uid) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, uid);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    int id = rs.getInt("AUTHORITYID");
                    return rs.wasNull() ? null : id;
                }
            }
        }
        return null;
    }

    private static boolean authorityIdExists(Connection conn, int authorityId) throws SQLException {
        for (String sql : new String[]{SQL_AUTHORITY_ID_EXISTS, SQL_AUTHORITY_ID_EXISTS_SESINT}) {
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setInt(1, authorityId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        return true;
                    }
                }
            } catch (SQLException e) {
                String m = e.getMessage() != null ? e.getMessage() : "";
                if (!m.contains("ORA-00904") && !m.contains("ORA-00942")) {
                    throw e;
                }
            }
        }
        return false;
    }
}
