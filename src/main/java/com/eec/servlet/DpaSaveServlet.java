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

    private static final String DATASOURCEKINDCODE_OUTGOING = "3";
    private static final String EDOCCODE_DEFAULT = "R.SM.SS.08.002";
    private static final String EDOCVERSION_DEFAULT = "1.0.0";

    /** Получить следующий DPAID (последовательность или MAX+1) */
    private static final String SQL_NEXT_DPAID = "SELECT SESINT.SEQ_DPA.NEXTVAL FROM DUAL";
    private static final String SQL_NEXT_DPAID_FALLBACK = "SELECT NVL(MAX(DPAID),0)+1 AS NEXTVAL FROM SESINT.DPA";

    /** DPASTATUSID по названию «Черновик» */
    private static final String SQL_STATUS_DRAFT = "SELECT DPASTATUSID FROM SESINT.DPASTATUS WHERE TRIM(DPASTATUSNAME) = 'Черновик'";

    /** COUNTRYID по коду страны (COUNTRYCODE) */
    private static final String SQL_COUNTRY_ID = "SELECT COUNTRYID FROM SESINT.COUNTRY WHERE UPPER(TRIM(COUNTRYCODE)) = ? AND COUNTRYSDATE <= SYSDATE AND COUNTRYEDATE >= SYSDATE";

    /** INSERT DPA (всегда версия 1 при создании) */
    private static final String SQL_INSERT_DPA = ""
            + "INSERT INTO SESINT.DPA (DPAID, DATASOURCEKINDCODE, ALERTCOUNTRYID, INCIDENTID, DPAVERSION, AUTHORITYID, "
            + "INCIDENTALERTKINDCODE, DOCCREATIONDATE, DPASTATUSID, COMMODITYCODE, SANITARYPRODTYPEID, SANITARYPRODNAME, "
            + "MANUFCOUNTRYID, MANUFBUSENTNAME, MANUFBUSENTBRIEFNAME, ENDDATE, CREATIONDATETIME, MODIFICATIONDATETIME, SANITARYPRODTYPENAME) "
            + "VALUES (?, ?, ?, ?, 1, NULL, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL, SYSDATE, NULL, ?)";

    /** INSERT DPAXML */
    private static final String SQL_INSERT_DPAXML = "INSERT INTO SESINT.DPAXML (DPAID, DPAXMLBODY, EDOCCODE, EDOCVERSION) VALUES (?, ?, ?, ?)";

    /** UPDATE DPAXML при обновлении существующей карты */
    private static final String SQL_UPDATE_DPAXML = "UPDATE SESINT.DPAXML SET DPAXMLBODY = ?, EDOCCODE = ?, EDOCVERSION = ? WHERE DPAID = ?";

    /** Обновить MODIFICATIONDATETIME в DPA при обновлении XML */
    private static final String SQL_UPDATE_DPA_MODIFIED = "UPDATE SESINT.DPA SET MODIFICATIONDATETIME = SYSDATE WHERE DPAID = ?";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        System.out.println("[DpaSaveServlet] doPost called");
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");

        String body = readBody(request);
        if (body == null || body.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Тело запроса пусто");
            return;
        }

        boolean isNew = extractJsonBoolean(body, "isNew");
        Long dpaidParam = extractJsonLong(body, "dpaid");

        String xmlBody = extractJsonStringXmlBody(body);
        if (xmlBody == null || xmlBody.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Требуется xmlBody");
            return;
        }
        if ("null".equals(xmlBody.trim()) || !xmlBody.trim().startsWith("<")) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "xmlBody должен содержать валидный XML (начинаться с <)");
            return;
        }

        String metaBlock = extractJsonObject(body, "metadata");
        if (metaBlock == null) metaBlock = "{}";
        String incidentId = extractJsonString(metaBlock, "incidentId");
        String countryCode = extractJsonString(metaBlock, "countryCode");
        String docCreationDate = extractJsonString(metaBlock, "docCreationDate");
        String incidentAlertKindCode = extractJsonString(metaBlock, "incidentAlertKindCode");
        String commodityCode = extractJsonString(metaBlock, "commodityCode");
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

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnection();
            conn.setAutoCommit(false);

            if (isNew) {
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
                Integer draftStatusId = getDraftStatusId(conn);
                System.out.println("[DpaSaveServlet] Create: DPAID=" + dpaid + ", INCIDENTID=" + incId);

                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_DPA)) {
                    int i = 1;
                    ps.setLong(i++, dpaid);
                    ps.setString(i++, DATASOURCEKINDCODE_OUTGOING);
                    setIntOrNull(ps, i++, alertCountryId);
                    ps.setString(i++, incId);
                    ps.setString(i++, incidentAlertKindCode != null ? incidentAlertKindCode : "");
                    setDateOrNull(ps, i++, docCreationDate);
                    setIntOrNull(ps, i++, draftStatusId);
                    ps.setString(i++, commodityCode != null ? commodityCode : "");
                    ps.setString(i++, sanitaryProdName != null ? sanitaryProdName : "");
                    setIntOrNull(ps, i++, manufCountryId);
                    ps.setString(i++, manufBusEntName);
                    ps.setString(i++, manufBusEntBriefName);
                    ps.setString(i++, sanitaryProdTypeName != null ? sanitaryProdTypeName : "");
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
                try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_DPA_MODIFIED)) {
                    ps.setLong(1, dpaid);
                    ps.executeUpdate();
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

    private Integer getDraftStatusId(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_STATUS_DRAFT);
             ResultSet rs = ps.executeQuery()) {
            if (rs.next()) return rs.getInt("DPASTATUSID");
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

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        String escaped = message != null ? message.replace("\\", "\\\\").replace("\"", "\\\"") : "Unknown error";
        response.getWriter().print("{\"error\":\"" + escaped + "\"}");
    }
}
