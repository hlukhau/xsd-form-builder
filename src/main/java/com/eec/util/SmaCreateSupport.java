package com.eec.util;

import com.eec.rights.RightsRegistryProvider;
import com.eec.servlet.sma.SmaAccessHelper;
import com.eec.servlet.sma.SmaCardKind;

import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Set;

/**
 * Проверки создания, редактирования, удаления и смены статуса карты SMAQ/SMAR.
 */
public final class SmaCreateSupport {

    private static final String DSC_INCOMING = "1";
    private static final String DSC_OUTGOING = "2";

    private static final String SQL_SMD_CORE = ""
            + "SELECT TRIM(TO_CHAR(p.DATASOURCEKINDCODE)) AS DSC, "
            + "       p.SMDSTATUSID, "
            + "       TRIM(p.DOCID) AS DOCID, "
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

    private static final String SQL_SMAQ_CORE = ""
            + "SELECT sq.SMDID, TRIM(TO_CHAR(sq.DATASOURCEKINDCODE)) AS DSC, sq.SMAQSTATUSID, "
            + "       TRIM(UPPER(NVL(st.SMAQSTATUSCODE, ''))) AS STCODE "
            + "FROM SMAQ sq "
            + "LEFT JOIN SMAQSTATUS st ON st.SMAQSTATUSID = sq.SMAQSTATUSID "
            + "WHERE sq.SMAQID = ?";

    private static final String SQL_SMAR_CORE = ""
            + "SELECT sq.SMDID, smar.SMAQID, TRIM(TO_CHAR(smar.DATASOURCEKINDCODE)) AS DSC, smar.SMARSTATUSID, "
            + "       TRIM(UPPER(NVL(st.SMARSTATUSCODE, ''))) AS STCODE "
            + "FROM SMAR smar "
            + "JOIN SMAQ sq ON sq.SMAQID = smar.SMAQID "
            + "LEFT JOIN SMARSTATUS st ON st.SMARSTATUSID = smar.SMARSTATUSID "
            + "WHERE smar.SMARID = ?";

    private static final String SQL_SMAR_EXISTS_BY_SMAQ = "SELECT SMARID FROM SMAR WHERE SMAQID = ? AND ROWNUM = 1";

    private static final String SQL_REQUEST_COUNTRY_BY = ""
            + "SELECT c.COUNTRYID, TRIM(c.COUNTRYCODE) AS COUNTRYCODE, TRIM(c.COUNTRYNAME) AS COUNTRYNAME "
            + "FROM COUNTRY c "
            + "WHERE TRIM(UPPER(c.COUNTRYCODE)) = 'BY' "
            + "  AND c.COUNTRYSDATE <= TRUNC(SYSDATE) AND c.COUNTRYEDATE >= TRUNC(SYSDATE) "
            + "  AND EXISTS ("
            + "    SELECT 1 FROM COUNTRYGRSET g WHERE g.COUNTRYID = c.COUNTRYID "
            + "      AND g.COUNTRYGRCODE = 'EAUE' AND g.COUNTRYGRSETACTFL = 1"
            + "  ) AND ROWNUM = 1";

    private SmaCreateSupport() {
    }

    public static final class GateResult {
        public final boolean allowed;
        public final String reason;
        public final long smdid;
        public final long smaqid;
        public final String docId;
        public final String docCountryCode;
        public final Date docCreationDate;
        public final long requestCountryId;
        public final String requestCountryCode;
        public final String requestCountryName;
        public final int draftStatusId;
        public final String draftStatusName;

        private GateResult(boolean allowed, String reason, long smdid, long smaqid, String docId,
                           String docCountryCode, Date docCreationDate, long requestCountryId,
                           String requestCountryCode, String requestCountryName, int draftStatusId,
                           String draftStatusName) {
            this.allowed = allowed;
            this.reason = reason;
            this.smdid = smdid;
            this.smaqid = smaqid;
            this.docId = docId;
            this.docCountryCode = docCountryCode;
            this.docCreationDate = docCreationDate;
            this.requestCountryId = requestCountryId;
            this.requestCountryCode = requestCountryCode;
            this.requestCountryName = requestCountryName;
            this.draftStatusId = draftStatusId;
            this.draftStatusName = draftStatusName;
        }

