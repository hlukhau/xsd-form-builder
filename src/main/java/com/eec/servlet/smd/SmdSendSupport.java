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
 * Проверки возможности направления исходящей карты SMD участникам ОП 58.
 */
final class SmdSendSupport {

    static final String DATASOURCE_OUTGOING = "2";
    static final String STATUS_PENDING = "PENDING";

    private static final Set<String> ALLOWED_SEND_STATUS_CODES = new HashSet<>();

    static {
        ALLOWED_SEND_STATUS_CODES.add("NEW");
        ALLOWED_SEND_STATUS_CODES.add("FAILED");
        ALLOWED_SEND_STATUS_CODES.add("ERROR");
    }

    private static final String SQL_CARD_STATUS = ""
            + "SELECT s.SMDID, TRIM(UPPER(NVL(st.SMDSTATUSCODE, ''))) AS SMDSTATUSCODE, "
            + "       TRIM(TO_CHAR(s.DATASOURCEKINDCODE)) AS DATASOURCEKINDCODE "
            + "FROM SMD s "
            + "LEFT JOIN SMDSTATUS st ON st.SMDSTATUSID = s.SMDSTATUSID "
            + "WHERE s.SMDID = ?";

    private SmdSendSupport() {
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
        try (PreparedStatement ps = conn.prepareStatement(SQL_CARD_STATUS)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Eligibility.deny("Карта с указанным SMDID не найдена");
                }
                statusCode = trimToEmpty(rs.getString("SMDSTATUSCODE"));
                dsc = trimToEmpty(rs.getString("DATASOURCEKINDCODE"));
            }
        }

        if (!DATASOURCE_OUTGOING.equals(dsc)) {
            return Eligibility.deny("Направление сведений доступно только для исходящих карт");
        }

        if (!ALLOWED_SEND_STATUS_CODES.contains(statusCode)) {
            return Eligibility.deny(
                    "Направление сведений доступно только для карт в статусе «Новое», «Отправка не удалась» или «Ошибка обработки»");
        }

        if (!AccessRightService.hasSanitaryMeasureOutSend(rightsJson)) {
            return Eligibility.deny("Нет права sanitaryMeasureOut:send на направление сведений");
        }

        Set<String> cardDepIds = SmdDeleteSupport.loadCardDepIds(conn, smdid);
        if (cardDepIds.isEmpty()) {
            return Eligibility.deny("Нет доступа к карте: в доступе к карте нет подразделений");
        }

        if (rightsJson == null || rightsJson.trim().isEmpty()) {
            return Eligibility.deny("Права по GUID не найдены");
        }

        Set<String> userSendDepIds = parseSanitaryMeasureOutSendDepIds(rightsJson);
        boolean hasSend = false;
        for (String depId : userSendDepIds) {
            if (cardDepIds.contains(depId)) {
                hasSend = true;
                break;
            }
        }
        if (!hasSend) {
            return Eligibility.deny(
                    "Нет права sanitaryMeasureOut:send в пределах ни одного подразделения, имеющего доступ к данной карте");
        }

        return new Eligibility(true, null);
    }

    static Set<String> parseSanitaryMeasureOutSendDepIds(String json) {
        Set<String> out = new HashSet<>();
        if (json == null) {
            return out;
        }
        int outStart = json.indexOf("\"sanitaryMeasureOut\"");
        if (outStart < 0) {
            return out;
        }
        int sendStart = json.indexOf("\"send\"", outStart);
        if (sendStart < 0) {
            return out;
        }
        int braceStart = json.indexOf('{', sendStart);
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
        String sendBlock = depth == 0 ? json.substring(braceStart, i) : "";
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(sendBlock);
        while (keyM.find()) {
            out.add(keyM.group(1).trim());
        }
        return out;
    }

    private static String trimToEmpty(String s) {
        return s == null ? "" : s.trim();
    }
}
