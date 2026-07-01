package com.eec.servlet.smr;

import com.eec.rights.RightsRegistryProvider;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Доступ к карте SMR по связи {@code SMR.SMDID} и подразделениям {@code SMDDEPPERMIS}.
 */
public final class SmrAccessHelper {

    private SmrAccessHelper() {
    }

    public static boolean canViewSmr(Connection conn, long smrId, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty()) {
            return false;
        }
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid.trim());
        if (rightsJson == null || rightsJson.isEmpty()) {
            return false;
        }

        long smdid = loadSmdid(conn, smrId);
        if (smdid <= 0) {
            return false;
        }

        String smdDsc = loadSmdDatasource(conn, smdid);
        if (smdDsc == null) {
            return false;
        }

        Set<String> cardDepIds = loadSmdDepIds(conn, smdid);
        if (cardDepIds.isEmpty()) {
            return false;
        }

        Set<String> userViewDepIds = parseViewDepIds(rightsJson, smdDsc);
        for (String depId : userViewDepIds) {
            if (cardDepIds.contains(depId)) {
                return true;
            }
        }
        return false;
    }

    private static long loadSmdid(Connection conn, long smrId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SmrDbSupport.SQL_SMDID_BY_SMR)) {
            ps.setLong(1, smrId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    long v = rs.getLong("SMDID");
                    return rs.wasNull() ? 0L : v;
                }
            }
        }
        return 0L;
    }

    private static String loadSmdDatasource(Connection conn, long smdid) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SmrDbSupport.SQL_SMD_DATASOURCE)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getString("DSC");
                }
            }
        }
        return null;
    }

    private static Set<String> loadSmdDepIds(Connection conn, long smdid) throws SQLException {
        Set<String> out = new HashSet<>();
        try (PreparedStatement ps = conn.prepareStatement(SmrDbSupport.SQL_SMD_DEPS)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String depId = rs.getString(1);
                    if (depId != null && !depId.trim().isEmpty()) {
                        out.add(depId.trim());
                    }
                }
            }
        }
        return out;
    }

    private static Set<String> parseViewDepIds(String json, String smdDatasourceKindCode) {
        String block;
        if ("1".equals(smdDatasourceKindCode)) {
            block = "sanitaryMeasureIn";
        } else if ("3".equals(smdDatasourceKindCode)) {
            block = "sanitaryMeasureDB";
        } else {
            block = "sanitaryMeasureOut";
        }
        return parseDepIdsFromRightsBlock(json, block, "view");
    }

    private static Set<String> parseDepIdsFromRightsBlock(String json, String topKey, String subKey) {
        Set<String> out = new HashSet<>();
        if (json == null) {
            return out;
        }
        int topStart = json.indexOf("\"" + topKey + "\"");
        if (topStart < 0) {
            return out;
        }
        int subStart = json.indexOf("\"" + subKey + "\"", topStart);
        if (subStart < 0) {
            return out;
        }
        int braceStart = json.indexOf('{', subStart);
        if (braceStart < 0) {
            return out;
        }
        int depth = 1;
        int i = braceStart + 1;
        while (i < json.length() && depth > 0) {
            char c = json.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') depth--;
            i++;
        }
        String editBlock = depth == 0 ? json.substring(braceStart, i) : "";
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(editBlock);
        while (keyM.find()) {
            out.add(keyM.group(1).trim());
        }
        return out;
    }
}