        public static GateResult denied(String reason) {
            return new GateResult(false, reason, 0L, 0L, null, null, null, 0L, null, null, 0, null);
        }

        public static GateResult ok(long smdid, long smaqid, String docId, String docCountryCode,
                                    Date docCreationDate, long requestCountryId, String requestCountryCode,
                                    String requestCountryName, int draftStatusId, String draftStatusName) {
            return new GateResult(true, null, smdid, smaqid, docId, docCountryCode, docCreationDate,
                    requestCountryId, requestCountryCode, requestCountryName, draftStatusId, draftStatusName);
        }

        public static GateResult okLinked(long smdid, long smaqid) {
            return new GateResult(true, null, smdid, smaqid, null, null, null, 0L, null, null, 0, null);
        }
    }

    /** Создание исходящего SMAQ по входящей SMD в статусе PROCESSING. */
    public static GateResult evaluateSmaqCreateGate(Connection conn, long smdid, String guid) throws SQLException {
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
            return GateResult.denied("Нет права на подготовку запроса: ни одно подразделение из sanitaryMeasureIn:status "
                    + "не входит в доступ к карте (SMDDEPPERMIS)");
        }

        String dsc;
        Integer currentStatusId;
        String docId;
        Date docCreationDate;
        String docCountryCode;
        try (PreparedStatement ps = conn.prepareStatement(SQL_SMD_CORE)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Карта SMD не найдена");
                }
                dsc = rs.getString("DSC");
                currentStatusId = getIntObject(rs, "SMDSTATUSID");
                docId = rs.getString("DOCID");
                docCreationDate = rs.getDate("DOCCREATIONDATE");
                docCountryCode = rs.getString("DOCCOUNTRYCODE");
            }
        }
        if (dsc == null || !DSC_INCOMING.equals(dsc.trim())) {
            return GateResult.denied("Подготовка запроса доступна только для входящей карты SMD");
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
        if (currentStatusId == null || currentStatusId.intValue() != processingId.intValue()) {
            return GateResult.denied("Подготовка запроса доступна только при статусе карты «В обработке» (PROCESSING)");
        }
        if (docId == null || docId.isEmpty()) {
            return GateResult.denied("У карты SMD не заполнен регистрационный номер (DOCID)");
        }
        if (docCountryCode == null || docCountryCode.length() != 2) {
            return GateResult.denied("У карты SMD не определён код страны уведомления (DOCCOUNTRYID / COUNTRY)");
        }
        if (docCreationDate == null) {
            return GateResult.denied("У карты SMD не заполнена дата формирования (DOCCREATIONDATE)");
        }

        long requestCountryId = 0L;
        String requestCountryCode = null;
        String requestCountryName = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_REQUEST_COUNTRY_BY)) {
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Не найдена страна BY (ЕАЭС) в справочнике COUNTRY для запроса");
                }
                requestCountryId = rs.getLong("COUNTRYID");
                requestCountryCode = rs.getString("COUNTRYCODE");
                requestCountryName = rs.getString("COUNTRYNAME");
            }
        }

        Integer newStatusId = SmaOutgoingStatusHelper.resolveOutgoingStatusId(conn, SmaCardKind.SMAQ, "NEW");
        if (newStatusId == null) {
            return GateResult.denied("В справочнике SMAQSTATUS не найден статус NEW для исходящего источника (DATASOURCEKINDCODE=2)");
        }
        String newStatusName = resolveOutgoingStatusName(conn, SmaCardKind.SMAQ, newStatusId);

        return GateResult.ok(smdid, 0L, docId, docCountryCode, docCreationDate,
                requestCountryId, requestCountryCode, requestCountryName, newStatusId, newStatusName);
    }

    /** Создание исходящего SMAR по SMAQ при исходящей SMD и отсутствии ответа. */
    public static GateResult evaluateSmarCreateGate(Connection conn, long smaqid, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty() || smaqid <= 0) {
            return GateResult.denied("Не заданы SMAQID или guid");
        }
        guid = guid.trim();
        if (!SmaAccessHelper.canViewSmaq(conn, smaqid, guid)) {
            return GateResult.denied("Нет доступа к просмотру карты SMAQ");
        }

        long smdid = 0L;
        String smdDsc = null;
        String docId = null;
        Date docCreationDate = null;
        String docCountryCode = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_SMAQ_CORE)) {
            ps.setLong(1, smaqid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Карта SMAQ не найдена");
                }
                smdid = rs.getLong("SMDID");
                if (rs.wasNull() || smdid <= 0) {
                    return GateResult.denied("У карты SMAQ не задана связь с SMD (SMDID)");
                }
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_SMD_CORE)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Связанная карта SMD не найдена");
                }
                smdDsc = rs.getString("DSC");
                docId = rs.getString("DOCID");
                docCreationDate = rs.getDate("DOCCREATIONDATE");
                docCountryCode = rs.getString("DOCCOUNTRYCODE");
            }
        }
        if (smdDsc == null || !DSC_OUTGOING.equals(smdDsc.trim())) {
            return GateResult.denied("Подготовка ответа доступна только при исходящей связанной карте SMD (DATASOURCEKINDCODE=2)");
        }

        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
            return GateResult.denied("Карта прав по guid не найдена");
        }
        Set<String> editDepKeys = AccessRightService.sanitaryMeasureOutEditDepKeys(rightsJson);
        if (editDepKeys.isEmpty()) {
            return GateResult.denied("В карте прав не заданы подразделения для sanitaryMeasureOut:edit");
        }
        if (!SmdDepPermisUtil.hasOverlap(conn, smdid, editDepKeys)) {
            return GateResult.denied("Нет права на подготовку ответа: ни одно подразделение из sanitaryMeasureOut:edit "
                    + "не входит в доступ к связанной карте SMD (SMDDEPPERMIS)");
        }

        try (PreparedStatement ps = conn.prepareStatement(SQL_SMAR_EXISTS_BY_SMAQ)) {
            ps.setLong(1, smaqid);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return GateResult.denied("По данному запросу SMAQ уже создан ответ SMAR");
                }
            }
        }

        Integer newStatusId = SmaOutgoingStatusHelper.resolveOutgoingStatusId(conn, SmaCardKind.SMAR, "NEW");
        if (newStatusId == null) {
            return GateResult.denied("В справочнике SMARSTATUS не найден статус NEW для исходящего источника (DATASOURCEKINDCODE=2)");
        }
        String newStatusName = resolveOutgoingStatusName(conn, SmaCardKind.SMAR, newStatusId);

        return GateResult.ok(smdid, smaqid, docId, docCountryCode, docCreationDate,
                0L, null, null, newStatusId, newStatusName);
    }

    public static GateResult evaluateSmaqEditGate(Connection conn, long smaqId, String guid) throws SQLException {
        RightsDepKeysResult rights = loadRightsDepKeys(guid, "sanitaryMeasureIn:status",
                AccessRightService::sanitaryMeasureInStatusDepKeys);
        if (!rights.allowed) {
            return GateResult.denied(rights.reason);
        }
        return evaluateOutgoingEditGate(conn, SmaCardKind.SMAQ, smaqId, guid, rights.depKeys,
                "sanitaryMeasureIn:status", SQL_SMAQ_CORE);
    }

    public static GateResult evaluateSmarEditGate(Connection conn, long smarId, String guid) throws SQLException {
        RightsDepKeysResult rights = loadRightsDepKeys(guid, "sanitaryMeasureOut:edit",
                AccessRightService::sanitaryMeasureOutEditDepKeys);
        if (!rights.allowed) {
            return GateResult.denied(rights.reason);
        }
        return evaluateOutgoingEditGate(conn, SmaCardKind.SMAR, smarId, guid, rights.depKeys,
                "sanitaryMeasureOut:edit", SQL_SMAR_CORE);
    }

    public static GateResult evaluateSmaqDeleteGate(Connection conn, long smaqId, String guid) throws SQLException {
        RightsDepKeysResult rights = loadRightsDepKeys(guid, "sanitaryMeasureIn:status",
                AccessRightService::sanitaryMeasureInStatusDepKeys);
        if (!rights.allowed) {
            return GateResult.denied(rights.reason);
        }
        return evaluateOutgoingDeleteGate(conn, SmaCardKind.SMAQ, smaqId, guid, rights.depKeys,
                "sanitaryMeasureIn:status", SQL_SMAQ_CORE);
    }

    public static GateResult evaluateSmarDeleteGate(Connection conn, long smarId, String guid) throws SQLException {
        RightsDepKeysResult rights = loadRightsDepKeys(guid, "sanitaryMeasureOut:edit",
                AccessRightService::sanitaryMeasureOutEditDepKeys);
        if (!rights.allowed) {
            return GateResult.denied(rights.reason);
        }
        return evaluateOutgoingDeleteGate(conn, SmaCardKind.SMAR, smarId, guid, rights.depKeys,
                "sanitaryMeasureOut:edit", SQL_SMAR_CORE);
    }

    public static GateResult evaluateSmaqSendGate(Connection conn, long smaqId, String guid) throws SQLException {
        RightsDepKeysResult rights = loadRightsDepKeys(guid, "sanitaryMeasureIn:status",
                AccessRightService::sanitaryMeasureInStatusDepKeys);
        if (!rights.allowed) {
            return GateResult.denied(rights.reason);
        }
        return evaluateOutgoingSendGate(conn, SmaCardKind.SMAQ, smaqId, guid, rights.depKeys,
                "sanitaryMeasureIn:status", SQL_SMAQ_CORE);
    }

    public static GateResult evaluateSmarSendGate(Connection conn, long smarId, String guid) throws SQLException {
        RightsDepKeysResult rights = loadRightsDepKeys(guid, "sanitaryMeasureOut:edit",
                AccessRightService::sanitaryMeasureOutEditDepKeys);
        if (!rights.allowed) {
            return GateResult.denied(rights.reason);
        }
        return evaluateOutgoingSendGate(conn, SmaCardKind.SMAR, smarId, guid, rights.depKeys,
                "sanitaryMeasureOut:edit", SQL_SMAR_CORE);
    }

    public static GateResult evaluateIncomingCompleteProcessingGate(Connection conn, SmaCardKind kind, long cardId,
                                                                    String guid) throws SQLException {
        if (kind == null || cardId <= 0 || guid == null || guid.trim().isEmpty()) {
            return GateResult.denied("Не заданы вид карты, идентификатор или guid");
        }
        guid = guid.trim();
        boolean canView = kind == SmaCardKind.SMAQ
                ? SmaAccessHelper.canViewSmaq(conn, cardId, guid)
                : SmaAccessHelper.canViewSmar(conn, cardId, guid);
        if (!canView) {
            return GateResult.denied("Нет доступа к просмотру карты");
        }

        String sql = kind == SmaCardKind.SMAQ ? SQL_SMAQ_CORE : SQL_SMAR_CORE;
        long smdid = 0L;
        long smaqid = 0L;
        String dsc = null;
        String statusCode = null;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, cardId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Карта не найдена");
                }
                smdid = rs.getLong("SMDID");
                if (kind == SmaCardKind.SMAR) {
                    smaqid = rs.getLong("SMAQID");
                }
                dsc = rs.getString("DSC");
                statusCode = rs.getString("STCODE");
            }
        }
        if (kind == SmaCardKind.SMAQ && smdid <= 0) {
            return GateResult.denied("У карты SMAQ не задана связь с SMD (SMDID)");
        }
        if (dsc == null || !DSC_INCOMING.equals(dsc.trim())) {
            return GateResult.denied("Завершение обработки доступно только для входящей карты (DATASOURCEKINDCODE=1)");
        }
        if (statusCode == null || !"PROCESSING".equals(statusCode)) {
            return GateResult.denied("Завершение обработки возможно только при статусе «В обработке» (PROCESSING)");
        }
        RightsDepKeysResult rights = loadRightsDepKeys(guid, "sanitaryMeasureOut:status",
                AccessRightService::sanitaryMeasureOutStatusDepKeys);
        if (!rights.allowed) {
            return GateResult.denied(rights.reason);
        }
        Set<String> statusDepKeys = rights.depKeys;
        if (!SmdDepPermisUtil.hasOverlap(conn, smdid, statusDepKeys)) {
            return GateResult.denied("Нет права: ни одно подразделение из sanitaryMeasureOut:status "
                    + "не входит в доступ к связанной карте SMD (SMDDEPPERMIS)");
        }
        if (kind == SmaCardKind.SMAQ) {
            return GateResult.okLinked(smdid, 0L);
        }
        return GateResult.okLinked(smdid, smaqid);
    }

    private static GateResult evaluateOutgoingEditGate(Connection conn, SmaCardKind kind, long cardId, String guid,
                                                         Set<String> depKeys, String rightLabel, String sql)
            throws SQLException {
        if (guid == null || guid.trim().isEmpty() || cardId <= 0) {
            return GateResult.denied("Не заданы идентификатор карты или guid");
        }
        guid = guid.trim();
        boolean canView = kind == SmaCardKind.SMAQ
                ? SmaAccessHelper.canViewSmaq(conn, cardId, guid)
                : SmaAccessHelper.canViewSmar(conn, cardId, guid);
        if (!canView) {
            return GateResult.denied("Нет доступа к просмотру карты");
        }
        long smdid = 0L;
        long smaqid = 0L;
        String dsc = null;
        String statusCode = null;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, cardId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Карта не найдена");
                }
                smdid = rs.getLong("SMDID");
                if (kind == SmaCardKind.SMAR) {
                    smaqid = rs.getLong("SMAQID");
                }
                dsc = rs.getString("DSC");
                statusCode = rs.getString("STCODE");
            }
        }
        if (dsc == null || !DSC_OUTGOING.equals(dsc.trim())) {
            return GateResult.denied("Редактирование доступно только для исходящей карты (DATASOURCEKINDCODE=2)");
        }
        if (statusCode == null || statusCode.isEmpty()) {
            return GateResult.denied("Редактирование недоступно: у карты не определён код статуса");
        }
        if (!("NEW".equals(statusCode) || "FAILED".equals(statusCode) || "ERROR".equals(statusCode))) {
            return GateResult.denied("Редактирование недоступно для текущего статуса карты");
        }
        if (depKeys == null || depKeys.isEmpty()) {
            return GateResult.denied("В карте прав не заданы подразделения для " + rightLabel);
        }
        if (!SmdDepPermisUtil.hasOverlap(conn, smdid, depKeys)) {
            return GateResult.denied("Нет права на редактирование: ни одно подразделение из " + rightLabel
                    + " не входит в доступ к связанной карте SMD (SMDDEPPERMIS)");
        }
        return GateResult.okLinked(smdid, smaqid);
    }

    private static GateResult evaluateOutgoingDeleteGate(Connection conn, SmaCardKind kind, long cardId, String guid,
                                                         Set<String> depKeys, String rightLabel, String sql)
            throws SQLException {
        if (guid == null || guid.trim().isEmpty() || cardId <= 0) {
            return GateResult.denied("Не заданы идентификатор карты или guid");
        }
        guid = guid.trim();
        boolean canView = kind == SmaCardKind.SMAQ
                ? SmaAccessHelper.canViewSmaq(conn, cardId, guid)
                : SmaAccessHelper.canViewSmar(conn, cardId, guid);
        if (!canView) {
            return GateResult.denied("Нет доступа к просмотру карты");
        }
        long smdid = 0L;
        long smaqid = 0L;
        String dsc = null;
        String statusCode = null;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, cardId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Карта не найдена");
                }
                smdid = rs.getLong("SMDID");
                if (kind == SmaCardKind.SMAR) {
                    smaqid = rs.getLong("SMAQID");
                }
                dsc = rs.getString("DSC");
                statusCode = rs.getString("STCODE");
            }
        }
        if (dsc == null || !DSC_OUTGOING.equals(dsc.trim())) {
            return GateResult.denied("Удаление доступно только для исходящей карты (DATASOURCEKINDCODE=2)");
        }
        if (statusCode == null || !"DRAFT".equals(statusCode)) {
            return GateResult.denied("Удалить можно только черновик карты (статус DRAFT)");
        }
        if (depKeys == null || depKeys.isEmpty()) {
            return GateResult.denied("В карте прав не заданы подразделения для " + rightLabel);
        }
        if (!SmdDepPermisUtil.hasOverlap(conn, smdid, depKeys)) {
            return GateResult.denied("Нет права на удаление: ни одно подразделение из " + rightLabel
                    + " не входит в доступ к связанной карте SMD (SMDDEPPERMIS)");
        }
        return GateResult.okLinked(smdid, smaqid);
    }

    private static GateResult evaluateOutgoingSendGate(Connection conn, SmaCardKind kind, long cardId, String guid,
                                                       Set<String> depKeys, String rightLabel, String sql)
            throws SQLException {
        if (guid == null || guid.trim().isEmpty() || cardId <= 0) {
            return GateResult.denied("Не заданы идентификатор карты или guid");
        }
        guid = guid.trim();
        boolean canView = kind == SmaCardKind.SMAQ
                ? SmaAccessHelper.canViewSmaq(conn, cardId, guid)
                : SmaAccessHelper.canViewSmar(conn, cardId, guid);
        if (!canView) {
            return GateResult.denied("Нет доступа к просмотру карты");
        }
        long smdid = 0L;
        long smaqid = 0L;
        String dsc = null;
        String statusCode = null;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, cardId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Карта не найдена");
                }
                smdid = rs.getLong("SMDID");
                if (kind == SmaCardKind.SMAR) {
                    smaqid = rs.getLong("SMAQID");
                }
                dsc = rs.getString("DSC");
                statusCode = rs.getString("STCODE");
            }
        }
        if (dsc == null || !DSC_OUTGOING.equals(dsc.trim())) {
            return GateResult.denied("Направление доступно только для исходящей карты (DATASOURCEKINDCODE=2)");
        }
        if (statusCode == null || statusCode.isEmpty()) {
            return GateResult.denied("Направление недоступно: у карты не определён код статуса");
        }
        if (!("NEW".equals(statusCode) || "FAILED".equals(statusCode) || "ERROR".equals(statusCode))) {
            return GateResult.denied("Направление сведений возможно только при статусе «Новое», "
                    + "«Отправка не удалась» или «Ошибка обработки»");
        }
        if (depKeys == null || depKeys.isEmpty()) {
            return GateResult.denied("В карте прав не заданы подразделения для " + rightLabel);
        }
        if (!SmdDepPermisUtil.hasOverlap(conn, smdid, depKeys)) {
            return GateResult.denied("Нет права на направление: ни одно подразделение из " + rightLabel
                    + " не входит в доступ к связанной карте SMD (SMDDEPPERMIS)");
        }
        return GateResult.okLinked(smdid, smaqid);
    }

    private static final class RightsDepKeysResult {
        final boolean allowed;
        final String reason;
        final Set<String> depKeys;

        private RightsDepKeysResult(boolean allowed, String reason, Set<String> depKeys) {
            this.allowed = allowed;
            this.reason = reason;
            this.depKeys = depKeys;
        }
    }

    private static RightsDepKeysResult loadRightsDepKeys(String guid, String rightLabel,
                                                         java.util.function.Function<String, Set<String>> extractor) {
        if (guid == null || guid.trim().isEmpty()) {
            return new RightsDepKeysResult(false, "Не задан guid", null);
        }
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid.trim());
        if (rightsJson == null || rightsJson.isEmpty()) {
            return new RightsDepKeysResult(false, "Карта прав по guid не найдена", null);
        }
        Set<String> depKeys = extractor.apply(rightsJson);
        if (depKeys == null || depKeys.isEmpty()) {
            return new RightsDepKeysResult(false,
                    "В карте прав не заданы подразделения для " + rightLabel, null);
        }
        return new RightsDepKeysResult(true, null, depKeys);
    }

    private static String resolveOutgoingStatusName(Connection conn, SmaCardKind kind, int statusId)
            throws SQLException {
        String sql = kind == SmaCardKind.SMAQ
                ? "SELECT TRIM(SMAQSTATUSNAME) AS NM FROM SMAQSTATUS WHERE SMAQSTATUSID = ? AND ROWNUM = 1"
                : "SELECT TRIM(SMARSTATUSNAME) AS NM FROM SMARSTATUS WHERE SMARSTATUSID = ? AND ROWNUM = 1";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
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
