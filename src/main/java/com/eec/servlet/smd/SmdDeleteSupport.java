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
 * Проверки возможности удаления исходящей карты SMD в статусе «Новое».
 */
final class SmdDeleteSupport {

    static final String DATASOURCE_OUTGOING = "2";
    static final String STATUS_NEW = "NEW";
    static final String STATUS_PENDING = "PENDING";

    private static final String SQL_STATUS_ID = ""
            + "SELECT SMDSTATUSID FROM SMDSTATUS "
            + "WHERE UPPER(TRIM(SMDSTATUSCODE)) = ? "
            + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
            + "AND SMDSTATUSACTFL = 1 AND ROWNUM = 1";

    private static final String SQL_CARD_FOR_DELETE = ""
            + "SELECT s.SMDID, s.DOCID, s.DOCCREATIONDATE, s.SMDSTATUSID, "
            + "       TRIM(TO_CHAR(s.DATASOURCEKINDCODE)) AS DATASOURCEKINDCODE "
            + "FROM SMD s WHERE s.SMDID = ?";

    private static final String SQL_HAS_PENDING_HIST = ""
            + "SELECT 1 FROM SMDSTATUSHIST STH "
            + "JOIN SMDSTATUS ST ON ST.SMDSTATUSID = STH.SMDSTATUSID "
            + "WHERE UPPER(TRIM(ST.SMDSTATUSCODE)) = ? AND STH.SMDID = ? AND ROWNUM = 1";

    private static final String SQL_DEPS = "SELECT DEPID FROM SMDDEPPERMIS WHERE SMDID = ?";

    private SmdDeleteSupport() {
    }

    static final class Eligibility {
        final boolean allowed;
        final String reason;
        final String docId;
        final String docCreationDateIso;

        Eligibility(boolean allowed, String reason, String docId, String docCreationDateIso) {
            this.allowed = allowed;
            this.reason = reason;
            this.docId = docId;
            this.docCreationDateIso = docCreationDateIso;
        }

        static Eligibility deny(String reason) {
            return new Eligibility(false, reason, null, null);
        }
    }

    static Eligibility checkEligibility(Connection conn, long smdid, String rightsJson) throws SQLException {
        int newStatusId = resolveStatusId(conn, STATUS_NEW);
        if (newStatusId <= 0) {
            return Eligibility.deny("Не найден статус NEW для исходящих SMD");
        }

        String docId = null;
        String docDateIso = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_CARD_FOR_DELETE)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Eligibility.deny("Карта с указанным SMDID не найдена");
                }
                String dsc = trimToEmpty(rs.getString("DATASOURCEKINDCODE"));
                if (!DATASOURCE_OUTGOING.equals(dsc)) {
                    return Eligibility.deny("Удаление доступно только для исходящих карт");
                }
                int statusId = rs.getInt("SMDSTATUSID");
                if (statusId != newStatusId) {
                    return Eligibility.deny("Удаление доступно только для карты в статусе «Новое»");
                }
                docId = trimToEmpty(rs.getString("DOCID"));
                java.sql.Date docDate = rs.getDate("DOCCREATIONDATE");
                if (docDate != null) {
                    docDateIso = docDate.toLocalDate().toString();
                }
            }
        }

        if (hasPendingInHistory(conn, smdid)) {
            return Eligibility.deny("Удаление недоступно: карта уже направлялась участникам ОП58");
        }

        Set<String> cardDepIds = loadCardDepIds(conn, smdid);
        if (cardDepIds.isEmpty()) {
            return Eligibility.deny("Нет доступа к карте: в доступе к карте нет подразделений");
        }

        if (rightsJson == null || rightsJson.trim().isEmpty()) {
            return Eligibility.deny("Права по GUID не найдены");
        }

        Set<String> userEditDepIds = parseSanitaryMeasureOutEditDepIds(rightsJson);
        boolean hasEdit = false;
        for (String depId : userEditDepIds) {
            if (cardDepIds.contains(depId)) {
                hasEdit = true;
                break;
            }
        }
        if (!hasEdit) {
            return Eligibility.deny(
                    "Нет права sanitaryMeasureOut:edit в пределах ни одного подразделения, имеющего доступ к данной карте");
        }

        return new Eligibility(true, null, docId, docDateIso);
    }

    static boolean hasPendingInHistory(Connection conn, long smdid) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_HAS_PENDING_HIST)) {
            ps.setString(1, STATUS_PENDING);
            ps.setLong(2, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    static int resolveStatusId(Connection conn, String statusCode) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_STATUS_ID)) {
            ps.setString(1, statusCode.trim().toUpperCase());
            ps.setString(2, DATASOURCE_OUTGOING);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1);
                }
            }
        }
        return -1;
    }

    static Set<String> loadCardDepIds(Connection conn, long smdid) throws SQLException {
        Set<String> cardDepIds = new HashSet<>();
        try (PreparedStatement ps = conn.prepareStatement(SQL_DEPS)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String depId = rs.getString(1);
                    if (depId != null && !depId.trim().isEmpty()) {
                        cardDepIds.add(depId.trim());
                    }
                }
            }
        }
        return cardDepIds;
    }

    static Set<String> parseSanitaryMeasureOutEditDepIds(String json) {
        Set<String> out = new HashSet<>();
        if (json == null) {
            return out;
        }
        int outStart = json.indexOf("\"sanitaryMeasureOut\"");
        if (outStart < 0) {
            return out;
        }
        int editStart = json.indexOf("\"edit\"", outStart);
        if (editStart < 0) {
            return out;
        }
        int braceStart = json.indexOf('{', editStart);
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
        String editBlock = depth == 0 ? json.substring(braceStart, i) : "";
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
