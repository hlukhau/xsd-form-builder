package com.eec.util;

import com.eec.rights.RightsRegistryProvider;

import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Set;

/**
 * Проверки для создания карты DPR (ответ) по входящей карте PPV: право {@code violationDetectedIn:status},
 * источник входящий, статус «В обработке», отсутствие связанной DPR, страна ответа BY (ЕАЭС).
 */
public final class DprCreateSupport {

    private static final String DSC_INCOMING = "1";
    private static final String DSC_OUTGOING_DPR = "2";

    private static final String SQL_PPV_CORE = ""
            + "SELECT TRIM(TO_CHAR(p.DATASOURCEKINDCODE)) AS DSC, "
            + "       p.PPVSTATUSID, "
            + "       TRIM(p.INCIDENTID) AS INCIDENTID, "
            + "       TRIM(p.INCIDENTALERTKINDCODE) AS INCIDENTALERTKINDCODE, "
            + "       p.DOCCREATIONDATE AS DOCCREATIONDATE, "
            + "       TRIM(UPPER(c.COUNTRYCODE)) AS ALERTCOUNTRYCODE "
            + "FROM PPV p "
            + "LEFT JOIN COUNTRY c ON p.ALERTCOUNTRYID = c.COUNTRYID "
            + "     AND c.COUNTRYSDATE <= TRUNC(SYSDATE) AND c.COUNTRYEDATE >= TRUNC(SYSDATE) "
            + "WHERE p.PPVID = ?";

    private static final String SQL_PPVSTATUS_PROCESSING = ""
            + "SELECT PPVSTATUSID FROM PPVSTATUS "
            + "WHERE TRIM(UPPER(PPVSTATUSCODE)) = 'PROCESSING' "
            + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
            + "AND PPVSTATUSACTFL = 1 AND ROWNUM = 1";

    private static final String SQL_DPR_EXISTS = "SELECT DPRID FROM DPR WHERE PPVID = ? AND ROWNUM = 1";

    private static final String SQL_DPRSTATUS_DRAFT_OUT = ""
            + "SELECT DPRSTATUSID, TRIM(DPRSTATUSNAME) AS DPRSTATUSNAME FROM DPRSTATUS "
            + "WHERE TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
            + "AND TRIM(UPPER(DPRSTATUSCODE)) = 'DRAFT' "
            + "AND DPRSTATUSACTFL = 1 AND ROWNUM = 1";

    private static final String SQL_RESPONSE_COUNTRY_BY = ""
            + "SELECT c.COUNTRYID, TRIM(c.COUNTRYCODE) AS COUNTRYCODE, TRIM(c.COUNTRYNAME) AS COUNTRYNAME "
            + "FROM COUNTRY c "
            + "WHERE TRIM(UPPER(c.COUNTRYCODE)) = 'BY' "
            + "  AND c.COUNTRYSDATE <= TRUNC(SYSDATE) AND c.COUNTRYEDATE >= TRUNC(SYSDATE) "
            + "  AND EXISTS ("
            + "    SELECT 1 FROM COUNTRYGRSET g WHERE g.COUNTRYID = c.COUNTRYID "
            + "      AND g.COUNTRYGRCODE = 'EAUE' AND g.COUNTRYGRSETACTFL = 1"
            + "  ) AND ROWNUM = 1";

    private DprCreateSupport() {
    }

    public static final class GateResult {
        public final boolean allowed;
        public final String reason;
        public final long ppvid;
        public final String incidentId;
        public final String alertCountryCode;
        public final String incidentKindCode;
        public final Date docCreationDate;
        public final long responseCountryId;
        public final String responseCountryCode;
        public final String responseCountryName;
        public final int draftDprStatusId;
        public final String draftDprStatusName;

        private GateResult(boolean allowed, String reason, long ppvid, String incidentId, String alertCountryCode,
                           String incidentKindCode, Date docCreationDate, long responseCountryId,
                           String responseCountryCode, String responseCountryName, int draftDprStatusId,
                           String draftDprStatusName) {
            this.allowed = allowed;
            this.reason = reason;
            this.ppvid = ppvid;
            this.incidentId = incidentId;
            this.alertCountryCode = alertCountryCode;
            this.incidentKindCode = incidentKindCode;
            this.docCreationDate = docCreationDate;
            this.responseCountryId = responseCountryId;
            this.responseCountryCode = responseCountryCode;
            this.responseCountryName = responseCountryName;
            this.draftDprStatusId = draftDprStatusId;
            this.draftDprStatusName = draftDprStatusName;
        }

        public static GateResult denied(String reason) {
            return new GateResult(false, reason, 0L, null, null, null, null, 0L, null, null, 0, null);
        }

        public static GateResult ok(long ppvid, String incidentId, String alertCountryCode, String incidentKindCode,
                                    Date docCreationDate, long responseCountryId, String responseCountryCode,
                                    String responseCountryName, int draftDprStatusId, String draftDprStatusName) {
            return new GateResult(true, null, ppvid, incidentId, alertCountryCode, incidentKindCode, docCreationDate,
                    responseCountryId, responseCountryCode, responseCountryName, draftDprStatusId, draftDprStatusName);
        }
    }

