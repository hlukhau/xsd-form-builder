package com.eec.util;

import com.eec.rights.RightsRegistryProvider;
import com.eec.servlet.smr.SmrAccessHelper;

import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Set;

/**
 * Проверки для создания карты SMR (ответ) по входящей карте SMD: право {@code sanitaryMeasureIn:status},
 * источник входящий, статус «В обработке», отсутствие связанной SMR, страна ответа BY (ЕАЭС).
 */
public final class SmrCreateSupport {

    private static final String DSC_INCOMING = "1";
    private static final String DSC_OUTGOING_SMR = "2";

    private static final String SQL_SMD_CORE = ""
            + "SELECT TRIM(TO_CHAR(p.DATASOURCEKINDCODE)) AS DSC, "
            + "       p.SMDSTATUSID, "
            + "       TRIM(p.DOCID) AS DOCID, "
            + "       TRIM(p.MESSAGECODE) AS MESSAGECODE, "
            + "       p.DOCCREATIONDATE AS DOCCREATIONDATE, "
            + "       TRIM(UPPER(c.COUNTRYCODE)) AS DOCCOUNTRYCODE "
            + "FROM SMD p "
            + "LEFT JOIN COUNTRY c ON p.DOCCOUNTRYID = c.COUNTRYID "
            + "     AND c.COUNTRYSDATE <= TRUNC(SYSDATE) AND c.COUNTRYEDATE >= TRUNC(SYSDATE) "
            + "WHERE p.SMDID = ?";

    private static final String SQL_SMDSTATUS_PROCESSING = ""
            + "SELECT SMDSTATUSID FROM SMDSTATUS "
            + "WHERE TRIM(UPPER(SMDSTATUSCODE)) = 'PROCESSING' "
            + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
            + "AND SMDSTATUSACTFL = 1 AND ROWNUM = 1";

    private static final String SQL_SMR_EXISTS = "SELECT SMRID FROM SMR WHERE SMDID = ? AND ROWNUM = 1";

    private static final String SQL_SMR_HAS_PENDING_IN_HIST = ""
            + "SELECT 1 FROM SMRSTATUSHIST hs "
            + "JOIN SMRSTATUS st ON st.SMRSTATUSID = hs.SMRSTATUSID "
            + "WHERE hs.SMRID = ? AND TRIM(UPPER(st.SMRSTATUSCODE)) = 'PENDING' AND ROWNUM = 1";

    private static final String SQL_RESPONSE_COUNTRY_BY = ""
            + "SELECT c.COUNTRYID, TRIM(c.COUNTRYCODE) AS COUNTRYCODE, TRIM(c.COUNTRYNAME) AS COUNTRYNAME "
            + "FROM COUNTRY c "
            + "WHERE TRIM(UPPER(c.COUNTRYCODE)) = 'BY' "
            + "  AND c.COUNTRYSDATE <= TRUNC(SYSDATE) AND c.COUNTRYEDATE >= TRUNC(SYSDATE) "
            + "  AND EXISTS ("
            + "    SELECT 1 FROM COUNTRYGRSET g WHERE g.COUNTRYID = c.COUNTRYID "
            + "      AND g.COUNTRYGRCODE = 'EAUE' AND g.COUNTRYGRSETACTFL = 1"
            + "  ) AND ROWNUM = 1";

    private SmrCreateSupport() {
    }

    public static final class GateResult {
        public final boolean allowed;
        public final String reason;
        public final long smdid;
        public final String docId;
        public final String docCountryCode;
        public final String messageCode;
        public final Date docCreationDate;
        public final long responseCountryId;
        public final String responseCountryCode;
        public final String responseCountryName;
        public final int draftSmrStatusId;
        public final String draftSmrStatusName;

