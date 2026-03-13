package com.eec.servlet;

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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Создание или обновление карты.
 * POST /api/dpa/save — тело JSON:
 * - Создание: { "isNew": true, "xmlBody": "...", "metadata": { ... } } — INSERT в DPA и DPAXML (версия 1, уникальный регистрационный номер из метаданных). При конфликте уникальности — сообщение.
 * - Обновление: { "isNew": false, "dpaid": <number>, "xmlBody": "...", "metadata": { ... } } — UPDATE DPAXML и MODIFICATIONDATETIME по DPAID.
 */
public class DpaSaveServlet extends HttpServlet {

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[DpaSaveServlet] Initialized (POST /api/dpa/save)");
    }

    /** Код типа источника для исходящих карт: в DPA и в DPASTATUS хранится 2 (код 3 — из БД ЕЭК) */
    private static final String DATASOURCEKINDCODE_OUTGOING = "2";
    private static final String EDOCCODE_DEFAULT = "R.SM.SS.08.002";
    private static final String EDOCVERSION_DEFAULT = "1.0.0";

    /** Получить следующий DPAID (последовательность sqdpa или fallback) */
    private static final String SQL_NEXT_DPAID = "SELECT SESINT.SQDPA.NEXTVAL FROM DUAL";
    private static final String SQL_NEXT_DPAID_FALLBACK = "SELECT NVL(MAX(DPAID),0)+1 AS NEXTVAL FROM SESINT.DPA";

    /** DPASTATUSID по названию «Черновик» для исходящих (в DPASTATUS у них DATASOURCEKINDCODE = 2) */
    private static final String SQL_STATUS_DRAFT = "SELECT DPASTATUSID FROM SESINT.DPASTATUS WHERE TRIM(DPASTATUSNAME) = 'Черновик' AND DATASOURCEKINDCODE = ?";

    /** COUNTRYID по коду страны (COUNTRYCODE) */
    private static final String SQL_COUNTRY_ID = "SELECT COUNTRYID FROM SESINT.COUNTRY WHERE UPPER(TRIM(COUNTRYCODE)) = ? AND COUNTRYSDATE <= SYSDATE AND COUNTRYEDATE >= SYSDATE";
    /** AUTHORITYID по AUTHORITYUID (или по числовому идентификатору из metadata) */
    private static final String SQL_AUTHORITY_ID_BY_UID = "SELECT AUTHORITYID FROM SESINT.AUTHORITY WHERE TRIM(AUTHORITYUID) = ?";
    /** SANITARYPRODTYPEID по коду вида продукции (для DPA при выборе по коду) */
    private static final String SQL_SANITARYPRODTYPE_ID_BY_CODE = "SELECT SANITARYPRODTYPEID FROM SESINT.SANITARYPRODTYPE WHERE TRIM(SANITARYPRODTYPECODE) = ? AND ROWNUM = 1";

    /** INSERT DPA (всегда версия 1 при создании) */
    private static final String SQL_INSERT_DPA = ""
            + "INSERT INTO SESINT.DPA (DPAID, DATASOURCEKINDCODE, ALERTCOUNTRYID, INCIDENTID, DPAVERSION, AUTHORITYID, "
            + "INCIDENTALERTKINDCODE, DOCCREATIONDATE, DPASTATUSID, COMMODITYCODE, SANITARYPRODTYPEID, SANITARYPRODNAME, "
            + "MANUFCOUNTRYID, MANUFBUSENTNAME, MANUFBUSENTBRIEFNAME, ENDDATE, CREATIONDATETIME, MODIFICATIONDATETIME, SANITARYPRODTYPENAME) "
            + "VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, SYSDATE, NULL, ?)";

    /** INSERT DPAXML */
    private static final String SQL_INSERT_DPAXML = "INSERT INTO SESINT.DPAXML (DPAID, DPAXMLBODY, EDOCCODE, EDOCVERSION) VALUES (?, ?, ?, ?)";

    /** INSERT в историю смены статусов — присвоение статуса «Черновик» при создании карты */
    private static final String SQL_INSERT_DPASTATUSHIST = "INSERT INTO SESINT.DPASTATUSHIST (DPAID, DPASTATUSID, DPASTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, ?)";

    /** UPDATE DPAXML при обновлении существующей карты */
    private static final String SQL_UPDATE_DPAXML = "UPDATE SESINT.DPAXML SET DPAXMLBODY = ?, EDOCCODE = ?, EDOCVERSION = ? WHERE DPAID = ?";

    /** Обновить MODIFICATIONDATETIME, ENDDATE, AUTHORITYID, производителя, код ТН ВЭД и вид/наименование продукции в DPA при обновлении */
    private static final String SQL_UPDATE_DPA_MODIFIED = "UPDATE SESINT.DPA SET MODIFICATIONDATETIME = SYSDATE, ENDDATE = ?, AUTHORITYID = ?, MANUFBUSENTNAME = ?, MANUFBUSENTBRIEFNAME = ?, COMMODITYCODE = ?, SANITARYPRODNAME = ?, SANITARYPRODTYPEID = ?, SANITARYPRODTYPENAME = ? WHERE DPAID = ?";
    /** Текущий DPASTATUSID карты (при сохранении: только Отредактировано (12) → переход в «Новое»; остальные статусы не меняются) */
    private static final String SQL_SELECT_DPASTATUSID = "SELECT DPASTATUSID FROM SESINT.DPA WHERE DPAID = ?";
    private static final int OUTGOING_NEW = 6, OUTGOING_FAILED = 9, OUTGOING_ERROR = 10, OUTGOING_EDITED = 12;
    private static final int OUTGOING_DELIVERED = 11;

    /** Исходная карта для новой версии (все поля DPA для копирования) */
    private static final String SQL_SOURCE_DPA_FOR_COPY = ""
            + "SELECT INCIDENTID, DPAVERSION, ALERTCOUNTRYID, AUTHORITYID, INCIDENTALERTKINDCODE, COMMODITYCODE, "
            + "SANITARYPRODTYPEID, SANITARYPRODNAME, MANUFCOUNTRYID, MANUFBUSENTNAME, MANUFBUSENTBRIEFNAME, SANITARYPRODTYPENAME "
            + "FROM SESINT.DPA WHERE DPAID = ? AND DATASOURCEKINDCODE = ? AND DPASTATUSID = ? AND ENDDATE IS NULL";
    private static final String SQL_MAX_VERSION_BY_INCIDENT = "SELECT NVL(MAX(DPAVERSION), 0) FROM SESINT.DPA WHERE INCIDENTID = ? AND ALERTCOUNTRYID = ?";
    private static final String SQL_INSERT_DPADEPPERMIS = "INSERT INTO SESINT.DPADEPPERMIS (DPAID, DEPID, GRANTDATETIME) VALUES (?, ?, SYSDATE)";
    private static final String SQL_DEPS_FOR_COPY = "SELECT DEPID FROM SESINT.DPADEPPERMIS WHERE DPAID = ?";
    /** Проверка существования подразделения (FK DPADEPPERMIS_FK2 → родительская таблица, обычно SESDEV.TB_DEP) */
    private static final String SQL_EXISTS_DEP = "SELECT 1 FROM SESDEV.TB_DEP WHERE DEPID = ?";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        System.out.println("[DpaSaveServlet] doPost called");
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");

        // Обязательно UTF-8: иначе кириллица в xmlBody искажается при записи в CLOB (DPAXML)
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
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            conn.setAutoCommit(false);

            if (isNew) {
                if (copyFromDpaid != null && copyFromDpaid > 0 && guid != null && !guid.trim().isEmpty()) {
                    handleNewVersionCopy(conn, response, copyFromDpaid, guid.trim(), xmlBody, body);
                    return;
                }
                // Создание: INSERT, версия 1. Регистрационный номер из metadata (incidentId). Поиск существующей записи не делаем.
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
                        "Статус «Черновик» не найден в DPASTATUS для исходящих (DATASOURCEKINDCODE=2).");
                    return;
                }
                System.out.println("[DpaSaveServlet] Create: DPAID=" + dpaid + ", INCIDENTID=" + incId + ", DPASTATUSID(Черновик)=" + draftStatusId);

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
                    setDateOrNull(ps, i++, docCreationDate);
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

                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_DPAXML)) {
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
                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_DPASTATUSHIST)) {
                    ps.setLong(1, dpaid);
                    ps.setInt(2, draftStatusId);
                    ps.setInt(3, userId);
                    ps.executeUpdate();
                }

                // Запись в DPADEPPERMIS: подразделение пользователя, выполнившего сохранение (department.depid из карты прав)
                String rightsJson = (guid != null && !guid.trim().isEmpty()) ? RightsJsonStore.guidMap.get(guid.trim()) : null;
                Integer creatorDepId = getDepartmentDepIdFromRights(rightsJson);
                if (creatorDepId != null && existsDepIdInTbDep(conn, creatorDepId)) {
                    try (PreparedStatement psDep = conn.prepareStatement(SQL_INSERT_DPADEPPERMIS)) {
                        psDep.setLong(1, dpaid);
                        psDep.setInt(2, creatorDepId);
                        psDep.executeUpdate();
                    }
                    System.out.println("[DpaSaveServlet] Created DPADEPPERMIS: DPAID=" + dpaid + ", DEPID=" + creatorDepId);
                } else if (creatorDepId != null) {
                    System.out.println("[DpaSaveServlet] DEPID=" + creatorDepId + " not found in SESDEV.TB_DEP, DPADEPPERMIS not inserted");
                } else {
                    System.out.println("[DpaSaveServlet] No department.depid in rights for guid=" + guid + ", DPADEPPERMIS not inserted");
                }

                conn.commit();
                response.setStatus(HttpServletResponse.SC_OK);
                response.getWriter().print("{\"success\":true,\"dpaid\":" + dpaid + "}");
                System.out.println("[DpaSaveServlet] Created DPA: DPAID=" + dpaid);
            } else {
                // Обновление: переданный в запросе dpaid и есть существующий — только UPDATE по нему
                if (dpaidParam == null || dpaidParam <= 0) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Для обновления укажите dpaid в теле запроса (как в URL).");
                    return;
                }
                long dpaid = dpaidParam;
                System.out.println("[DpaSaveServlet] Update: DPAID=" + dpaid);

                try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_DPAXML)) {
                    Clob clob = conn.createClob();
                    clob.setString(1, xmlBody);
                    ps.setClob(1, clob);
                    ps.setString(2, edocCode);
                    ps.setString(3, edocVersion);
                    ps.setLong(4, dpaid);
                    int updated = ps.executeUpdate();
                    if (updated == 0) {
                        sendJsonError(response, HttpServletResponse.SC_NOT_FOUND, "Запись с DPAID " + dpaid + " не найдена.");
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
                try (PreparedStatement ps = conn.prepareStatement(SQL_SELECT_DPASTATUSID)) {
                    ps.setLong(1, dpaid);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) currentStatusId = rs.getInt(1);
                    }
                }
                // Только устаревший статус «Отредактировано» (12) при сохранении переводим в «Новое» (6). Отправка не удалась / Ошибка обработки не меняются при сохранении — переход в «Новое» только по кнопке.
                if (currentStatusId == OUTGOING_EDITED) {
                    try (PreparedStatement ps = conn.prepareStatement("UPDATE SESINT.DPA SET DPASTATUSID = ? WHERE DPAID = ?")) {
                        ps.setInt(1, OUTGOING_NEW);
                        ps.setLong(2, dpaid);
                        ps.executeUpdate();
                    }
                    if (userId == null) {
                        sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid в теле запроса (в карте прав должен быть атрибут userId)");
                        return;
                    }
                    try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_DPASTATUSHIST)) {
                        ps.setLong(1, dpaid);
                        ps.setInt(2, OUTGOING_NEW);
                        ps.setInt(3, userId);
                        ps.executeUpdate();
                    }
                }
                conn.commit();
                response.setStatus(HttpServletResponse.SC_OK);
                response.getWriter().print("{\"success\":true,\"dpaid\":" + dpaid + "}");
                System.out.println("[DpaSaveServlet] Updated DPA: DPAID=" + dpaid);
            }
        } catch (SQLException e) {
            if (conn != null) {
                try { conn.rollback(); } catch (SQLException ignored) { }
            }
            String errMsg = e.getMessage();
            if (errMsg != null && errMsg.contains("ORA-00001")) {
                sendJsonError(response, HttpServletResponse.SC_CONFLICT,
                    "Запись с таким регистрационным номером уже существует. Укажите другой регистрационный номер.");
                return;
            }
            errMsg = "Ошибка БД: " + (errMsg != null ? errMsg : "");
            System.err.println("[DpaSaveServlet] " + errMsg);
            e.printStackTrace();
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, errMsg);
        } finally {
            if (conn != null) {
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

    private long getNextDpaid(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_NEXT_DPAID);
             ResultSet rs = ps.executeQuery()) {
            if (rs.next()) return rs.getLong(1);
        } catch (SQLException e) {
            System.out.println("[DpaSaveServlet] Sequence not available, using MAX+1: " + e.getMessage());
            try (PreparedStatement ps = conn.prepareStatement(SQL_NEXT_DPAID_FALLBACK);
                 ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getLong(1);
            }
        }
        throw new SQLException("Не удалось получить следующий DPAID");
    }

    private Integer getDraftStatusId(Connection conn, String datasourceKindCode) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_STATUS_DRAFT)) {
            ps.setString(1, datasourceKindCode);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt("DPASTATUSID");
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
     * Разрешает идентификатор УО из metadata (UID из справочника) в AUTHORITYID для DPA.
     * Ищет только по AUTHORITYUID в SESINT.AUTHORITY, чтобы не нарушать DPA_FK7 (parent key must exist).
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

    /** Создание новой версии карты (копия из карты в статусе Доставлено). */
    private void handleNewVersionCopy(Connection conn, HttpServletResponse response,
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
                return;
            }
            String incidentId = rs.getString("INCIDENTID");
            int sourceVersion = rs.getInt("DPAVERSION");
            Integer alertCountryId = (Integer) rs.getObject("ALERTCOUNTRYID");
            Integer authorityId = (Integer) rs.getObject("AUTHORITYID");
            String commodityCode = rs.getString("COMMODITYCODE");
            Integer sanitaryProdTypeId = (Integer) rs.getObject("SANITARYPRODTYPEID");
            String sanitaryProdName = rs.getString("SANITARYPRODNAME");
            Integer manufCountryId = (Integer) rs.getObject("MANUFCOUNTRYID");
            String manufBusEntName = rs.getString("MANUFBUSENTNAME");
            String manufBusEntBriefName = rs.getString("MANUFBUSENTBRIEFNAME");
            String sanitaryProdTypeName = rs.getString("SANITARYPRODTYPENAME");
            rs.close();

            int maxVersion = 0;
            try (PreparedStatement ps2 = conn.prepareStatement(SQL_MAX_VERSION_BY_INCIDENT)) {
                ps2.setString(1, incidentId != null ? incidentId : "");
                ps2.setObject(2, alertCountryId);
                ResultSet rs2 = ps2.executeQuery();
                if (rs2.next()) maxVersion = rs2.getInt(1);
            }
            if (sourceVersion < maxVersion) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Создание новой версии доступно только для карты с максимальной версией по данному регистрационному номеру.");
                return;
            }

            java.util.Set<String> cardDepIds = new java.util.HashSet<>();
            try (PreparedStatement ps2 = conn.prepareStatement(SQL_DEPS_FOR_COPY)) {
                ps2.setLong(1, sourceDpaid);
                ResultSet rs2 = ps2.executeQuery();
                while (rs2.next()) {
                    String depId = rs2.getString(1);
                    if (depId != null && !depId.trim().isEmpty()) cardDepIds.add(depId.trim());
                }
            }
            if (cardDepIds.isEmpty()) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет доступа к исходной карте.");
                return;
            }

            String rightsJson = RightsJsonStore.guidMap.get(guid);
            if (rightsJson == null || rightsJson.isEmpty()) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Права по GUID не найдены.");
                return;
            }
            java.util.Set<String> userEditDepIds = parseEditDepIdsFromRights(rightsJson);
            boolean hasEdit = false;
            for (String depId : userEditDepIds) {
                if (cardDepIds.contains(depId)) { hasEdit = true; break; }
            }
            if (!hasEdit) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                    "Нет права на редактирование исходящих сведений в пределах ни одного подразделения, имеющего доступ к данной карте.");
                return;
            }

            long newDpaid = getNextDpaid(conn);
            Integer draftStatusId = getDraftStatusId(conn, DATASOURCEKINDCODE_OUTGOING);
            if (draftStatusId == null) {
                sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Статус «Черновик» не найден в DPASTATUS.");
                return;
            }

            String sqlInsertDpaCopy = ""
                + "INSERT INTO SESINT.DPA (DPAID, DATASOURCEKINDCODE, ALERTCOUNTRYID, INCIDENTID, DPAVERSION, AUTHORITYID, "
                + "INCIDENTALERTKINDCODE, DOCCREATIONDATE, DPASTATUSID, COMMODITYCODE, SANITARYPRODTYPEID, SANITARYPRODNAME, "
                + "MANUFCOUNTRYID, MANUFBUSENTNAME, MANUFBUSENTBRIEFNAME, ENDDATE, CREATIONDATETIME, MODIFICATIONDATETIME, SANITARYPRODTYPENAME) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, SYSDATE, SYSDATE, ?)";
            try (PreparedStatement ps2 = conn.prepareStatement(sqlInsertDpaCopy)) {
                int i = 1;
                ps2.setLong(i++, newDpaid);
                ps2.setString(i++, DATASOURCEKINDCODE_OUTGOING);
                setIntOrNull(ps2, i++, alertCountryId);
                ps2.setString(i++, incidentId != null ? incidentId : "");
                ps2.setInt(i++, sourceVersion + 1);
                setIntOrNull(ps2, i++, authorityId);
                ps2.setString(i++, incidentAlertKindCode != null ? incidentAlertKindCode.trim() : "");
                setDateOrNull(ps2, i++, docCreationDate);
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

            try (PreparedStatement ps2 = conn.prepareStatement(SQL_INSERT_DPAXML)) {
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
                return;
            }
            try (PreparedStatement ps2 = conn.prepareStatement(SQL_INSERT_DPASTATUSHIST)) {
                ps2.setLong(1, newDpaid);
                ps2.setInt(2, draftStatusId);
                ps2.setInt(3, copyUserId);
                ps2.executeUpdate();
            }

            // Копируем все записи доступа из исходной карты (DPADEPPERMIS) в новую версию; вставляем только те DEPID, что есть в TB_DEP (FK)
            int copiedCount = 0;
            try (PreparedStatement ps2 = conn.prepareStatement(SQL_INSERT_DPADEPPERMIS)) {
                for (String depIdStr : cardDepIds) {
                    try {
                        int depId = Integer.parseInt(depIdStr);
                        if (!existsDepIdInTbDep(conn, depId)) continue;
                        ps2.setLong(1, newDpaid);
                        ps2.setInt(2, depId);
                        ps2.executeUpdate();
                        copiedCount++;
                    } catch (NumberFormatException e) {
                        // пропускаем некорректный DEPID
                    }
                }
            }
            System.out.println("[DpaSaveServlet] Copied DPADEPPERMIS from DPAID=" + sourceDpaid + " to new DPAID=" + newDpaid + ", count=" + copiedCount);

            conn.commit();
            response.setStatus(HttpServletResponse.SC_OK);
            response.getWriter().print("{\"success\":true,\"dpaid\":" + newDpaid + "}");
        }
    }

    private static java.util.Set<String> parseEditDepIdsFromRights(String json) {
        java.util.Set<String> out = new java.util.HashSet<>();
        int outStart = json.indexOf("\"dangerousProductOut\"");
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
        String rightsJson = RightsJsonStore.guidMap.get(guid);
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
     * Проверяет, что подразделение с данным DEPID есть в SESDEV.TB_DEP (родительская таблица для FK DPADEPPERMIS_FK2).
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
}
