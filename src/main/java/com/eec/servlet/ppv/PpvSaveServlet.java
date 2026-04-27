package com.eec.servlet.ppv;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.Reader;
import java.sql.Clob;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Создание или обновление карты.
 * POST /api/ppv/save — тело JSON:
 * - Создание: { "isNew": true, "xmlBody": "...", "metadata": { ... } } — INSERT в PPV и PPVXML (версия 1, уникальный регистрационный номер из метаданных). При конфликте уникальности — сообщение.
 * - Обновление: { "isNew": false, "dpaid": <number>, "xmlBody": "...", "metadata": { ... } } — UPDATE PPVXML и MODIFICATIONDATETIME по PPVID.
 */
public class PpvSaveServlet extends HttpServlet {

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[PpvSaveServlet] Initialized (POST /api/ppv/save)");
    }

    /** Код типа источника для исходящих карт: в PPV и в PPVSTATUS хранится 2 (код 3 — из БД ЕЭК) */
    private static final String DATASOURCEKINDCODE_OUTGOING = "2";
    private static final String EDOCCODE_DEFAULT = "R.SM.SS.08.002";
    private static final String EDOCVERSION_DEFAULT = "1.0.0";

    /** Получить следующий PPVID (последовательность sqdpa или fallback) */
    private static final String SQL_NEXT_DPAID = "SELECT SQPPV.NEXTVAL FROM DUAL";
    private static final String SQL_NEXT_DPAID_FALLBACK = "SELECT NVL(MAX(PPVID),0)+1 AS NEXTVAL FROM PPV";

    /** PPVSTATUSID по названию «Черновик» для исходящих (в PPVSTATUS у них DATASOURCEKINDCODE = 2) */
    private static final String SQL_STATUS_DRAFT = "SELECT PPVSTATUSID FROM PPVSTATUS WHERE TRIM(PPVSTATUSNAME) = 'Черновик' AND DATASOURCEKINDCODE = ?";

    /** COUNTRYID по коду страны (COUNTRYCODE) */
    private static final String SQL_COUNTRY_ID = "SELECT COUNTRYID FROM COUNTRY WHERE UPPER(TRIM(COUNTRYCODE)) = ? AND COUNTRYSDATE <= SYSDATE AND COUNTRYEDATE >= SYSDATE";
    /** AUTHORITYID по AUTHORITYUID (или по числовому идентификатору из metadata) */
    private static final String SQL_AUTHORITY_ID_BY_UID = "SELECT AUTHORITYID FROM AUTHORITY WHERE TRIM(AUTHORITYUID) = ?";
    /** SANITARYPRODTYPEID по коду вида продукции (для PPV при выборе по коду) */
    private static final String SQL_SANITARYPRODTYPE_ID_BY_CODE = "SELECT SANITARYPRODTYPEID FROM SANITARYPRODTYPE WHERE TRIM(SANITARYPRODTYPECODE) = ? AND ROWNUM = 1";

    /** INSERT PPV */
    private static final String SQL_INSERT_DPA = ""
            + "INSERT INTO PPV (PPVID, DATASOURCEKINDCODE, ALERTCOUNTRYID, INCIDENTID, AUTHORITYID, "
            + "INCIDENTALERTKINDCODE, DOCCREATIONDATE, PPVSTATUSID, COMMODITYCODE, SANITARYPRODTYPEID, SANITARYPRODNAME, "
            + "MANUFCOUNTRYID, MANUFBUSENTNAME, MANUFBUSENTBRIEFNAME, ENDDATE, CREATIONDATETIME, MODIFICATIONDATETIME, SANITARYPRODTYPENAME) "
            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, SYSDATE, NULL, ?)";

    /** INSERT PPVXML */
    private static final String SQL_INSERT_PPVXML = "INSERT INTO PPVXML (PPVID, PPVXMLBODY, EDOCCODE, EDOCVERSION) VALUES (?, ?, ?, ?)";

    /** INSERT в историю смены статусов — присвоение статуса «Черновик» при создании карты */
    private static final String SQL_INSERT_PPVSTATUSHIST = "INSERT INTO PPVSTATUSHIST (PPVID, PPVSTATUSID, PPVSTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, ?)";

    /** UPDATE PPVXML при обновлении существующей карты */
    private static final String SQL_UPDATE_PPVXML = "UPDATE PPVXML SET PPVXMLBODY = ?, EDOCCODE = ?, EDOCVERSION = ? WHERE PPVID = ?";

    /** Обновить MODIFICATIONDATETIME, ENDDATE, AUTHORITYID, производителя, код ТН ВЭД и вид/наименование продукции в PPV при обновлении */
    private static final String SQL_UPDATE_DPA_MODIFIED = "UPDATE PPV SET MODIFICATIONDATETIME = SYSDATE, ENDDATE = ?, AUTHORITYID = ?, MANUFBUSENTNAME = ?, MANUFBUSENTBRIEFNAME = ?, COMMODITYCODE = ?, SANITARYPRODNAME = ?, SANITARYPRODTYPEID = ?, SANITARYPRODTYPENAME = ? WHERE PPVID = ?";
    /** Текущий PPVSTATUSID карты (при сохранении: только Отредактировано (12) → переход в «Новое»; остальные статусы не меняются) */
    private static final String SQL_SELECT_PPVSTATUSID = "SELECT PPVSTATUSID FROM PPV WHERE PPVID = ?";
    private static final int OUTGOING_NEW = 6, OUTGOING_FAILED = 9, OUTGOING_ERROR = 10, OUTGOING_EDITED = 12;
    private static final int OUTGOING_DELIVERED = 11;

    /** Исходная карта для новой версии (все поля PPV для копирования) */
    private static final String SQL_SOURCE_DPA_FOR_COPY = ""
            + "SELECT INCIDENTID, ALERTCOUNTRYID, AUTHORITYID, INCIDENTALERTKINDCODE, COMMODITYCODE, "
            + "SANITARYPRODTYPEID, SANITARYPRODNAME, MANUFCOUNTRYID, MANUFBUSENTNAME, MANUFBUSENTBRIEFNAME, SANITARYPRODTYPENAME "
            + "FROM PPV WHERE PPVID = ? AND DATASOURCEKINDCODE = ? AND PPVSTATUSID = ? AND ENDDATE IS NULL";
    private static final String SQL_INSERT_PPVDEPPERMIS = "INSERT INTO PPVDEPPERMIS (PPVID, DEPID, GRANTDATETIME) VALUES (?, ?, SYSDATE)";
    private static final String SQL_DEPS_FOR_COPY = "SELECT DEPID FROM PPVDEPPERMIS WHERE PPVID = ?";
    /** Проверка существования подразделения (FK PPVDEPPERMIS_FK2 → родительская таблица, обычно TB_DEP) */
    private static final String SQL_EXISTS_DEP = "SELECT 1 FROM TB_DEP WHERE DEPID = ?";

    /** Код участника общего процесса для адресатов PPV (PPVACTOR.ACTORCODE) */
    private static final String PPV_ACTOR_CODE = "P.SS.08.ACT.005";

    private static final String SQL_NEXT_PPVACTORID = "SELECT NVL(MAX(PPVACTORID),0)+1 AS N FROM PPVACTOR";
    private static final String SQL_INSERT_PPVACTOR = ""
            + "INSERT INTO PPVACTOR (PPVACTORID, PPVID, ACTORCOUNTRYCODE, ACTORCODE, EDOCID, PPVACTORACTFL, CDATE) "
            + "VALUES (?, ?, ?, ?, NULL, 1, SYSDATE)";
    /** Актуальная запись адресата по паре (PPVID, ACTORCODE, ACTORCOUNTRYCODE) */
    private static final String SQL_EXIST_ACTIVE_PPVACTOR = ""
            + "SELECT 1 FROM PPVACTOR WHERE PPVID = ? AND ACTORCODE = ? AND UPPER(TRIM(ACTORCOUNTRYCODE)) = ? "
            + "AND PPVACTORACTFL = 1 AND ROWNUM = 1";
    /** Физическое удаление строки адресата без ответа (EDOCID пустой), принадлежащей карте */
    private static final String SQL_DELETE_PPVACTOR_NO_EDOC = ""
            + "DELETE FROM PPVACTOR WHERE PPVACTORID = ? AND PPVID = ? AND ACTORCODE = ? "
            + "AND NVL(LENGTH(TRIM(EDOCID)), 0) = 0";
    private static final String SQL_VALIDATE_PPV_ACTOR_COUNTRY = ""
            + "SELECT 1 FROM DUAL WHERE EXISTS ("
            + "  SELECT 1 FROM COUNTRY c "
            + "  WHERE UPPER(TRIM(c.COUNTRYCODE)) = ? "
            + "    AND TRUNC(?) BETWEEN TRUNC(c.COUNTRYSDATE) AND TRUNC(c.COUNTRYEDATE) "
            + "    AND UPPER(TRIM(c.COUNTRYCODE)) <> 'BY' "
            + "    AND EXISTS (SELECT 1 FROM COUNTRYGRSET g WHERE g.COUNTRYID = c.COUNTRYID "
            + "      AND g.COUNTRYGRCODE = 'EAUE' AND g.COUNTRYGRSETACTFL = 1)"
            + ")";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        System.out.println("[PpvSaveServlet] doPost called");
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");

        // Обязательно UTF-8: иначе кириллица в xmlBody искажается при записи в CLOB (PPVXML)
        request.setCharacterEncoding("UTF-8");
        String body = readBody(request);
        if (body == null || body.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Тело запроса пусто");
            return;
        }

        boolean isNew = extractJsonBoolean(body, "isNew");
        Long dpaidParam = extractJsonLong(body, "dpaid");
        Long copyFromDpaid = extractJsonLong(body, "copyFromDpaid");
        String guid = extractJsonString(body, "guid");

        String xmlBody = extractJsonStringXmlBody(body);
        if (xmlBody == null || xmlBody.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Требуется xmlBody");
            return;
        }
        if ("null".equals(xmlBody.trim()) || !xmlBody.trim().startsWith("<")) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "xmlBody должен содержать валидный XML (начинаться с <)");
            return;
        }

        Integer userId = getUserIdFromRightsByGuid(guid != null ? guid.trim() : null);

        String metaBlock = extractJsonObject(body, "metadata");
        if (metaBlock == null) metaBlock = "{}";
        String incidentId = extractJsonString(metaBlock, "incidentId");
        String countryCode = extractJsonString(metaBlock, "countryCode");
        String docCreationDate = extractJsonString(metaBlock, "docCreationDate");
        String incidentAlertKindCode = extractJsonString(metaBlock, "incidentAlertKindCode");
        String commodityCode = extractJsonString(metaBlock, "commodityCode");
        String sanitaryProdTypeCode = extractJsonString(metaBlock, "sanitaryProdTypeCode");
        String sanitaryProdTypeName = extractJsonString(metaBlock, "sanitaryProdTypeName");
        String sanitaryProdName = extractJsonString(metaBlock, "sanitaryProdName");
        Integer alertCountryId = extractJsonInt(metaBlock, "alertCountryId");
        Integer manufCountryId = extractJsonInt(metaBlock, "manufCountryId");
        String manufBusEntName = extractJsonString(metaBlock, "manufBusEntName");
        String manufBusEntBriefName = extractJsonString(metaBlock, "manufBusEntBriefName");
        String edocCode = extractJsonString(metaBlock, "edocCode");
        String edocVersion = extractJsonString(metaBlock, "edocVersion");
        if (edocCode == null || edocCode.isEmpty()) edocCode = EDOCCODE_DEFAULT;
        if (edocVersion == null || edocVersion.isEmpty()) edocVersion = EDOCVERSION_DEFAULT;

        String manufCountryCode = extractJsonString(metaBlock, "manufCountryCode");
        String endDate = extractJsonString(metaBlock, "endDate");
        String authorityIdStr = extractJsonString(metaBlock, "authorityId");

        Connection conn = null;
        boolean transactionEnded = false;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            conn.setAutoCommit(false);

            if (isNew) {
                if (copyFromDpaid != null && copyFromDpaid > 0 && guid != null && !guid.trim().isEmpty()) {
                    Long newDpaidFromCopy = handleNewVersionCopy(conn, response, request, copyFromDpaid, guid.trim(), xmlBody, body);
                    if (newDpaidFromCopy == null) {
                        return;
                    }
                    conn.commit();
                    transactionEnded = true;
                    response.setStatus(HttpServletResponse.SC_OK);
                    response.getWriter().print("{\"success\":true,\"dpaid\":" + newDpaidFromCopy + "}");
                    return;
                }
                // Создание: INSERT. Регистрационный номер из metadata (incidentId). Поиск существующей записи не делаем.
                if (alertCountryId == null && countryCode != null && !countryCode.trim().isEmpty()) {
                    alertCountryId = resolveCountryId(conn, countryCode.trim());
                }
                if (alertCountryId == null && "RU".equalsIgnoreCase(countryCode != null ? countryCode.trim() : "")) {
                    alertCountryId = 191;
                }
                if (manufCountryId == null && manufCountryCode != null && !manufCountryCode.trim().isEmpty()) {
                    manufCountryId = resolveCountryId(conn, manufCountryCode.trim());
                }
                if (manufCountryId == null) manufCountryId = alertCountryId;
                if (manufCountryId == null && "RU".equalsIgnoreCase(countryCode != null ? countryCode.trim() : "")) manufCountryId = 191;
                if (manufCountryId == null) manufCountryId = 191;

                String incId = incidentId != null ? incidentId.trim() : "";
                if (incId.isEmpty()) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "При создании обязателен регистрационный номер (incidentId в metadata).");
                    return;
                }
                long dpaid = getNextDpaid(conn);
                Integer draftStatusId = getDraftStatusId(conn, DATASOURCEKINDCODE_OUTGOING);
                if (draftStatusId == null) {
                    sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Статус «Черновик» не найден в PPVSTATUS для исходящих (DATASOURCEKINDCODE=2).");
                    return;
                }
                System.out.println("[PpvSaveServlet] Create: PPVID=" + dpaid + ", INCIDENTID=" + incId + ", PPVSTATUSID(Черновик)=" + draftStatusId);

                Integer authorityIdResolved = resolveAuthorityId(conn, authorityIdStr);

                // Вид продукции: либо код (→ SANITARYPRODTYPEID), либо наименование (→ SANITARYPRODTYPENAME)
                Integer sanitaryProdTypeId = null;
                String sanitaryProdTypeNameVal = null;
                if (sanitaryProdTypeCode != null && !sanitaryProdTypeCode.trim().isEmpty()) {
                    sanitaryProdTypeId = resolveSanitaryProdTypeId(conn, sanitaryProdTypeCode.trim());
                    sanitaryProdTypeNameVal = null;
                } else if (sanitaryProdTypeName != null && !sanitaryProdTypeName.trim().isEmpty()) {
                    sanitaryProdTypeId = null;
                    sanitaryProdTypeNameVal = sanitaryProdTypeName.trim();
                }

                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_DPA)) {
                    int i = 1;
                    ps.setLong(i++, dpaid);
                    ps.setString(i++, DATASOURCEKINDCODE_OUTGOING);
                    setIntOrNull(ps, i++, alertCountryId);
                    ps.setString(i++, incId);
                    setIntOrNull(ps, i++, authorityIdResolved);
                    ps.setString(i++, incidentAlertKindCode != null ? incidentAlertKindCode : "");
                    setDocCreationDateForDpaInsert(ps, i++, docCreationDate);
                    setIntOrNull(ps, i++, draftStatusId);
                    ps.setString(i++, commodityCode != null ? commodityCode : "");
                    setIntOrNull(ps, i++, sanitaryProdTypeId);
                    ps.setString(i++, sanitaryProdName != null ? sanitaryProdName : "");
                    setIntOrNull(ps, i++, manufCountryId);
                    ps.setString(i++, manufBusEntName != null ? manufBusEntName : "");
                    ps.setString(i++, manufBusEntBriefName != null ? manufBusEntBriefName : "");
                    setDateOrNull(ps, i++, endDate);
                    ps.setString(i++, sanitaryProdTypeNameVal != null ? sanitaryProdTypeNameVal : "");
                    ps.executeUpdate();
                }

                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_PPVXML)) {
                    ps.setLong(1, dpaid);
                    Clob clob = conn.createClob();
                    clob.setString(1, xmlBody);
                    ps.setClob(2, clob);
                    ps.setString(3, edocCode);
                    ps.setString(4, edocVersion);
                    ps.executeUpdate();
                }

                if (userId == null) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid в теле запроса (в карте прав должен быть атрибут userId)");
                    return;
                }
                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_PPVSTATUSHIST)) {
                    ps.setLong(1, dpaid);
                    ps.setInt(2, draftStatusId);
                    ps.setInt(3, userId);
                    ps.executeUpdate();
                }

                // Запись в PPVDEPPERMIS: подразделение пользователя, выполнившего сохранение (department.depid из карты прав)
                String rightsJson = (guid != null && !guid.trim().isEmpty()) ? RightsRegistryProvider.get().getRightsJson(guid.trim()) : null;
                Integer creatorDepId = getDepartmentDepIdFromRights(rightsJson);
                if (creatorDepId != null && existsDepIdInTbDep(conn, creatorDepId)) {
                    try (PreparedStatement psDep = conn.prepareStatement(SQL_INSERT_PPVDEPPERMIS)) {
                        psDep.setLong(1, dpaid);
                        psDep.setInt(2, creatorDepId);
                        psDep.executeUpdate();
                    }
                    System.out.println("[PpvSaveServlet] Created PPVDEPPERMIS: PPVID=" + dpaid + ", DEPID=" + creatorDepId);
                } else if (creatorDepId != null) {
                    System.out.println("[PpvSaveServlet] DEPID=" + creatorDepId + " not found in TB_DEP, PPVDEPPERMIS not inserted");
                } else {
                    System.out.println("[PpvSaveServlet] No department.depid in rights for guid=" + guid + ", PPVDEPPERMIS not inserted");
                }

                if (!syncPpvActors(conn, response, dpaid, metaBlock, docCreationDate)) {
                    DatabaseUtil.rollbackQuietly(conn);
                    transactionEnded = true;
                    return;
                }

                conn.commit();
                transactionEnded = true;
                response.setStatus(HttpServletResponse.SC_OK);
                response.getWriter().print("{\"success\":true,\"dpaid\":" + dpaid + "}");
                System.out.println("[PpvSaveServlet] Created PPV: PPVID=" + dpaid);
            } else {
                // Обновление: переданный в запросе dpaid и есть существующий — только UPDATE по нему
                if (dpaidParam == null || dpaidParam <= 0) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Для обновления укажите dpaid в теле запроса (как в URL).");
                    return;
                }
                long dpaid = dpaidParam;
                System.out.println("[PpvSaveServlet] Update: PPVID=" + dpaid);

                try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_PPVXML)) {
                    Clob clob = conn.createClob();
                    clob.setString(1, xmlBody);
                    ps.setClob(1, clob);
                    ps.setString(2, edocCode);
                    ps.setString(3, edocVersion);
                    ps.setLong(4, dpaid);
                    int updated = ps.executeUpdate();
                    if (updated == 0) {
                        sendJsonError(response, HttpServletResponse.SC_NOT_FOUND, "Запись с PPVID " + dpaid + " не найдена.");
                        return;
                    }
                }
                Integer authorityIdResolved = resolveAuthorityId(conn, authorityIdStr);
                Integer sanitaryProdTypeIdUpdate = null;
                String sanitaryProdTypeNameValUpdate = null;
                if (sanitaryProdTypeCode != null && !sanitaryProdTypeCode.trim().isEmpty()) {
                    sanitaryProdTypeIdUpdate = resolveSanitaryProdTypeId(conn, sanitaryProdTypeCode.trim());
                } else if (sanitaryProdTypeName != null && !sanitaryProdTypeName.trim().isEmpty()) {
                    sanitaryProdTypeNameValUpdate = sanitaryProdTypeName.trim();
                }
                try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_DPA_MODIFIED)) {
                    int idx = 1;
                    setDateOrNull(ps, idx++, endDate);
                    setIntOrNull(ps, idx++, authorityIdResolved);
                    ps.setString(idx++, manufBusEntName != null ? manufBusEntName : "");
                    ps.setString(idx++, manufBusEntBriefName != null ? manufBusEntBriefName : "");
                    ps.setString(idx++, commodityCode != null ? commodityCode : "");
                    ps.setString(idx++, sanitaryProdName != null ? sanitaryProdName : "");
                    setIntOrNull(ps, idx++, sanitaryProdTypeIdUpdate);
                    ps.setString(idx++, sanitaryProdTypeNameValUpdate != null ? sanitaryProdTypeNameValUpdate : "");
                    ps.setLong(idx++, dpaid);
                    ps.executeUpdate();
                }
                int currentStatusId = -1;
                try (PreparedStatement ps = conn.prepareStatement(SQL_SELECT_PPVSTATUSID)) {
                    ps.setLong(1, dpaid);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) currentStatusId = rs.getInt(1);
                    }
                }
                // Только устаревший статус «Отредактировано» (12) при сохранении переводим в «Новое» (6). Отправка не удалась / Ошибка обработки не меняются при сохранении — переход в «Новое» только по кнопке.
                if (currentStatusId == OUTGOING_EDITED) {
                    try (PreparedStatement ps = conn.prepareStatement("UPDATE PPV SET PPVSTATUSID = ? WHERE PPVID = ?")) {
                        ps.setInt(1, OUTGOING_NEW);
                        ps.setLong(2, dpaid);
                        ps.executeUpdate();
                    }
                    if (userId == null) {
                        sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid в теле запроса (в карте прав должен быть атрибут userId)");
                        return;
                    }
                    try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_PPVSTATUSHIST)) {
                        ps.setLong(1, dpaid);
                        ps.setInt(2, OUTGOING_NEW);
                        ps.setInt(3, userId);
                        ps.executeUpdate();
                    }
                }
                if (!syncPpvActors(conn, response, dpaid, metaBlock, docCreationDate)) {
                    DatabaseUtil.rollbackQuietly(conn);
                    transactionEnded = true;
                    return;
                }
                conn.commit();
                transactionEnded = true;
                response.setStatus(HttpServletResponse.SC_OK);
                response.getWriter().print("{\"success\":true,\"dpaid\":" + dpaid + "}");
                System.out.println("[PpvSaveServlet] Updated PPV: PPVID=" + dpaid);
            }
        } catch (SQLException e) {
            DatabaseUtil.rollbackQuietly(conn);
            transactionEnded = true;
            String errMsg = e.getMessage();
            if (errMsg != null && errMsg.contains("ORA-00001")) {
                sendJsonError(response, HttpServletResponse.SC_CONFLICT,
                    "Запись с таким регистрационным номером уже существует. Укажите другой регистрационный номер.");
                return;
            }
            errMsg = "Ошибка БД: " + (errMsg != null ? errMsg : "");
            System.err.println("[PpvSaveServlet] " + errMsg);
            e.printStackTrace();
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, errMsg);
        } finally {
            if (conn != null) {
                if (!transactionEnded) {
                    DatabaseUtil.rollbackQuietly(conn);
                }
                try {
                    conn.setAutoCommit(true);
                } catch (SQLException ignored) { }
                DatabaseUtil.closeConnection(conn);
            }
        }
    }

    @Override
    protected void doOptions(HttpServletRequest request, HttpServletResponse response) throws IOException {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        response.setStatus(HttpServletResponse.SC_NO_CONTENT);
    }

    private static String readBody(HttpServletRequest request) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (Reader r = request.getReader()) {
            char[] buf = new char[4096];
            int n;
            while ((n = r.read(buf)) >= 0) sb.append(buf, 0, n);
        }
        return sb.toString();
    }

    /** Извлекает root-level xmlBody из JSON. Берём последнее вхождение \"xmlBody\":\", чтобы не взять значение из metadata. */
    private static String extractJsonStringXmlBody(String json) {
        if (json == null) return null;
        String search = "\"xmlBody\":\"";
        int keyIdx = json.lastIndexOf(search);
        if (keyIdx < 0) return null;
        int start = keyIdx + search.length();
        if (start >= json.length()) return null;
        StringBuilder sb = new StringBuilder();
        for (int i = start; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '\\' && i + 1 < json.length()) {
                char next = json.charAt(i + 1);
                if (next == 'n') sb.append('\n');
                else if (next == 'r') sb.append('\r');
                else if (next == 't') sb.append('\t');
                else sb.append(next);
                i++;
                continue;
            }
            if (c == '"') break;
            sb.append(c);
        }
        return sb.toString();
    }

    /** Извлекает строковое значение ключа из JSON (значение в кавычках, учитывает \") */
    private static String extractJsonString(String json, String key) {
        if (json == null) return null;
        String search = "\"" + key + "\":\"";
        int keyIdx = json.indexOf(search);
        if (keyIdx < 0) return null;
        int start = keyIdx + search.length();
        StringBuilder sb = new StringBuilder();
        for (int i = start; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '\\' && i + 1 < json.length()) {
                char next = json.charAt(i + 1);
                if (next == 'n') sb.append('\n');
                else if (next == 'r') sb.append('\r');
                else if (next == 't') sb.append('\t');
                else sb.append(next);
                i++;
                continue;
            }
            if (c == '"') break;
            sb.append(c);
        }
        return sb.toString();
    }

    /** Извлекает boolean значение ключа (true/false) */
    private static boolean extractJsonBoolean(String json, String key) {
        if (json == null) return false;
        return json.contains("\"" + key + "\":true");
    }

    /** Извлекает целое значение ключа */
    private static Integer extractJsonInt(String json, String key) {
        if (json == null) return null;
        Pattern p = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(-?\\d+)");
        Matcher m = p.matcher(json);
        if (!m.find()) return null;
        try {
            return Integer.parseInt(m.group(1));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Извлекает long значение ключа (для dpaid в теле запроса) */
    private static Long extractJsonLong(String json, String key) {
        if (json == null) return null;
        Pattern p = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(-?\\d+)");
        Matcher m = p.matcher(json);
        if (!m.find()) return null;
        try {
            return Long.parseLong(m.group(1));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Извлекает вложенный объект по ключу (подстрока между { и парной }) */
    private static String extractJsonObject(String json, String key) {
        if (json == null) return null;
        String search = "\"" + key + "\":";
        int keyIdx = json.indexOf(search);
        if (keyIdx < 0) return null;
        int start = keyIdx + search.length();
        while (start < json.length() && Character.isWhitespace(json.charAt(start))) start++;
        if (start >= json.length() || json.charAt(start) != '{') return null;
        int depth = 1;
        int i = start + 1;
        while (i < json.length() && depth > 0) {
            char c = json.charAt(i);
            if (c == '"') {
                i++;
                while (i < json.length()) {
                    if (json.charAt(i) == '\\') { i += 2; continue; }
                    if (json.charAt(i) == '"') break;
                    i++;
                }
                i++;
                continue;
            }
            if (c == '{') depth++;
            else if (c == '}') depth--;
            i++;
        }
        return depth == 0 ? json.substring(start, i) : null;
    }

    /** Массив строк JSON: "key":["RU","KZ"] */
    private static List<String> extractJsonStringArray(String json, String key) {
        List<String> out = new ArrayList<>();
        if (json == null) return out;
        String pat = "\"" + key + "\"";
        int k = json.indexOf(pat);
        if (k < 0) return out;
        int brack = json.indexOf('[', k + pat.length());
        if (brack < 0) return out;
        int i = brack + 1;
        while (i < json.length()) {
            char c = json.charAt(i);
            if (Character.isWhitespace(c) || c == ',') {
                i++;
                continue;
            }
            if (c == ']') break;
            if (c == '"') {
                i++;
                StringBuilder sb = new StringBuilder();
                while (i < json.length()) {
                    char ch = json.charAt(i);
                    if (ch == '\\' && i + 1 < json.length()) {
                        sb.append(json.charAt(i + 1));
                        i += 2;
                        continue;
                    }
                    if (ch == '"') {
                        i++;
                        break;
                    }
                    sb.append(ch);
                    i++;
                }
                String s = sb.toString().trim().toUpperCase();
                if (s.length() >= 2) {
                    out.add(s.length() > 2 ? s.substring(0, 2) : s);
                }
                continue;
            }
            i++;
        }
        return out;
    }

    /** Массив целых JSON: "key":[1,2] */
    private static List<Long> extractJsonLongArray(String json, String key) {
        List<Long> out = new ArrayList<>();
        if (json == null) return out;
        String pat = "\"" + key + "\"";
        int k = json.indexOf(pat);
        if (k < 0) return out;
        int brack = json.indexOf('[', k + pat.length());
        if (brack < 0) return out;
        int i = brack + 1;
        while (i < json.length()) {
            char c = json.charAt(i);
            if (Character.isWhitespace(c) || c == ',') {
                i++;
                continue;
            }
            if (c == ']') break;
            if (c == '"') {
                i++;
                StringBuilder sb = new StringBuilder();
                while (i < json.length()) {
                    char ch = json.charAt(i);
                    if (ch == '"') {
                        i++;
                        break;
                    }
                    sb.append(ch);
                    i++;
                }
                try {
                    long v = Long.parseLong(sb.toString().trim());
                    if (v > 0) out.add(v);
                } catch (NumberFormatException ignored) { }
                continue;
            }
            if (c == '-' || Character.isDigit(c)) {
                int start = i;
                i++;
                while (i < json.length()) {
                    char ch = json.charAt(i);
                    if (Character.isDigit(ch)) {
                        i++;
                        continue;
                    }
                    break;
                }
                try {
                    long v = Long.parseLong(json.substring(start, i).trim());
                    if (v > 0) out.add(v);
                } catch (NumberFormatException ignored) { }
                continue;
            }
            i++;
        }
        return out;
    }

    private static void setIntOrNull(PreparedStatement ps, int index, Integer value) throws SQLException {
        if (value != null) ps.setInt(index, value);
        else ps.setNull(index, Types.INTEGER);
    }

    private static void setDateOrNull(PreparedStatement ps, int index, String dateStr) throws SQLException {
        if (dateStr == null || dateStr.trim().isEmpty()) {
            ps.setNull(index, Types.TIMESTAMP);
            return;
        }
        try {
            java.sql.Date d = java.sql.Date.valueOf(dateStr.trim());
            ps.setTimestamp(index, new Timestamp(d.getTime()));
        } catch (Exception e) {
            ps.setNull(index, Types.TIMESTAMP);
        }
    }

    /**
     * DOCCREATIONDATE в таблице PPV — NOT NULL: при отсутствии или невалидной дате в metadata подставляем текущую дату.
     */
    private static void setDocCreationDateForDpaInsert(PreparedStatement ps, int index, String dateStr) throws SQLException {
        if (dateStr == null || dateStr.trim().isEmpty()) {
            java.sql.Date d = new java.sql.Date(System.currentTimeMillis());
            ps.setTimestamp(index, new Timestamp(d.getTime()));
            return;
        }
        try {
            java.sql.Date d = java.sql.Date.valueOf(dateStr.trim());
            ps.setTimestamp(index, new Timestamp(d.getTime()));
        } catch (Exception e) {
            java.sql.Date d = new java.sql.Date(System.currentTimeMillis());
            ps.setTimestamp(index, new Timestamp(d.getTime()));
        }
    }

    private long getNextDpaid(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_NEXT_DPAID);
             ResultSet rs = ps.executeQuery()) {
            if (rs.next()) return rs.getLong(1);
        } catch (SQLException e) {
            System.out.println("[PpvSaveServlet] Sequence not available, using MAX+1: " + e.getMessage());
            try (PreparedStatement ps = conn.prepareStatement(SQL_NEXT_DPAID_FALLBACK);
                 ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getLong(1);
            }
        }
        throw new SQLException("Не удалось получить следующий PPVID");
    }

    private Integer getDraftStatusId(Connection conn, String datasourceKindCode) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_STATUS_DRAFT)) {
            ps.setString(1, datasourceKindCode);
            try (ResultSet rs = ps.executeQuery()) {
                // SQL_STATUS_DRAFT выбирает PPVSTATUSID из справочника PPVSTATUS.
                if (rs.next()) return rs.getInt("PPVSTATUSID");
            }
        }
        return null;
    }

    private Integer resolveCountryId(Connection conn, String countryCode) throws SQLException {
        if (countryCode == null || countryCode.isEmpty()) return null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_COUNTRY_ID)) {
            ps.setString(1, countryCode.toUpperCase());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt("COUNTRYID");
            }
        }
        return null;
    }

    /**
     * Разрешает идентификатор УО из metadata (UID из справочника) в AUTHORITYID для PPV.
     * Ищет только по AUTHORITYUID в AUTHORITY, чтобы не нарушать PPV_FK7 (parent key must exist).
     */
    private Integer resolveAuthorityId(Connection conn, String authorityIdStr) throws SQLException {
        if (authorityIdStr == null || authorityIdStr.trim().isEmpty()) return null;
        String trimmed = authorityIdStr.trim();
        try (PreparedStatement ps = conn.prepareStatement(SQL_AUTHORITY_ID_BY_UID)) {
            ps.setString(1, trimmed);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt("AUTHORITYID");
            }
        }
        return null;
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        String escaped = message != null ? message.replace("\\", "\\\\").replace("\"", "\\\"") : "Unknown error";
        response.getWriter().print("{\"error\":\"" + escaped + "\"}");
    }

    /**
     * Создание новой версии карты (копия из карты в статусе Доставлено).
     * Все INSERT выполняются в транзакции вызывающего {@code doPost} (без commit); при успехе возвращает новый PPVID.
     */
    private Long handleNewVersionCopy(Connection conn, HttpServletResponse response, HttpServletRequest request,
                                      long sourceDpaid, String guid, String xmlBody, String body) throws IOException, SQLException {
        String metaBlock = extractJsonObject(body, "metadata");
        if (metaBlock == null) metaBlock = "{}";
        String docCreationDate = extractJsonString(metaBlock, "docCreationDate");
        String incidentAlertKindCode = extractJsonString(metaBlock, "incidentAlertKindCode");
        String edocCode = extractJsonString(metaBlock, "edocCode");
        String edocVersion = extractJsonString(metaBlock, "edocVersion");
        if (edocCode == null || edocCode.isEmpty()) edocCode = EDOCCODE_DEFAULT;
        if (edocVersion == null || edocVersion.isEmpty()) edocVersion = EDOCVERSION_DEFAULT;

        try (PreparedStatement ps = conn.prepareStatement(SQL_SOURCE_DPA_FOR_COPY)) {
            ps.setLong(1, sourceDpaid);
            ps.setString(2, DATASOURCEKINDCODE_OUTGOING);
            ps.setInt(3, OUTGOING_DELIVERED);
            ResultSet rs = ps.executeQuery();
            if (!rs.next()) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Исходная карта не найдена или не подходит для создания новой версии (исходящая, статус «Доставлено», дата закрытия не указана).");
                return null;
            }
            String incidentId = rs.getString("INCIDENTID");
            Integer alertCountryId = getIntObject(rs, "ALERTCOUNTRYID");
            Integer authorityId = getIntObject(rs, "AUTHORITYID");
            String sourceIncidentAlertKindCode = rs.getString("INCIDENTALERTKINDCODE");
            if (sourceIncidentAlertKindCode != null) {
                sourceIncidentAlertKindCode = sourceIncidentAlertKindCode.trim();
            }
            String commodityCode = rs.getString("COMMODITYCODE");
            Integer sanitaryProdTypeId = getIntObject(rs, "SANITARYPRODTYPEID");
            String sanitaryProdName = rs.getString("SANITARYPRODNAME");
            Integer manufCountryId = getIntObject(rs, "MANUFCOUNTRYID");
            String manufBusEntName = rs.getString("MANUFBUSENTNAME");
            String manufBusEntBriefName = rs.getString("MANUFBUSENTBRIEFNAME");
            String sanitaryProdTypeName = rs.getString("SANITARYPRODTYPENAME");
            rs.close();

            java.util.Set<String> cardDepIds = new java.util.HashSet<>();
            try (PreparedStatement ps2 = conn.prepareStatement(SQL_DEPS_FOR_COPY)) {
                ps2.setLong(1, sourceDpaid);
                ResultSet rs2 = ps2.executeQuery();
                while (rs2.next()) {
                    String depId = rs2.getString(1);
                    if (depId != null && !depId.trim().isEmpty()) cardDepIds.add(depId.trim());
                }
            }
            String rightsJson = (guid != null && !guid.trim().isEmpty())
                    ? RightsRegistryProvider.get().getRightsJson(guid.trim())
                    : null;
            // Проверка права edit — пропускаем при вызове по command=copy (без проверки прав)
            boolean commandInvoke = Boolean.TRUE.equals(request.getAttribute("com.eec.command.invoke"));
            if (!commandInvoke) {
                if (cardDepIds.isEmpty()) {
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет доступа к исходной карте.");
                    return null;
                }
                if (rightsJson == null || rightsJson.isEmpty()) {
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Права по GUID не найдены.");
                    return null;
                }
                java.util.Set<String> userEditDepIds = parseEditDepIdsFromRights(rightsJson);
                boolean hasEdit = false;
                for (String depId : userEditDepIds) {
                    if (cardDepIds.contains(depId)) { hasEdit = true; break; }
                }
                if (!hasEdit) {
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                        "Нет права на редактирование исходящих сведений в пределах ни одного подразделения, имеющего доступ к данной карте.");
                    return null;
                }
            }

            long newDpaid = getNextDpaid(conn);
            Integer draftStatusId = getDraftStatusId(conn, DATASOURCEKINDCODE_OUTGOING);
            if (draftStatusId == null) {
                sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Статус «Черновик» не найден в PPVSTATUS.");
                return null;
            }

            // metadata из API (command=copy) может быть пустым; пустая строка в Oracle VARCHAR2 даёт NULL — колонка NOT NULL
            String effectiveIncidentAlertKind = (incidentAlertKindCode != null && !incidentAlertKindCode.trim().isEmpty())
                    ? incidentAlertKindCode.trim()
                    : sourceIncidentAlertKindCode;
            if (effectiveIncidentAlertKind == null || effectiveIncidentAlertKind.isEmpty()) {
                effectiveIncidentAlertKind = " ";
            }

            String sqlInsertDpaCopy = ""
                + "INSERT INTO PPV (PPVID, DATASOURCEKINDCODE, ALERTCOUNTRYID, INCIDENTID, AUTHORITYID, "
                + "INCIDENTALERTKINDCODE, DOCCREATIONDATE, PPVSTATUSID, COMMODITYCODE, SANITARYPRODTYPEID, SANITARYPRODNAME, "
                + "MANUFCOUNTRYID, MANUFBUSENTNAME, MANUFBUSENTBRIEFNAME, ENDDATE, CREATIONDATETIME, MODIFICATIONDATETIME, SANITARYPRODTYPENAME) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, SYSDATE, SYSDATE, ?)";
            try (PreparedStatement ps2 = conn.prepareStatement(sqlInsertDpaCopy)) {
                int i = 1;
                ps2.setLong(i++, newDpaid);
                ps2.setString(i++, DATASOURCEKINDCODE_OUTGOING);
                setIntOrNull(ps2, i++, alertCountryId);
                ps2.setString(i++, incidentId != null ? incidentId : "");
                setIntOrNull(ps2, i++, authorityId);
                ps2.setString(i++, effectiveIncidentAlertKind);
                setDocCreationDateForDpaInsert(ps2, i++, docCreationDate);
                ps2.setInt(i++, draftStatusId);
                ps2.setString(i++, commodityCode != null ? commodityCode : "");
                setIntOrNull(ps2, i++, sanitaryProdTypeId);
                ps2.setString(i++, sanitaryProdName != null ? sanitaryProdName : "");
                setIntOrNull(ps2, i++, manufCountryId);
                ps2.setString(i++, manufBusEntName);
                ps2.setString(i++, manufBusEntBriefName);
                ps2.setString(i++, sanitaryProdTypeName != null ? sanitaryProdTypeName : "");
                ps2.executeUpdate();
            }

            try (PreparedStatement ps2 = conn.prepareStatement(SQL_INSERT_PPVXML)) {
                ps2.setLong(1, newDpaid);
                Clob clob = conn.createClob();
                clob.setString(1, xmlBody);
                ps2.setClob(2, clob);
                ps2.setString(3, edocCode);
                ps2.setString(4, edocVersion);
                ps2.executeUpdate();
            }

            Integer copyUserId = getUserIdFromRights(rightsJson);
            if (copyUserId == null) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "В карте прав доступа укажите атрибут userId");
                return null;
            }
            try (PreparedStatement ps2 = conn.prepareStatement(SQL_INSERT_PPVSTATUSHIST)) {
                ps2.setLong(1, newDpaid);
                ps2.setInt(2, draftStatusId);
                ps2.setInt(3, copyUserId);
                ps2.executeUpdate();
            }

            // Доступ к новой версии: только подразделение пользователя, выполнившего сохранение (не копировать список с исходной карты)
            Integer creatorDepId = getDepartmentDepIdFromRights(rightsJson);
            if (creatorDepId != null && existsDepIdInTbDep(conn, creatorDepId)) {
                try (PreparedStatement psDep = conn.prepareStatement(SQL_INSERT_PPVDEPPERMIS)) {
                    psDep.setLong(1, newDpaid);
                    psDep.setInt(2, creatorDepId);
                    psDep.executeUpdate();
                }
                System.out.println("[PpvSaveServlet] New version PPVDEPPERMIS (creator only): PPVID=" + newDpaid + ", DEPID=" + creatorDepId);
            } else if (creatorDepId != null) {
                System.out.println("[PpvSaveServlet] New version: DEPID=" + creatorDepId + " not found in TB_DEP, PPVDEPPERMIS not inserted");
            } else {
                System.out.println("[PpvSaveServlet] New version: No department.depid in rights for guid=" + guid + ", PPVDEPPERMIS not inserted");
            }

            if (!syncPpvActors(conn, response, newDpaid, metaBlock, docCreationDate)) {
                return null;
            }

            return Long.valueOf(newDpaid);
        }
    }

    private static java.util.Set<String> parseEditDepIdsFromRights(String json) {
        java.util.Set<String> out = new java.util.HashSet<>();
        int outStart = json.indexOf("\"violationDetectedOut\"");
        if (outStart < 0) return out;
        int editStart = json.indexOf("\"edit\"", outStart);
        if (editStart < 0) return out;
        int braceStart = json.indexOf('{', editStart);
        if (braceStart < 0) return out;
        int depth = 1;
        int i = braceStart + 1;
        while (i < json.length() && depth > 0) {
            char c = json.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') depth--;
            i++;
        }
        String editBlock = depth == 0 ? json.substring(braceStart, i) : "";
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(editBlock);
        while (keyM.find()) out.add(keyM.group(1).trim());
        return out;
    }

    /** USERID из карты прав (атрибут userId) по guid. */
    private static Integer getUserIdFromRightsByGuid(String guid) {
        if (guid == null || guid.isEmpty()) return null;
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) return null;
        return getUserIdFromRights(rightsJson);
    }

    /** Извлекает userId из JSON прав: "userId": 1 или "userId": "1". */
    private static Integer getUserIdFromRights(String json) {
        if (json == null) return null;
        Matcher m = Pattern.compile("\"userId\"\\s*:\\s*(-?\\d+)").matcher(json);
        if (m.find()) {
            try { return Integer.parseInt(m.group(1)); } catch (NumberFormatException e) { return null; }
        }
        m = Pattern.compile("\"userId\"\\s*:\\s*\"(-?\\d+)\"").matcher(json);
        if (m.find()) {
            try { return Integer.parseInt(m.group(1)); } catch (NumberFormatException e) { return null; }
        }
        return null;
    }

    private static Integer getDepartmentDepIdFromRights(String json) {
        Pattern p = Pattern.compile("\"depid\"\\s*:\\s*(\\d+)");
        Matcher m = p.matcher(json);
        if (!m.find()) return null;
        try {
            return Integer.parseInt(m.group(1));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Проверяет, что подразделение с данным DEPID есть в TB_DEP (родительская таблица для FK PPVDEPPERMIS_FK2).
     * Поддерживает DEPID как NUMBER и как VARCHAR2.
     */
    private static boolean existsDepIdInTbDep(Connection conn, int depId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_EXISTS_DEP)) {
            ps.setString(1, String.valueOf(depId));
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    /** SANITARYPRODTYPEID по коду вида продукции (SANITARYPRODTYPECODE). */
    private static Integer resolveSanitaryProdTypeId(Connection conn, String code) throws SQLException {
        if (code == null || code.trim().isEmpty()) return null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_SANITARYPRODTYPE_ID_BY_CODE)) {
            ps.setString(1, code.trim());
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getInt("SANITARYPRODTYPEID") : null;
            }
        }
    }

    /** Безопасно читает NUMBER/INTEGER колонку Oracle как Integer (в т.ч. когда драйвер возвращает BigDecimal). */
    private static Integer getIntObject(ResultSet rs, String column) throws SQLException {
        Object v = rs.getObject(column);
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).intValue();
        try {
            return Integer.parseInt(String.valueOf(v));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static java.sql.Date resolveDocDateForPpvActor(String docCreationDate) {
        if (docCreationDate != null) {
            String t = docCreationDate.trim();
            if (t.length() >= 10 && t.charAt(4) == '-' && t.charAt(7) == '-') {
                try {
                    return java.sql.Date.valueOf(t.substring(0, 10));
                } catch (Exception ignored) { }
            }
        }
        return new java.sql.Date(System.currentTimeMillis());
    }

    private static boolean isValidPpvActorCountry(Connection conn, String countryUpper2, java.sql.Date refDate)
            throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_VALIDATE_PPV_ACTOR_COUNTRY)) {
            ps.setString(1, countryUpper2);
            ps.setDate(2, refDate);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static long getNextPpvActorId(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_NEXT_PPVACTORID);
             ResultSet rs = ps.executeQuery()) {
            if (rs.next()) return rs.getLong(1);
        }
        throw new SQLException("Не удалось получить PPVACTORID");
    }

    private static void insertPpvActorRow(Connection conn, long ppvid, String countryCodeUpper2) throws SQLException {
        long id = getNextPpvActorId(conn);
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_PPVACTOR)) {
            ps.setLong(1, id);
            ps.setLong(2, ppvid);
            ps.setString(3, countryCodeUpper2);
            ps.setString(4, PPV_ACTOR_CODE);
            ps.executeUpdate();
        }
    }

    /**
     * PPVACTOR: metadata.ppvActorRemovalIds — DELETE строк без EDOCID (ответа нет);
     * metadata.ppvActorCountryCodes — INSERT новых адресатов, если ещё нет актуальной строки по паре (PPVID, ACTORCODE, страна).
     */
    private boolean syncPpvActors(Connection conn, HttpServletResponse response, long ppvid, String metaBlock,
                                    String docCreationDate) throws SQLException, IOException {
        boolean hasAppend = metaBlock != null && metaBlock.contains("\"ppvActorCountryCodes\"");
        boolean hasRemove = metaBlock != null && metaBlock.contains("\"ppvActorRemovalIds\"");
        if (!hasAppend && !hasRemove) {
            return true;
        }
        if (hasRemove) {
            List<Long> rawIds = extractJsonLongArray(metaBlock, "ppvActorRemovalIds");
            Set<Long> removalIds = new LinkedHashSet<>(rawIds);
            for (Long actorId : removalIds) {
                if (actorId == null || actorId <= 0) continue;
                int n = deletePpvActorNoEdoc(conn, ppvid, actorId);
                if (n == 0) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                            "Удаление адресата не выполнено для PPVACTORID=" + actorId
                                    + ": запись не найдена, не относится к карте или есть EDOCID (ответ).");
                    return false;
                }
            }
        }
        if (!hasAppend) {
            return true;
        }
        List<String> raw = extractJsonStringArray(metaBlock, "ppvActorCountryCodes");
        Set<String> toAppend = new LinkedHashSet<>();
        for (String c : raw) {
            if (c == null) continue;
            String u = c.trim().toUpperCase();
            if (u.length() == 2) toAppend.add(u);
        }
        java.sql.Date refDate = resolveDocDateForPpvActor(docCreationDate != null ? docCreationDate : "");
        for (String cc : toAppend) {
            if (!isValidPpvActorCountry(conn, cc, refDate)) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Недопустимый код страны адресата: " + cc + " (ЕАЭС, не BY, дата в диапазоне справочника COUNTRY).");
                return false;
            }
        }
        for (String countryUpper : toAppend) {
            if (existsActivePpvActor(conn, ppvid, countryUpper)) {
                continue;
            }
            insertPpvActorRow(conn, ppvid, countryUpper);
        }
        return true;
    }

    private static int deletePpvActorNoEdoc(Connection conn, long ppvid, long ppvActorId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_DELETE_PPVACTOR_NO_EDOC)) {
            ps.setLong(1, ppvActorId);
            ps.setLong(2, ppvid);
            ps.setString(3, PPV_ACTOR_CODE);
            return ps.executeUpdate();
        }
    }

    private static boolean existsActivePpvActor(Connection conn, long ppvid, String countryUpper2) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_EXIST_ACTIVE_PPVACTOR)) {
            ps.setLong(1, ppvid);
            ps.setString(2, PPV_ACTOR_CODE);
            ps.setString(3, countryUpper2);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }
}
