package com.eec.util;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.Set;

/**
 * Пересечение подразделений из JSON прав с активными строками {@code PPVDEPPERMIS} по карте PPV.
 */
public final class PpvDepPermisUtil {

    private static final String SQL_PPVDEPPERMIS_DEPIDS = ""
            + "SELECT DEPID FROM PPVDEPPERMIS WHERE PPVID = ? AND REVOKEDATETIME IS NULL";

    private PpvDepPermisUtil() {
    }

    public static String normalizeDepIdKey(String s) {
        if (s == null) {
            return "";
        }
        String t = s.trim();
        if (t.isEmpty()) {
            return "";
        }
        try {
            return String.valueOf(Long.parseLong(t));
        } catch (NumberFormatException e) {
            return t;
        }
    }

    /**
     * @return true, если хотя бы один DEPID карты (PPVDEPPERMIS) совпадает с ключами из {@code rightsDepKeys} (после нормализации).
     */
    public static boolean hasOverlap(Connection conn, long ppvid, Set<String> rightsDepKeys) throws SQLException {
        Set<String> normalizedRights = new HashSet<>();
        for (String k : rightsDepKeys) {
            String n = normalizeDepIdKey(k);
            if (!n.isEmpty()) {
                normalizedRights.add(n);
            }
        }
        if (normalizedRights.isEmpty()) {
            return false;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_PPVDEPPERMIS_DEPIDS)) {
            ps.setLong(1, ppvid);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Object v = rs.getObject("DEPID");
                    if (v == null) {
                        continue;
                    }
                    String rowKey = normalizeDepIdKey(String.valueOf(v));
                    if (!rowKey.isEmpty() && normalizedRights.contains(rowKey)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
