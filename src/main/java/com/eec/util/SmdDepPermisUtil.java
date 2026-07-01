package com.eec.util;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.Set;

/**
 * Пересечение подразделений из JSON прав с активными строками {@code SMDDEPPERMIS} по карте SMD.
 */
public final class SmdDepPermisUtil {

    private static final String SQL_SMDDEPPERMIS_DEPIDS = "SELECT DEPID FROM SMDDEPPERMIS WHERE SMDID = ?";

    private SmdDepPermisUtil() {
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

    public static boolean hasOverlap(Connection conn, long smdid, Set<String> rightsDepKeys) throws SQLException {
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
        try (PreparedStatement ps = conn.prepareStatement(SQL_SMDDEPPERMIS_DEPIDS)) {
            ps.setLong(1, smdid);
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