    /**
     * Полная проверка возможности создать DPR по PPVID.
     */
    public static GateResult evaluateGate(Connection conn, long ppvid, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty() || ppvid <= 0) {
            return GateResult.denied("Не заданы PPVID или guid");
        }
        guid = guid.trim();

        if (!PpvViewAccessHelper.canViewPpv(conn, ppvid, guid)) {
            return GateResult.denied("Нет доступа к просмотру карты PPV");
        }

        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
            return GateResult.denied("Карта прав по guid не найдена");
        }
        Set<String> statusDepKeys = AccessRightService.violationDetectedInStatusDepKeys(rightsJson);
        if (statusDepKeys.isEmpty()) {
            return GateResult.denied("В карте прав не заданы подразделения для violationDetectedIn:status");
        }
        if (!PpvDepPermisUtil.hasOverlap(conn, ppvid, statusDepKeys)) {
            return GateResult.denied("Нет права на подготовку ответа: ни одно подразделение из violationDetectedIn:status "
                    + "не входит в доступ к карте (PPVDEPPERMIS)");
        }

        String dsc = null;
        Integer currentPpvStatusId = null;
        String incidentId = null;
        String incidentKindCode = null;
        Date docCreationDate = null;
        String alertCountryCode = null;

        try (PreparedStatement ps = conn.prepareStatement(SQL_PPV_CORE)) {
            ps.setLong(1, ppvid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Карта PPV не найдена");
                }
                dsc = rs.getString("DSC");
                currentPpvStatusId = getIntObject(rs, "PPVSTATUSID");
                incidentId = rs.getString("INCIDENTID");
                incidentKindCode = rs.getString("INCIDENTALERTKINDCODE");
                docCreationDate = rs.getDate("DOCCREATIONDATE");
                alertCountryCode = rs.getString("ALERTCOUNTRYCODE");
            }
        }

        if (dsc == null || !DSC_INCOMING.equals(dsc.trim())) {
            return GateResult.denied("Подготовка ответа доступна только для входящей карты PPV");
        }

        Integer processingId;
        try (PreparedStatement ps = conn.prepareStatement(SQL_PPVSTATUS_PROCESSING)) {
            ps.setString(1, DSC_INCOMING);
            try (ResultSet rs = ps.executeQuery()) {
                processingId = rs.next() ? getIntObject(rs, "PPVSTATUSID") : null;
            }
        }
        if (processingId == null) {
            return GateResult.denied("В справочнике PPVSTATUS не найден статус PROCESSING для входящих сведений");
        }
        if (currentPpvStatusId == null || currentPpvStatusId.intValue() != processingId.intValue()) {
            return GateResult.denied("Подготовка ответа доступна только при статусе карты «В обработке» (PROCESSING)");
        }

        try (PreparedStatement ps = conn.prepareStatement(SQL_DPR_EXISTS)) {
            ps.setLong(1, ppvid);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return GateResult.denied("По данной карте PPV уже создана карта сведений о результатах рассмотрения");
                }
            }
        }

        if (incidentId == null || incidentId.isEmpty()) {
            return GateResult.denied("У карты PPV не заполнен регистрационный номер (INCIDENTID)");
        }
        if (alertCountryCode == null || alertCountryCode.length() != 2) {
            return GateResult.denied("У карты PPV не определён код страны уведомления (ALERTCOUNTRYID / COUNTRY)");
        }
        if (incidentKindCode == null || incidentKindCode.isEmpty()) {
            return GateResult.denied("У карты PPV не заполнен вид уведомления (INCIDENTALERTKINDCODE)");
        }
        if (docCreationDate == null) {
            return GateResult.denied("У карты PPV не заполнена дата формирования (DOCCREATIONDATE)");
        }

        long responseCountryId = 0L;
        String responseCountryCode = null;
        String responseCountryName = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_RESPONSE_COUNTRY_BY)) {
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Не найдена страна BY (ЕАЭС) в справочнике COUNTRY для ответа");
                }
                responseCountryId = rs.getLong("COUNTRYID");
                responseCountryCode = rs.getString("COUNTRYCODE");
                responseCountryName = rs.getString("COUNTRYNAME");
            }
        }

        int draftStatusId = 0;
        String draftStatusName = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_DPRSTATUS_DRAFT_OUT)) {
            ps.setString(1, DSC_OUTGOING_DPR);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("В справочнике DPRSTATUS не найден черновик (DRAFT) для исходящего источника (DATASOURCEKINDCODE=2)");
                }
                draftStatusId = getIntObject(rs, "DPRSTATUSID");
                draftStatusName = rs.getString("DPRSTATUSNAME");
            }
        }
        if (draftStatusId <= 0) {
            return GateResult.denied("Некорректный идентификатор статуса черновика DPR");
        }

        return GateResult.ok(ppvid, incidentId, alertCountryCode, incidentKindCode, docCreationDate,
                responseCountryId, responseCountryCode, responseCountryName, draftStatusId, draftStatusName);
    }

    private static Integer getIntObject(ResultSet rs, String column) throws SQLException {
        Object v = rs.getObject(column);
        if (v == null) {
            return null;
        }
        if (v instanceof Number) {
            return ((Number) v).intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
