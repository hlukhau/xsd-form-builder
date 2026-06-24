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
 * Завершение обработки входящей карты SMD: PROCESSING → PROCESSED.
 */
final class SmdCompleteProcessingSupport {

    private SmdCompleteProcessingSupport() {
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

    static Eligibility checkEligibility(Connection conn, long smdid, String rightsJson) throws SQLException {
        String statusCode;
        String dsc;
        try (PreparedStatement ps = conn.prepareStatement(SmdDbSupport.SQL_SMD_STATUS_ROW)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Eligibility.deny("Карта с указанным SMDID не найдена");
                }
                statusCode = trimToEmpty(rs.getString("STATUSCODE"));
                dsc = trimToEmpty(rs.getString("DSC"));
            }
        }

        if (!SmdIncomingStatusHelper.DATASOURCE_INCOMING.equals(dsc)) {
            return Eligibility.deny("Завершение обработки доступно только для входящих карт");
        }

        if (!"PROCESSING".equals(statusCode)) {
            return Eligibility.deny(
                    "Завершение обработки доступно только для карт в статусе «В обработке» (PROCESSING)");
        }

        if (!AccessRightService.hasSanitaryMeasureInStatus(rightsJson)) {
            return Eligibility.deny("Нет права sanitaryMeasureIn:status на завершение обработки");
        }

        Set<String> cardDepIds = SmdDeleteSupport.loadCardDepIds(conn, smdid);
        if (cardDepIds.isEmpty()) {
            return Eligibility.deny("Нет доступа к карте: в доступе к карте нет подразделений");
        }

        if (rightsJson == null || rightsJson.trim().isEmpty()) {
            return Eligibility.deny("Права по GUID не найдены");
        }

        Set<String> userStatusDepIds = parseSanitaryMeasureInStatusDepIds(rightsJson);
        boolean hasStatus = false;
        for (String depId : userStatusDepIds) {
            if (cardDepIds.contains(depId)) {
                hasStatus = true;
                break;
            }
        }
        if (!hasStatus) {
            return Eligibility.deny(
                    "Нет права sanitaryMeasureIn:status в пределах ни одного подразделения, имеющего доступ к данной карте");
        }

        return new Eligibility(true, null);
    }

    /** Связанная карта SMR подготовлена и отправлена. */
    static boolean isReviewOutcomeSent(Connection conn, long smdid) throws SQLException {
        SQLException last = null;
        for (String sql : new String[] {
                SmdDbSupport.SQL_SMR_REVIEW_OUTCOME_SENT_BY_STATUS,
                SmdDbSupport.SQL_SMR_REVIEW_OUTCOME_SENT_BY_EDOC,
        }) {
            try {
                if (queryExists(conn, sql, smdid)) {
                    return true;
                }
            } catch (SQLException e) {
                last = e;
                if (!SmdDbSupport.isMissingObject(e)) {
                    throw e;
                }
            }
        }
        if (last != null) {
            return false;
        }
        return false;
    }

    private static boolean queryExists(Connection conn, String sql, long smdid) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    static Set<String> parseSanitaryMeasureInStatusDepIds(String json) {
        Set<String> out = new HashSet<>();
        if (json == null) {
            return out;
        }
        int inStart = json.indexOf("\"sanitaryMeasureIn\"");
        if (inStart < 0) {
            return out;
        }
        int statusStart = json.indexOf("\"status\"", inStart);
        if (statusStart < 0) {
            return out;
        }
        int braceStart = json.indexOf('{', statusStart);
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
        String statusBlock = depth == 0 ? json.substring(braceStart, i) : "";
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(statusBlock);
        while (keyM.find()) {
            out.add(keyM.group(1).trim());
        }
        return out;
    }

    private static String trimToEmpty(String s) {
        return s == null ? "" : s.trim();
    }
}
