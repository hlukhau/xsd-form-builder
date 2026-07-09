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
        try (PreparedStatement ps = conn.prepareStatement(SQL_AUTHORITY_ID_BY_UID)) {
            ps.setString(1, trimmed);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt("AUTHORITYID");
                }
            }
        }
        return null;
    }
}
