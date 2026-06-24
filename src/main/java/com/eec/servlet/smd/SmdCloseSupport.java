package com.eec.servlet.smd;

import com.eec.util.AccessRightService;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Закрытие карты SMD: переход в статус COMPLETED («Завершено»).
 * Входящие: PROCESSED → COMPLETED; исходящие: NEW | FAILED | ERROR | DELIVERED → COMPLETED.
 */
final class SmdCloseSupport {

    private static final Set<String> ALLOWED_OUTGOING_CLOSE_STATUS_CODES = new HashSet<>(Arrays.asList(
            "NEW", "FAILED", "ERROR", "DELIVERED"
    ));

    private SmdCloseSupport() {
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

    static Eligibility checkIncomingCloseEligibility(Connection conn, long smdid, String rightsJson)
            throws SQLException {
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
            return Eligibility.deny("Закрытие карты по данному сценарию доступно только для входящих карт");
        }

        if (!"PROCESSED".equals(statusCode)) {
            return Eligibility.deny(
                    "Закрытие карты доступно только для входящих карт в статусе «Обработано» (PROCESSED)");
        }

        return checkStatusRightIntersection(
                rightsJson,
                smdid,
                conn,
                true,
                "sanitaryMeasureIn:status",
                SmdCompleteProcessingSupport::parseSanitaryMeasureInStatusDepIds);
    }

    static Eligibility checkOutgoingCloseEligibility(Connection conn, long smdid, String rightsJson)
            throws SQLException {
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

        if (!SmdSendSupport.DATASOURCE_OUTGOING.equals(dsc)) {
            return Eligibility.deny("Закрытие карты по данному сценарию доступно только для исходящих карт");
        }

        if (!ALLOWED_OUTGOING_CLOSE_STATUS_CODES.contains(statusCode)) {
            return Eligibility.deny(
                    "Закрытие карты доступно только для карт в статусе «Новое», «Отправка не удалась», "
                            + "«Ошибка обработки» или «Доставлено»");
        }

        return checkStatusRightIntersection(
                rightsJson,
                smdid,
                conn,
                false,
                "sanitaryMeasureOut:status",
                SmdCloseSupport::parseSanitaryMeasureOutStatusDepIds);
    }

    private interface DepIdParser {
        Set<String> parse(String rightsJson);
    }

    private static Eligibility checkStatusRightIntersection(
            String rightsJson,
            long smdid,
            Connection conn,
            boolean incoming,
            String rightLabel,
            DepIdParser parser) throws SQLException {
        boolean hasGlobal = incoming
                ? AccessRightService.hasSanitaryMeasureInStatus(rightsJson)
                : AccessRightService.hasSanitaryMeasureOutStatus(rightsJson);
        if (!hasGlobal) {
            return Eligibility.deny("Нет права " + rightLabel + " на закрытие карты");
        }

        Set<String> cardDepIds = SmdDeleteSupport.loadCardDepIds(conn, smdid);
        if (cardDepIds.isEmpty()) {
            return Eligibility.deny("Нет доступа к карте: в доступе к карте нет подразделений");
        }

        if (rightsJson == null || rightsJson.trim().isEmpty()) {
            return Eligibility.deny("Права по GUID не найдены");
        }

        Set<String> userStatusDepIds = parser.parse(rightsJson);
        for (String depId : userStatusDepIds) {
            if (cardDepIds.contains(depId)) {
                return new Eligibility(true, null);
            }
        }
        return Eligibility.deny(
                "Нет права " + rightLabel + " в пределах ни одного подразделения, имеющего доступ к данной карте");
    }

    static boolean applyIncomingClose(Connection conn, long smdid, Integer userId) throws SQLException {
        Integer completedId = resolveStatusId(conn, SmdIncomingStatusHelper.DATASOURCE_INCOMING, "COMPLETED");
        Integer processedId = resolveStatusId(conn, SmdIncomingStatusHelper.DATASOURCE_INCOMING, "PROCESSED");
        if (completedId == null || processedId == null) {
            return false;
        }
        return applyCloseFromStatus(conn, smdid, SmdIncomingStatusHelper.DATASOURCE_INCOMING, processedId,
                completedId, userId);
    }

