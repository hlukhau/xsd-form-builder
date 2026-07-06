package com.eec.servlet.smd;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Проверка возможности редактирования исходящей карты SMD (сохранение существующей).
 */
final class SmdEditSupport {

    private static final Set<String> EDITABLE_STATUS_CODES = new HashSet<>();

    static {
        EDITABLE_STATUS_CODES.add("NEW");
        EDITABLE_STATUS_CODES.add("FAILED");
        EDITABLE_STATUS_CODES.add("ERROR");
    }

    private static final String SQL_CARD = ""
            + "SELECT s.SMDID, TRIM(TO_CHAR(s.DATASOURCEKINDCODE)) AS DSC, "
            + "       TRIM(UPPER(NVL(st.SMDSTATUSCODE, ''))) AS STCODE "
            + "FROM SMD s "
            + "LEFT JOIN SMDSTATUS st ON st.SMDSTATUSID = s.SMDSTATUSID "
            + "WHERE s.SMDID = ?";

    private SmdEditSupport() {
    }

    static SmdDeleteSupport.Eligibility checkEditEligibility(Connection conn, long smdid, String rightsJson)
            throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_CARD)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return SmdDeleteSupport.Eligibility.deny("Карта с указанным SMDID не найдена");
                }
                String dsc = trimToEmpty(rs.getString("DSC"));
                if (!SmdDeleteSupport.DATASOURCE_OUTGOING.equals(dsc)) {
                    return SmdDeleteSupport.Eligibility.deny("Редактирование доступно только для исходящих карт");
                }
                String statusCode = trimToEmpty(rs.getString("STCODE"));
                if (!EDITABLE_STATUS_CODES.contains(statusCode)) {
                    return SmdDeleteSupport.Eligibility.deny(
                            "Редактирование недоступно для текущего статуса карты");
                }
            }
        }

        Set<String> cardDepIds = loadCardDepIds(conn, smdid);
        if (cardDepIds.isEmpty()) {
            return SmdDeleteSupport.Eligibility.deny("Нет доступа к карте: в доступе к карте нет подразделений");
        }
        if (rightsJson == null || rightsJson.trim().isEmpty()) {
            return SmdDeleteSupport.Eligibility.deny("Права по GUID не найдены");
        }
        Set<String> userEditDepIds = parseSanitaryMeasureOutEditDepIds(rightsJson);
        for (String depId : userEditDepIds) {
            if (cardDepIds.contains(depId)) {
                return new SmdDeleteSupport.Eligibility(true, null, null, null);
            }
        }
        return SmdDeleteSupport.Eligibility.deny(
                "Нет права sanitaryMeasureOut:edit в пределах ни одного подразделения, имеющего доступ к данной карте");
    }

    private static Set<String> loadCardDepIds(Connection conn, long smdid) throws SQLException {
        Set<String> out = new HashSet<>();
        try (PreparedStatement ps = conn.prepareStatement("SELECT DEPID FROM SMDDEPPERMIS WHERE SMDID = ?")) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    int depId = rs.getInt(1);
                    if (!rs.wasNull()) {
                        out.add(String.valueOf(depId));
                    }
                }
            }
        }
        return out;
    }

    private static Set<String> parseSanitaryMeasureOutEditDepIds(String rightsJson) {
        Set<String> out = new HashSet<>();
        int outStart = rightsJson.indexOf("\"sanitaryMeasureOut\"");
        if (outStart < 0) {
            return out;
        }
        int editStart = rightsJson.indexOf("\"edit\"", outStart);
        if (editStart < 0) {
            return out;
        }
        int braceStart = rightsJson.indexOf('{', editStart);
        if (braceStart < 0) {
            return out;
        }
        int depth = 1;
        int i = braceStart + 1;
        while (i < rightsJson.length() && depth > 0) {
            char c = rightsJson.charAt(i);
            if (c == '{') {
                depth++;
            } else if (c == '}') {
                depth--;
            }
            i++;
        }
        String editBlock = depth == 0 ? rightsJson.substring(braceStart, i) : "";
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(editBlock);
        while (keyM.find()) {
            out.add(keyM.group(1).trim());
        }
        return out;
    }

    private static String trimToEmpty(String s) {
        return s == null ? "" : s.trim();
    }
}