        private GateResult(boolean allowed, String reason, long smdid, String docId, String docCountryCode,
                           String messageCode, Date docCreationDate, long responseCountryId,
                           String responseCountryCode, String responseCountryName, int draftSmrStatusId,
                           String draftSmrStatusName) {
            this.allowed = allowed;
            this.reason = reason;
            this.smdid = smdid;
            this.docId = docId;
            this.docCountryCode = docCountryCode;
            this.messageCode = messageCode;
            this.docCreationDate = docCreationDate;
            this.responseCountryId = responseCountryId;
            this.responseCountryCode = responseCountryCode;
            this.responseCountryName = responseCountryName;
            this.draftSmrStatusId = draftSmrStatusId;
            this.draftSmrStatusName = draftSmrStatusName;
        }

        public static GateResult denied(String reason) {
            return new GateResult(false, reason, 0L, null, null, null, null, 0L, null, null, 0, null);
        }

        public static GateResult ok(long smdid, String docId, String docCountryCode, String messageCode,
                                    Date docCreationDate, long responseCountryId, String responseCountryCode,
                                    String responseCountryName, int draftSmrStatusId, String draftSmrStatusName) {
            return new GateResult(true, null, smdid, docId, docCountryCode, messageCode, docCreationDate,
                    responseCountryId, responseCountryCode, responseCountryName, draftSmrStatusId, draftSmrStatusName);
        }
    }

    /**
     * Полная проверка возможности создать SMR по SMDID.
     */
    public static GateResult evaluateGate(Connection conn, long smdid, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty() || smdid <= 0) {
            return GateResult.denied("Не заданы SMDID или guid");
        }
        guid = guid.trim();

