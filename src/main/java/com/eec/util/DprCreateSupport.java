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
            + "SELECT d.PPVID, TRIM(TO_CHAR(d.DATASOURCEKINDCODE)) AS DSC, d.DPRSTATUSID, "
            + "       TRIM(UPPER(NVL(st.DPRSTATUSCODE, ''))) AS STCODE "
            + "FROM DPR d "
            + "LEFT JOIN DPRSTATUS st ON st.DPRSTATUSID = d.DPRSTATUSID "
            + "WHERE d.DPRID = ?";

    /**
     * Редактирование сохранённой исходящей DPR: violationDetectedIn:status ∩ PPVDEPPERMIS, DATASOURCEKINDCODE=2,
     * статус DRAFT / NEW / FAILED / ERROR (по коду {@code DPRSTATUSCODE} в справочнике DPRSTATUS для исходящих).
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
        String statusCode = null;
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
                statusCode = rs.getString("STCODE");
            }
        }
        if (dsc == null || !DSC_OUTGOING_DPR.equals(dsc.trim())) {
            return GateResult.denied("Редактирование доступно только для исходящей карты (DATASOURCEKINDCODE=2)");
        }
        if (statusCode == null || statusCode.isEmpty()) {
            return GateResult.denied("Редактирование недоступно: у карты не определён код статуса в справочнике DPRSTATUS");
        }
        if (!("DRAFT".equals(statusCode) || "NEW".equals(statusCode) || "FAILED".equals(statusCode)
                || "ERROR".equals(statusCode))) {
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
     * Удаление черновика исходящей DPR: те же права и PPVDEPPERMIS, что и для редактирования,
     * статус только {@code DRAFT} (по коду {@code DPRSTATUSCODE}).
     */
    public static GateResult evaluateDeleteDraftGate(Connection conn, long dprId, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty() || dprId <= 0) {
            return GateResult.denied("Не заданы DPRID или guid");
        }
        guid = guid.trim();
        if (!DprAccessHelper.canViewDpr(conn, dprId, guid)) {
            return GateResult.denied("Нет доступа к просмотру карты DPR");
        }
        long ppvid = 0L;
        String dsc = null;
        String statusCode = null;
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
                statusCode = rs.getString("STCODE");
            }
        }
        if (dsc == null || !DSC_OUTGOING_DPR.equals(dsc.trim())) {
            return GateResult.denied("Удаление доступно только для исходящей карты (DATASOURCEKINDCODE=2)");
        }
        if (statusCode == null || statusCode.isEmpty()) {
            return GateResult.denied("Удаление недоступно: у карты не определён код статуса в справочнике DPRSTATUS");
        }
        if (!"DRAFT".equals(statusCode)) {
            return GateResult.denied("Удалить можно только черновик карты (статус DRAFT)");
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
            return GateResult.denied("Нет права на удаление: ни одно подразделение из violationDetectedIn:status "
                    + "не входит в доступ к связанной карте PPV (PPVDEPPERMIS)");
        }
        return GateResult.ok(ppvid, null, null, null, null, 0L, null, null, 0, null);
    }

    /**
     * Смена статуса исходящей DPR: то же пересечение violationDetectedIn:status с PPVDEPPERMIS, источник исходящий;
     * допустимые текущие статусы — по коду {@code DPRSTATUSCODE} (DRAFT … DELIVERED для исходящих).
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
        String statusCode = null;
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
                statusCode = rs.getString("STCODE");
            }
        }
        if (dsc == null || !DSC_OUTGOING_DPR.equals(dsc.trim())) {
            return GateResult.denied("Действие доступно только для исходящей карты (DATASOURCEKINDCODE=2)");
        }
        if (statusCode == null || statusCode.isEmpty()) {
            return GateResult.denied("Смена статуса недоступна: у карты не определён код статуса в справочнике DPRSTATUS");
        }
        if (!("DRAFT".equals(statusCode) || "NEW".equals(statusCode) || "PENDING".equals(statusCode)
                || "SENT".equals(statusCode) || "FAILED".equals(statusCode) || "ERROR".equals(statusCode)
                || "DELIVERED".equals(statusCode))) {
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

    /** Областной уровень в DPRRESOLUTION по ТЗ (DEPKINDID = 73 в карте прав / TB_DEPKIND). */
    private static final int RIGHTS_DEPKIND_REGIONAL = 73;

    private static final String SQL_DEPKIND_ID_BY_CODE = ""
            + "SELECT DEPKINDID FROM TB_DEPKIND WHERE TRIM(UPPER(DEPKINDCODE)) = TRIM(UPPER(?)) "
            + "AND DEPKINDACTFL = 1 AND ROWNUM = 1";

    private static final String SQL_HAS_RESOLUTION_DEPKIND = ""
            + "SELECT 1 FROM DPRRESOLUTION WHERE DPRID = ? AND DEPKINDID = ? AND ROWNUM = 1";

    /**
     * Направление исходящей DPR участникам ОП 57: {@code violationDetectedIn:status} ∩ PPVDEPPERMIS,
     * {@code DATASOURCEKINDCODE = 2}, статус NEW (с резолюцией областного уровня dep0602 / DEPKINDID 73),
     * FAILED или ERROR.
     */
    public static GateResult evaluateOutgoingDprSendGate(Connection conn, long dprId, String guid) throws SQLException {
        GateResult statusGate = evaluateOutgoingDprStatusGate(conn, dprId, guid);
        if (!statusGate.allowed) {
            return statusGate;
        }
        String statusCode = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_DPR_FOR_EDIT)) {
            ps.setLong(1, dprId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    statusCode = rs.getString("STCODE");
                }
            }
        }
        if (statusCode == null || statusCode.isEmpty()) {
            return GateResult.denied("Не определён код статуса карты в справочнике DPRSTATUS");
        }
        if ("FAILED".equals(statusCode) || "ERROR".equals(statusCode)) {
            return statusGate;
        }
        if ("NEW".equals(statusCode)) {
            if (hasRegionalResolutionForOutgoingSend(conn, dprId)) {
                return statusGate;
            }
            return GateResult.denied(
                    "Направление при статусе «Новое» возможно только при наличии резолюции областного уровня "
                            + "(в DPRRESOLUTION запись по DEPKINDCODE dep0602 или DEPKINDID 73).");
        }
        return GateResult.denied(
                "Направление сведений возможно только при статусе «Новое» (с резолюцией областного уровня), "
                        + "«Отправка не удалась» или «Ошибка обработки».");
    }

    /** Резолюция областного уровня для направления из «Новое» (dep0602 или DEPKINDID 73). */
    public static boolean hasRegionalResolutionForOutgoingSend(Connection conn, long dprId) throws SQLException {
        int regionalDepKindId = resolveRegionalDepKindId(conn);
        if (regionalDepKindId <= 0) {
            return false;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_HAS_RESOLUTION_DEPKIND)) {
            ps.setLong(1, dprId);
            ps.setInt(2, regionalDepKindId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static int resolveRegionalDepKindId(Connection conn) throws SQLException {
        int dep0602 = resolveDepKindIdByCode(conn, "dep0602");
        if (dep0602 > 0) {
            return dep0602;
        }
        return RIGHTS_DEPKIND_REGIONAL;
    }

    private static int resolveDepKindIdByCode(Connection conn, String depKindCode) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_DEPKIND_ID_BY_CODE)) {
            ps.setString(1, depKindCode);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1);
                }
            }
        }
        return -1;
    }

    /**
     * Завершение обработки входящей DPR: {@code violationDetectedOut:status} ∩ PPVDEPPERMIS,
     * {@code DPR.DATASOURCEKINDCODE = 1}, текущий статус {@code PROCESSING} (справочник DPRSTATUS для входящих).
     */
    public static GateResult evaluateIncomingDprCompleteProcessingGate(Connection conn, long dprId, String guid)
            throws SQLException {
        if (guid == null || guid.trim().isEmpty() || dprId <= 0) {
            return GateResult.denied("Не заданы DPRID или guid");
        }
        guid = guid.trim();
        if (!DprAccessHelper.canViewDpr(conn, dprId, guid)) {
            return GateResult.denied("Нет доступа к просмотру карты DPR");
        }
        long ppvid = 0L;
        String dsc = null;
        String statusCode = null;
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
                statusCode = rs.getString("STCODE");
            }
        }
        if (dsc == null || !DSC_INCOMING.equals(dsc.trim())) {
            return GateResult.denied("Завершение обработки доступно только для входящей карты (DATASOURCEKINDCODE=1)");
        }
        if (statusCode == null || statusCode.isEmpty()) {
            return GateResult.denied("Не определён код статуса карты в справочнике DPRSTATUS");
        }
        if (!"PROCESSING".equals(statusCode)) {
            return GateResult.denied("Завершение обработки возможно только при статусе «В обработке» (PROCESSING)");
        }
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
            return GateResult.denied("Карта прав по guid не найдена");
        }
        Set<String> statusDepKeys = AccessRightService.violationDetectedOutStatusDepKeys(rightsJson);
        if (statusDepKeys.isEmpty()) {
            return GateResult.denied("В карте прав не заданы подразделения для violationDetectedOut:status");
        }
        if (!PpvDepPermisUtil.hasOverlap(conn, ppvid, statusDepKeys)) {
            return GateResult.denied("Нет права: ни одно подразделение из violationDetectedOut:status "
                    + "не входит в доступ к связанной карте PPV (PPVDEPPERMIS)");
        }
        return GateResult.ok(ppvid, null, null, null, null, 0L, null, null, 0, null);
    }

    /**
     * Принудительная проверка карты исходящей DPR: {@code violationDetectedOut:view} ∩ PPVDEPPERMIS, DATASOURCEKINDCODE=2.
     */
    public static GateResult evaluateOutgoingDprValidateCardGate(Connection conn, long dprId, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty() || dprId <= 0) {
            return GateResult.denied("Не заданы DPRID или guid");
        }
        guid = guid.trim();
        if (!DprAccessHelper.canViewDpr(conn, dprId, guid)) {
            return GateResult.denied("Нет доступа к просмотру карты DPR");
        }
        long ppvid = 0L;
        String dsc = null;
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
            }
        }
        if (dsc == null || !DSC_OUTGOING_DPR.equals(dsc.trim())) {
            return GateResult.denied("Проверка доступна только для исходящей карты (DATASOURCEKINDCODE=2)");
        }
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
            return GateResult.denied("Карта прав по guid не найдена");
        }
        Set<String> viewDepKeys = AccessRightService.violationDetectedOutViewDepKeys(rightsJson);
        if (viewDepKeys.isEmpty()) {
            return GateResult.denied("В карте прав не заданы подразделения для violationDetectedOut:view");
        }
        if (!PpvDepPermisUtil.hasOverlap(conn, ppvid, viewDepKeys)) {
            return GateResult.denied("Нет права на проверку: ни одно подразделение из violationDetectedOut:view "
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
