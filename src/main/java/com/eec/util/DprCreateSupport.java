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

    private static final String SQL_DPR_FOR_EDIT = ""
            + "SELECT d.PPVID, TRIM(TO_CHAR(d.DATASOURCEKINDCODE)) AS DSC, d.DPRSTATUSID "
            + "FROM DPR d WHERE d.DPRID = ?";

    /**
     * Редактирование сохранённой исходящей DPR: violationDetectedIn:status ∩ PPVDEPPERMIS, DATASOURCEKINDCODE=2,
     * статус DRAFT/NEW/FAILED/ERROR (по идентификаторам из справочника DPRSTATUS для исходящих).
     */
    public static GateResult evaluateEditGate(Connection conn, long dprId, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty() || dprId <= 0) {
            return GateResult.denied("Не заданы DPRID или guid");
        }
        guid = guid.trim();
        if (!DprAccessHelper.canViewDpr(conn, dprId, guid)) {
            return GateResult.denied("Нет доступа к просмотру карты DPR");
        }
        long ppvid = 0L;
        String dsc = null;
        Integer statusId = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_DPR_FOR_EDIT)) {
            ps.setLong(1, dprId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Карта DPR не найдена");
                }
                ppvid = rs.getLong("PPVID");
                if (rs.wasNull() || ppvid <= 0) {
                    return GateResult.denied("У карты DPR не задана связь с PPV (PPVID)");
                }
                dsc = rs.getString("DSC");
                statusId = getIntObject(rs, "DPRSTATUSID");
            }
        }
        if (dsc == null || !DSC_OUTGOING_DPR.equals(dsc.trim())) {
            return GateResult.denied("Редактирование доступно только для исходящей карты (DATASOURCEKINDCODE=2)");
        }
        if (statusId == null || (statusId != 4 && statusId != 5 && statusId != 8 && statusId != 9)) {
            return GateResult.denied("Редактирование недоступно для текущего статуса карты");
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
            return GateResult.denied("Нет права на редактирование: ни одно подразделение из violationDetectedIn:status "
                    + "не входит в доступ к связанной карте PPV (PPVDEPPERMIS)");
        }
        return GateResult.ok(ppvid, null, null, null, null, 0L, null, null, 0, null);
    }

    /**
     * Смена статуса исходящей DPR: то же пересечение violationDetectedIn:status с PPVDEPPERMIS, источник исходящий;
     * допустимые текущие статусы — идентификаторы 4…10 (проверка конкретного перехода в сервлете).
     */
    public static GateResult evaluateOutgoingDprStatusGate(Connection conn, long dprId, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty() || dprId <= 0) {
            return GateResult.denied("Не заданы DPRID или guid");
        }
        guid = guid.trim();
        if (!DprAccessHelper.canViewDpr(conn, dprId, guid)) {
            return GateResult.denied("Нет доступа к просмотру карты DPR");
        }
        long ppvid = 0L;
        String dsc = null;
        Integer statusId = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_DPR_FOR_EDIT)) {
            ps.setLong(1, dprId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Карта DPR не найдена");
                }
                ppvid = rs.getLong("PPVID");
                if (rs.wasNull() || ppvid <= 0) {
                    return GateResult.denied("У карты DPR не задана связь с PPV (PPVID)");
                }
                dsc = rs.getString("DSC");
                statusId = getIntObject(rs, "DPRSTATUSID");
            }
        }
        if (dsc == null || !DSC_OUTGOING_DPR.equals(dsc.trim())) {
            return GateResult.denied("Действие доступно только для исходящей карты (DATASOURCEKINDCODE=2)");
        }
        if (statusId == null || statusId < 4 || statusId > 10) {
            return GateResult.denied("Смена статуса недоступна для текущего состояния карты");
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
            return GateResult.denied("Нет права: ни одно подразделение из violationDetectedIn:status "
                    + "не входит в доступ к связанной карте PPV (PPVDEPPERMIS)");
        }
        return GateResult.ok(ppvid, null, null, null, null, 0L, null, null, 0, null);
    }

    private static final String SQL_DPRID_BY_PPV = "SELECT DPRID FROM DPR WHERE PPVID = ? AND ROWNUM = 1";

    /** Результат проверки «Открыть ответ» (связанная DPR по входящей PPV). */
    public static final class OpenLinkedResult {
        public final boolean allowed;
        public final String reason;
        /** Идентификатор DPR при наличии строки в БД (может быть при {@code allowed == false}). */
        public final Long linkedDprid;

        private OpenLinkedResult(boolean allowed, String reason, Long linkedDprid) {
            this.allowed = allowed;
            this.reason = reason;
            this.linkedDprid = linkedDprid;
        }

        public static OpenLinkedResult ok(long dprId) {
            return new OpenLinkedResult(true, null, dprId);
        }

        public static OpenLinkedResult no(String reason, Long linkedDprid) {
            return new OpenLinkedResult(false, reason, linkedDprid);
        }
    }

    /**
     * Просмотр связанной карты DPR: входящая PPV, есть DPR по PPVID, {@code violationDetectedIn:view} и PPVDEPPERMIS.
     */
    public static OpenLinkedResult evaluateOpenLinkedDpr(Connection conn, long ppvid, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty() || ppvid <= 0) {
            return OpenLinkedResult.no("Не заданы PPVID или guid", null);
        }
        guid = guid.trim();

        String dsc = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_PPV_CORE)) {
            ps.setLong(1, ppvid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return OpenLinkedResult.no("Карта PPV не найдена", null);
                }
                dsc = rs.getString("DSC");
            }
        }
        if (dsc == null || !DSC_INCOMING.equals(dsc.trim())) {
            return OpenLinkedResult.no("Просмотр связанного ответа доступен только для входящей карты PPV", null);
        }

        Long dprId = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_DPRID_BY_PPV)) {
            ps.setLong(1, ppvid);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    long id = rs.getLong("DPRID");
                    if (!rs.wasNull()) {
                        dprId = id;
                    }
                }
            }
        }
        if (dprId == null || dprId <= 0) {
            return OpenLinkedResult.no("Связанная карта сведений о результатах рассмотрения не найдена", null);
        }

        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
            return OpenLinkedResult.no("Карта прав по guid не найдена", dprId);
        }
        if (!AccessRightService.hasViolationDetectedInView(rightsJson)) {
            return OpenLinkedResult.no("В карте прав не задано право violationDetectedIn:view", dprId);
        }
        Set<String> viewKeys = AccessRightService.violationDetectedInViewDepKeys(rightsJson);
        if (viewKeys.isEmpty()) {
            return OpenLinkedResult.no("В карте прав не заданы подразделения для violationDetectedIn:view", dprId);
        }
        if (!PpvDepPermisUtil.hasOverlap(conn, ppvid, viewKeys)) {
            return OpenLinkedResult.no("Нет права на просмотр связанного ответа: ни одно подразделение из "
                    + "violationDetectedIn:view не входит в доступ к карте (PPVDEPPERMIS)", dprId);
        }
        return OpenLinkedResult.ok(dprId);
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