        if (!SmdViewAccessHelper.canViewSmd(conn, smdid, guid)) {
            return GateResult.denied("Нет доступа к просмотру карты SMD");
        }

        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
            return GateResult.denied("Карта прав по guid не найдена");
        }
        Set<String> statusDepKeys = AccessRightService.sanitaryMeasureInStatusDepKeys(rightsJson);
        if (statusDepKeys.isEmpty()) {
            return GateResult.denied("В карте прав не заданы подразделения для sanitaryMeasureIn:status");
        }
        if (!SmdDepPermisUtil.hasOverlap(conn, smdid, statusDepKeys)) {
            return GateResult.denied("Нет права на подготовку ответа: ни одно подразделение из sanitaryMeasureIn:status "
                    + "не входит в доступ к карте (SMDDEPPERMIS)");
        }

        String dsc = null;
        Integer currentPpvStatusId = null;
        String docId = null;
        String messageCode = null;
        Date docCreationDate = null;
        String docCountryCode = null;

        try (PreparedStatement ps = conn.prepareStatement(SQL_SMD_CORE)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Карта SMD не найдена");
                }
                dsc = rs.getString("DSC");
                currentPpvStatusId = getIntObject(rs, "SMDSTATUSID");
                docId = rs.getString("DOCID");
                messageCode = rs.getString("MESSAGECODE");
                docCreationDate = rs.getDate("DOCCREATIONDATE");
                docCountryCode = rs.getString("DOCCOUNTRYCODE");
            }
        }

        if (dsc == null || !DSC_INCOMING.equals(dsc.trim())) {
            return GateResult.denied("Подготовка ответа доступна только для входящей карты SMD");
        }

        Integer processingId;
        try (PreparedStatement ps = conn.prepareStatement(SQL_SMDSTATUS_PROCESSING)) {
            ps.setString(1, DSC_INCOMING);
            try (ResultSet rs = ps.executeQuery()) {
                processingId = rs.next() ? getIntObject(rs, "SMDSTATUSID") : null;
            }
        }
        if (processingId == null) {
            return GateResult.denied("В справочнике SMDSTATUS не найден статус PROCESSING для входящих сведений");
        }
        if (currentPpvStatusId == null || currentPpvStatusId.intValue() != processingId.intValue()) {
            return GateResult.denied("Подготовка ответа доступна только при статусе карты «В обработке» (PROCESSING)");
        }

        try (PreparedStatement ps = conn.prepareStatement(SQL_SMR_EXISTS)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return GateResult.denied("По данной карте SMD уже создана карта сведений о результатах рассмотрения");
                }
            }
        }

        if (docId == null || docId.isEmpty()) {
            return GateResult.denied("У карты SMD не заполнен регистрационный номер (DOCID)");
        }
        if (docCountryCode == null || docCountryCode.length() != 2) {
            return GateResult.denied("У карты SMD не определён код страны уведомления (DOCCOUNTRYID / COUNTRY)");
        }
        if (messageCode == null || messageCode.isEmpty()) {
            return GateResult.denied("У карты SMD не заполнен вид уведомления (MESSAGECODE)");
        }
        if (docCreationDate == null) {
            return GateResult.denied("У карты SMD не заполнена дата формирования (DOCCREATIONDATE)");
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

        Integer initialStatusId = SmrOutgoingStatusHelper.resolveOutgoingInitialCreateStatusId(conn);
        if (initialStatusId == null) {
            return GateResult.denied("В справочнике SMRSTATUS не найден начальный статус (NEW) для исходящего источника (DATASOURCEKINDCODE=2)");
        }
        String initialStatusName = SmrOutgoingStatusHelper.resolveOutgoingStatusName(conn, initialStatusId);
        if (initialStatusName == null || initialStatusName.isEmpty()) {
            return GateResult.denied("Не удалось определить наименование начального статуса SMR");
        }

        return GateResult.ok(smdid, docId, docCountryCode, messageCode, docCreationDate,
                responseCountryId, responseCountryCode, responseCountryName, initialStatusId, initialStatusName);
    }

    private static final String SQL_SMR_FOR_EDIT = ""
            + "SELECT d.SMDID, TRIM(TO_CHAR(d.DATASOURCEKINDCODE)) AS DSC, d.SMRSTATUSID, "
            + "       TRIM(UPPER(NVL(st.SMRSTATUSCODE, ''))) AS STCODE "
            + "FROM SMR d "
            + "LEFT JOIN SMRSTATUS st ON st.SMRSTATUSID = d.SMRSTATUSID "
            + "WHERE d.SMRID = ?";

    /**
     * Редактирование сохранённой исходящей SMR: sanitaryMeasureIn:status ∩ SMDDEPPERMIS, DATASOURCEKINDCODE=2,
     * статус DRAFT / NEW / FAILED / ERROR (по коду {@code SMRSTATUSCODE} в справочнике SMRSTATUS для исходящих).
     */
    public static GateResult evaluateEditGate(Connection conn, long smrId, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty() || smrId <= 0) {
            return GateResult.denied("Не заданы SMRID или guid");
        }
        guid = guid.trim();
        if (!SmrAccessHelper.canViewSmr(conn, smrId, guid)) {
            return GateResult.denied("Нет доступа к просмотру карты SMR");
        }
        long smdid = 0L;
        String dsc = null;
        String statusCode = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_SMR_FOR_EDIT)) {
            ps.setLong(1, smrId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Карта SMR не найдена");
                }
                smdid = rs.getLong("SMDID");
                if (rs.wasNull() || smdid <= 0) {
                    return GateResult.denied("У карты SMR не задана связь с SMD (SMDID)");
                }
                dsc = rs.getString("DSC");
                statusCode = rs.getString("STCODE");
            }
        }
        if (dsc == null || !DSC_OUTGOING_SMR.equals(dsc.trim())) {
            return GateResult.denied("Редактирование доступно только для исходящей карты (DATASOURCEKINDCODE=2)");
        }
        if (statusCode == null || statusCode.isEmpty()) {
            return GateResult.denied("Редактирование недоступно: у карты не определён код статуса в справочнике SMRSTATUS");
        }
        if (!("DRAFT".equals(statusCode) || "NEW".equals(statusCode) || "FAILED".equals(statusCode)
                || "ERROR".equals(statusCode))) {
            return GateResult.denied("Редактирование недоступно для текущего статуса карты");
        }
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
            return GateResult.denied("Карта прав по guid не найдена");
        }
        Set<String> statusDepKeys = AccessRightService.sanitaryMeasureInStatusDepKeys(rightsJson);
        if (statusDepKeys.isEmpty()) {
            return GateResult.denied("В карте прав не заданы подразделения для sanitaryMeasureIn:status");
        }
        if (!SmdDepPermisUtil.hasOverlap(conn, smdid, statusDepKeys)) {
            return GateResult.denied("Нет права на редактирование: ни одно подразделение из sanitaryMeasureIn:status "
                    + "не входит в доступ к связанной карте SMD (SMDDEPPERMIS)");
        }
        return GateResult.ok(smdid, null, null, null, null, 0L, null, null, 0, null);
    }

    /**
     * Удаление черновика исходящей SMR: те же права и SMDDEPPERMIS, что и для редактирования,
     * статус только {@code DRAFT}/{@code NEW} (по коду {@code SMRSTATUSCODE}).
     * Проверка истории PENDING (отправка ОП58) сюда не входит — только при самом удалении.
     */
    public static GateResult evaluateDeleteDraftGate(Connection conn, long smrId, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty() || smrId <= 0) {
            return GateResult.denied("Не заданы SMRID или guid");
        }
        guid = guid.trim();
        if (!SmrAccessHelper.canViewSmr(conn, smrId, guid)) {
            return GateResult.denied("Нет доступа к просмотру карты SMR");
        }
        long smdid = 0L;
        String dsc = null;
        String statusCode = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_SMR_FOR_EDIT)) {
            ps.setLong(1, smrId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Карта SMR не найдена");
                }
                smdid = rs.getLong("SMDID");
                if (rs.wasNull() || smdid <= 0) {
                    return GateResult.denied("У карты SMR не задана связь с SMD (SMDID)");
                }
                dsc = rs.getString("DSC");
                statusCode = rs.getString("STCODE");
            }
        }
        if (dsc == null || !DSC_OUTGOING_SMR.equals(dsc.trim())) {
            return GateResult.denied("Удаление доступно только для исходящей карты (DATASOURCEKINDCODE=2)");
        }
        if (statusCode == null || statusCode.isEmpty()) {
            return GateResult.denied("Удаление недоступно: у карты не определён код статуса в справочнике SMRSTATUS");
        }
        if (!("DRAFT".equals(statusCode) || "NEW".equals(statusCode))) {
            return GateResult.denied("Удалить можно только карту в статусе «Новое» (NEW) или черновик (DRAFT)");
        }
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
            return GateResult.denied("Карта прав по guid не найдена");
        }
        Set<String> statusDepKeys = AccessRightService.sanitaryMeasureInStatusDepKeys(rightsJson);
        if (statusDepKeys.isEmpty()) {
            return GateResult.denied("В карте прав не заданы подразделения для sanitaryMeasureIn:status");
        }
        if (!SmdDepPermisUtil.hasOverlap(conn, smdid, statusDepKeys)) {
            return GateResult.denied("Нет права на удаление: ни одно подразделение из sanitaryMeasureIn:status "
                    + "не входит в доступ к связанной карте SMD (SMDDEPPERMIS)");
        }
        return GateResult.ok(smdid, null, null, null, null, 0L, null, null, 0, null);
    }

    /**
     * Запрет удаления, если карта уже направлялась участникам ОП58
     * (в истории статусов есть запись со статусом PENDING).
     */
    public static GateResult evaluateDeleteBlockedByOp58Send(Connection conn, long smrId) throws SQLException {
        if (smrId <= 0) {
            return GateResult.denied("Не задан SMRID");
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_SMR_HAS_PENDING_IN_HIST)) {
            ps.setLong(1, smrId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return GateResult.denied(
                            "Карта сведений уже направлялась участникам ОП58. Удаление запрещено");
                }
            }
        }
        return GateResult.ok(0L, null, null, null, null, 0L, null, null, 0, null);
    }

    /**
     * Смена статуса исходящей SMR: то же пересечение sanitaryMeasureIn:status с SMDDEPPERMIS, источник исходящий;
     * допустимые текущие статусы — по коду {@code SMRSTATUSCODE} (DRAFT … DELIVERED для исходящих).
     */
    public static GateResult evaluateOutgoingSmrStatusGate(Connection conn, long smrId, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty() || smrId <= 0) {
            return GateResult.denied("Не заданы SMRID или guid");
        }
        guid = guid.trim();
        if (!SmrAccessHelper.canViewSmr(conn, smrId, guid)) {
            return GateResult.denied("Нет доступа к просмотру карты SMR");
        }
        long smdid = 0L;
        String dsc = null;
        String statusCode = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_SMR_FOR_EDIT)) {
            ps.setLong(1, smrId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Карта SMR не найдена");
                }
                smdid = rs.getLong("SMDID");
                if (rs.wasNull() || smdid <= 0) {
                    return GateResult.denied("У карты SMR не задана связь с SMD (SMDID)");
                }
                dsc = rs.getString("DSC");
                statusCode = rs.getString("STCODE");
            }
        }
        if (dsc == null || !DSC_OUTGOING_SMR.equals(dsc.trim())) {
            return GateResult.denied("Действие доступно только для исходящей карты (DATASOURCEKINDCODE=2)");
        }
        if (statusCode == null || statusCode.isEmpty()) {
            return GateResult.denied("Смена статуса недоступна: у карты не определён код статуса в справочнике SMRSTATUS");
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
        Set<String> statusDepKeys = AccessRightService.sanitaryMeasureInStatusDepKeys(rightsJson);
        if (statusDepKeys.isEmpty()) {
            return GateResult.denied("В карте прав не заданы подразделения для sanitaryMeasureIn:status");
        }
        if (!SmdDepPermisUtil.hasOverlap(conn, smdid, statusDepKeys)) {
            return GateResult.denied("Нет права: ни одно подразделение из sanitaryMeasureIn:status "
                    + "не входит в доступ к связанной карте SMD (SMDDEPPERMIS)");
        }
        return GateResult.ok(smdid, null, null, null, null, 0L, null, null, 0, null);
    }

    /** Областной уровень в SMRRESOLUTION по ТЗ (DEPKINDID = 73 в карте прав / TB_DEPKIND). */
    private static final int RIGHTS_DEPKIND_REGIONAL = 73;

    private static final String SQL_DEPKIND_ID_BY_CODE = ""
            + "SELECT DEPKINDID FROM TB_DEPKIND WHERE TRIM(UPPER(DEPKINDCODE)) = TRIM(UPPER(?)) "
            + "AND DEPKINDACTFL = 1 AND ROWNUM = 1";

    private static final String SQL_HAS_RESOLUTION_DEPKIND = ""
            + "SELECT 1 FROM SMRRESOLUTION WHERE SMRID = ? AND DEPKINDID = ? AND ROWNUM = 1";

    /**
     * Направление исходящей SMR участникам ОП 57: {@code sanitaryMeasureIn:status} ∩ SMDDEPPERMIS,
     * {@code DATASOURCEKINDCODE = 2}, статус NEW (с резолюцией областного уровня dep0602 / DEPKINDID 73),
     * FAILED или ERROR.
     */
    public static GateResult evaluateOutgoingSmrSendGate(Connection conn, long smrId, String guid) throws SQLException {
        GateResult statusGate = evaluateOutgoingSmrStatusGate(conn, smrId, guid);
        if (!statusGate.allowed) {
            return statusGate;
        }
        String statusCode = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_SMR_FOR_EDIT)) {
            ps.setLong(1, smrId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    statusCode = rs.getString("STCODE");
                }
            }
        }
        if (statusCode == null || statusCode.isEmpty()) {
            return GateResult.denied("Не определён код статуса карты в справочнике SMRSTATUS");
        }
        if ("FAILED".equals(statusCode) || "ERROR".equals(statusCode)) {
            return statusGate;
        }
        if ("NEW".equals(statusCode)) {
            if (hasRegionalResolutionForOutgoingSend(conn, smrId)) {
                return statusGate;
            }
            return GateResult.denied(
                    "Направление при статусе «Новое» возможно только при наличии резолюции областного уровня "
                            + "(в SMRRESOLUTION запись по DEPKINDCODE dep0602 или DEPKINDID 73).");
        }
        return GateResult.denied(
                "Направление сведений возможно только при статусе «Новое» (с резолюцией областного уровня), "
                        + "«Отправка не удалась» или «Ошибка обработки».");
    }

    /** Резолюция областного уровня для направления из «Новое» (dep0602 или DEPKINDID 73). */
    public static boolean hasRegionalResolutionForOutgoingSend(Connection conn, long smrId) throws SQLException {
        int regionalDepKindId = resolveRegionalDepKindId(conn);
        if (regionalDepKindId <= 0) {
            return false;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_HAS_RESOLUTION_DEPKIND)) {
            ps.setLong(1, smrId);
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
     * Завершение обработки входящей SMR: {@code sanitaryMeasureOut:status} ∩ SMDDEPPERMIS,
     * {@code SMR.DATASOURCEKINDCODE = 1}, текущий статус {@code PROCESSING} (справочник SMRSTATUS для входящих).
     */
    public static GateResult evaluateIncomingSmrCompleteProcessingGate(Connection conn, long smrId, String guid)
            throws SQLException {
        if (guid == null || guid.trim().isEmpty() || smrId <= 0) {
            return GateResult.denied("Не заданы SMRID или guid");
        }
        guid = guid.trim();
        if (!SmrAccessHelper.canViewSmr(conn, smrId, guid)) {
            return GateResult.denied("Нет доступа к просмотру карты SMR");
        }
        long smdid = 0L;
        String dsc = null;
        String statusCode = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_SMR_FOR_EDIT)) {
            ps.setLong(1, smrId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Карта SMR не найдена");
                }
                smdid = rs.getLong("SMDID");
                if (rs.wasNull() || smdid <= 0) {
                    return GateResult.denied("У карты SMR не задана связь с SMD (SMDID)");
                }
                dsc = rs.getString("DSC");
                statusCode = rs.getString("STCODE");
            }
        }
        if (dsc == null || !DSC_INCOMING.equals(dsc.trim())) {
            return GateResult.denied("Завершение обработки доступно только для входящей карты (DATASOURCEKINDCODE=1)");
        }
        if (statusCode == null || statusCode.isEmpty()) {
            return GateResult.denied("Не определён код статуса карты в справочнике SMRSTATUS");
        }
        if (!"PROCESSING".equals(statusCode)) {
            return GateResult.denied("Завершение обработки возможно только при статусе «В обработке» (PROCESSING)");
        }
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
            return GateResult.denied("Карта прав по guid не найдена");
        }
        Set<String> statusDepKeys = AccessRightService.sanitaryMeasureOutStatusDepKeys(rightsJson);
        if (statusDepKeys.isEmpty()) {
            return GateResult.denied("В карте прав не заданы подразделения для sanitaryMeasureOut:status");
        }
        if (!SmdDepPermisUtil.hasOverlap(conn, smdid, statusDepKeys)) {
            return GateResult.denied("Нет права: ни одно подразделение из sanitaryMeasureOut:status "
                    + "не входит в доступ к связанной карте SMD (SMDDEPPERMIS)");
        }
        return GateResult.ok(smdid, null, null, null, null, 0L, null, null, 0, null);
    }

    /**
     * Принудительная проверка карты исходящей SMR: {@code sanitaryMeasureOut:view} ∩ SMDDEPPERMIS, DATASOURCEKINDCODE=2.
     */
    public static GateResult evaluateOutgoingSmrValidateCardGate(Connection conn, long smrId, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty() || smrId <= 0) {
            return GateResult.denied("Не заданы SMRID или guid");
        }
        guid = guid.trim();
        if (!SmrAccessHelper.canViewSmr(conn, smrId, guid)) {
            return GateResult.denied("Нет доступа к просмотру карты SMR");
        }
        long smdid = 0L;
        String dsc = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_SMR_FOR_EDIT)) {
            ps.setLong(1, smrId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Карта SMR не найдена");
                }
                smdid = rs.getLong("SMDID");
                if (rs.wasNull() || smdid <= 0) {
                    return GateResult.denied("У карты SMR не задана связь с SMD (SMDID)");
                }
                dsc = rs.getString("DSC");
            }
        }
        if (dsc == null || !DSC_OUTGOING_SMR.equals(dsc.trim())) {
            return GateResult.denied("Проверка доступна только для исходящей карты (DATASOURCEKINDCODE=2)");
        }
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
            return GateResult.denied("Карта прав по guid не найдена");
        }
        Set<String> viewDepKeys = AccessRightService.sanitaryMeasureOutViewDepKeys(rightsJson);
        if (viewDepKeys.isEmpty()) {
            return GateResult.denied("В карте прав не заданы подразделения для sanitaryMeasureOut:view");
        }
        if (!SmdDepPermisUtil.hasOverlap(conn, smdid, viewDepKeys)) {
            return GateResult.denied("Нет права на проверку: ни одно подразделение из sanitaryMeasureOut:view "
                    + "не входит в доступ к связанной карте SMD (SMDDEPPERMIS)");
        }
        return GateResult.ok(smdid, null, null, null, null, 0L, null, null, 0, null);
    }

    private static final String SQL_SMRID_BY_PPV = "SELECT SMRID FROM SMR WHERE SMDID = ? AND ROWNUM = 1";

    /** Результат проверки «Открыть ответ» (связанная SMR по входящей PPV). */
    public static final class OpenLinkedResult {
        public final boolean allowed;
        public final String reason;
        /** Идентификатор SMR при наличии строки в БД (может быть при {@code allowed == false}). */
        public final Long linkedSmrId;

        private OpenLinkedResult(boolean allowed, String reason, Long linkedSmrId) {
            this.allowed = allowed;
            this.reason = reason;
            this.linkedSmrId = linkedSmrId;
        }

        public static OpenLinkedResult ok(long smrId) {
            return new OpenLinkedResult(true, null, smrId);
        }

        public static OpenLinkedResult no(String reason, Long linkedSmrId) {
            return new OpenLinkedResult(false, reason, linkedSmrId);
        }
    }

    /**
     * Просмотр связанной карты SMR: входящая PPV, есть SMR по SMDID, {@code sanitaryMeasureIn:view} и SMDDEPPERMIS.
     */
    public static OpenLinkedResult evaluateOpenLinkedSmr(Connection conn, long smdid, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty() || smdid <= 0) {
            return OpenLinkedResult.no("Не заданы SMDID или guid", null);
        }
        guid = guid.trim();

        String dsc = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_SMD_CORE)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return OpenLinkedResult.no("Карта SMD не найдена", null);
                }
                dsc = rs.getString("DSC");
            }
        }
        if (dsc == null || !DSC_INCOMING.equals(dsc.trim())) {
            return OpenLinkedResult.no("Просмотр связанного ответа доступен только для входящей карты SMD", null);
        }

        Long smrId = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_SMRID_BY_PPV)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    long id = rs.getLong("SMRID");
                    if (!rs.wasNull()) {
                        smrId = id;
                    }
                }
            }
        }
        if (smrId == null || smrId <= 0) {
            return OpenLinkedResult.no("Связанная карта сведений о результатах рассмотрения не найдена", null);
        }

        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
            return OpenLinkedResult.no("Карта прав по guid не найдена", smrId);
        }
        if (!AccessRightService.hasViolationDetectedInView(rightsJson)) {
            return OpenLinkedResult.no("В карте прав не задано право sanitaryMeasureIn:view", smrId);
        }
        Set<String> viewKeys = AccessRightService.sanitaryMeasureInViewDepKeys(rightsJson);
        if (viewKeys.isEmpty()) {
            return OpenLinkedResult.no("В карте прав не заданы подразделения для sanitaryMeasureIn:view", smrId);
        }
        if (!SmdDepPermisUtil.hasOverlap(conn, smdid, viewKeys)) {
            return OpenLinkedResult.no("Нет права на просмотр связанного ответа: ни одно подразделение из "
                    + "sanitaryMeasureIn:view не входит в доступ к карте (SMDDEPPERMIS)", smrId);
        }
        return OpenLinkedResult.ok(smrId);
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
