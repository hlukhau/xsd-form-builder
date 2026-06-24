package com.eec.servlet.smd;

import com.eec.util.AccessRightService;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Проверки возможности принудительной валидации исходящей карты SMD.
 */
final class SmdViewSupport {

    static final String DATASOURCE_OUTGOING = "2";

    private static final String SQL_DATASOURCE = ""
            + "SELECT TRIM(TO_CHAR(s.DATASOURCEKINDCODE)) AS DATASOURCEKINDCODE "
            + "FROM SMD s WHERE s.SMDID = ?";

    private SmdViewSupport() {
    }

    static final class Eligibility {
        final boolean allowed;
        final String reason;

        Eligibility(boolean allowed, String reason) {
            this.allowed = allowed;
            this.reason = reason;
        }

        static Eligibility deny(String reason) {
            return new Eligibility(false, reason);
        }
    }

    static Eligibility checkValidateEligibility(Connection conn, long smdid, String rightsJson) throws SQLException {
        String dsc;
        try (PreparedStatement ps = conn.prepareStatement(SQL_DATASOURCE)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Eligibility.deny("Карта с указанным SMDID не найдена");
                }
                dsc = trimToEmpty(rs.getString("DATASOURCEKINDCODE"));
            }
        }

        if (!DATASOURCE_OUTGOING.equals(dsc)) {
            return Eligibility.deny("Валидация карты доступна только для исходящих карт");
        }

        if (!AccessRightService.hasSanitaryMeasureOutView(rightsJson)) {
            return Eligibility.deny("Нет права sanitaryMeasureOut:view на валидацию карты");
        }

        Set<String> cardDepIds = SmdDeleteSupport.loadCardDepIds(conn, smdid);
        if (cardDepIds.isEmpty()) {
            return Eligibility.deny("Нет доступа к карте: в доступе к карте нет подразделений");
        }

        if (rightsJson == null || rightsJson.trim().isEmpty()) {
            return Eligibility.deny("Права по GUID не найдены");
        }

        Set<String> userViewDepIds = parseSanitaryMeasureOutViewDepIds(rightsJson);
        boolean hasView = false;
        for (String depId : userViewDepIds) {
            if (cardDepIds.contains(depId)) {
                hasView = true;
                break;
            }
        }
        if (!hasView) {
            return Eligibility.deny(
                    "Нет права sanitaryMeasureOut:view в пределах ни одного подразделения, имеющего доступ к данной карте");
        }

        return new Eligibility(true, null);
    }

    static Set<String> parseSanitaryMeasureOutViewDepIds(String json) {
        Set<String> out = new HashSet<>();
        if (json == null) {
            return out;
        }
        int outStart = json.indexOf("\"sanitaryMeasureOut\"");
        if (outStart < 0) {
            return out;
        }
        int viewStart = json.indexOf("\"view\"", outStart);
        if (viewStart < 0) {
            return out;
        }
        int braceStart = json.indexOf('{', viewStart);
        if (braceStart < 0) {
            return out;
        }
        int depth = 1;
        int i = braceStart + 1;
        while (i < json.length() && depth > 0) {
            char c = json.charAt(i);
            if (c == '{') {
                depth++;
            } else if (c == '}') {
                depth--;
            }
            i++;
        }
        String viewBlock = depth == 0 ? json.substring(braceStart, i) : "";
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(viewBlock);
        while (keyM.find()) {
            out.add(keyM.group(1).trim());
        }
        return out;
    }

    private static String trimToEmpty(String s) {
        return s == null ? "" : s.trim();
    }
}