    static boolean applyOutgoingClose(Connection conn, long smdid, Integer userId) throws SQLException {
        Integer completedId = resolveStatusId(conn, SmdSendSupport.DATASOURCE_OUTGOING, "COMPLETED");
        if (completedId == null) {
            return false;
        }
        Integer newId = resolveStatusId(conn, SmdSendSupport.DATASOURCE_OUTGOING, "NEW");
        Integer failedId = resolveStatusId(conn, SmdSendSupport.DATASOURCE_OUTGOING, "FAILED");
        Integer errorId = resolveStatusId(conn, SmdSendSupport.DATASOURCE_OUTGOING, "ERROR");
        Integer deliveredId = resolveStatusId(conn, SmdSendSupport.DATASOURCE_OUTGOING, "DELIVERED");
        Set<Integer> fromIds = new HashSet<>();
        if (newId != null) fromIds.add(newId);
        if (failedId != null) fromIds.add(failedId);
        if (errorId != null) fromIds.add(errorId);
        if (deliveredId != null) fromIds.add(deliveredId);
        if (fromIds.isEmpty()) {
            return false;
        }
        StringBuilder inClause = new StringBuilder();
        for (int i = 0; i < fromIds.size(); i++) {
            if (i > 0) inClause.append(',');
            inClause.append('?');
        }
        String sql = "UPDATE SMD SET SMDSTATUSID = ? "
                + "WHERE SMDID = ? "
                + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
                + "AND SMDSTATUSID IN (" + inClause + ")";
        int updated;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            int idx = 1;
            ps.setInt(idx++, completedId);
            ps.setLong(idx++, smdid);
            ps.setString(idx++, SmdSendSupport.DATASOURCE_OUTGOING);
            for (int id : fromIds) {
                ps.setInt(idx++, id);
            }
            updated = ps.executeUpdate();
        }
        if (updated == 0) {
            return false;
        }
        insertStatusHist(conn, smdid, completedId, userId);
        return true;
    }

    private static boolean applyCloseFromStatus(
            Connection conn,
            long smdid,
            String datasourceKind,
            int fromStatusId,
            int toStatusId,
            Integer userId) throws SQLException {
        int updated;
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE SMD SET SMDSTATUSID = ? "
                        + "WHERE SMDID = ? "
                        + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
                        + "AND SMDSTATUSID = ?")) {
            ps.setInt(1, toStatusId);
            ps.setLong(2, smdid);
            ps.setString(3, datasourceKind);
            ps.setInt(4, fromStatusId);
            updated = ps.executeUpdate();
        }
        if (updated == 0) {
            return false;
        }
        insertStatusHist(conn, smdid, toStatusId, userId);
        return true;
    }

    private static void insertStatusHist(Connection conn, long smdid, int statusId, Integer userId)
            throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO SMDSTATUSHIST (SMDID, SMDSTATUSID, SMDSTATUSDATETIME, USERID) "
                        + "VALUES (?, ?, SYSDATE, ?)")) {
            ps.setLong(1, smdid);
            ps.setInt(2, statusId);
            if (userId != null) {
                ps.setInt(3, userId);
            } else {
                ps.setNull(3, java.sql.Types.INTEGER);
            }
            ps.executeUpdate();
        }
    }

    static Integer resolveStatusId(Connection conn, String datasourceKind, String statusCode)
            throws SQLException {
        if (statusCode == null || statusCode.trim().isEmpty()) {
            return null;
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT SMDSTATUSID FROM SMDSTATUS "
                        + "WHERE TRIM(UPPER(SMDSTATUSCODE)) = TRIM(UPPER(?)) "
                        + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
                        + "AND SMDSTATUSACTFL = 1 AND ROWNUM = 1")) {
            ps.setString(1, statusCode.trim());
            ps.setString(2, datasourceKind);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                int id = rs.getInt("SMDSTATUSID");
                return rs.wasNull() ? null : id;
            }
        }
    }

    static String resolveStatusName(Connection conn, int statusId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT TRIM(SMDSTATUSNAME) AS NM FROM SMDSTATUS WHERE SMDSTATUSID = ? AND ROWNUM = 1")) {
            ps.setInt(1, statusId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    String n = rs.getString("NM");
                    return n != null && !n.trim().isEmpty() ? n.trim() : null;
                }
            }
        }
        return null;
    }

    static Set<String> parseSanitaryMeasureOutStatusDepIds(String json) {
        Set<String> out = new HashSet<>();
        if (json == null) {
            return out;
        }
        int outStart = json.indexOf("\"sanitaryMeasureOut\"");
        if (outStart < 0) {
            return out;
        }
        int statusStart = json.indexOf("\"status\"", outStart);
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
