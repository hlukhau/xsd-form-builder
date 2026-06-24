package com.eec.servlet.smd;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.AccessRightService;
import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.sql.Clob;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Создание карты SMD (исходящие сведения о временной санитарной мере).
 * POST /api/smd/save — тело JSON: { "isNew": true, "xmlBody": "...", "guid": "...", "metadata": { ... } }.
 */
public class SmdSaveServlet extends HttpServlet {

    private static final String DATASOURCE_OUTGOING = "2";
    private static final String EDOCCODE_DEFAULT = "R.SM.SS.09.001";
    private static final String EDOCVERSION_DEFAULT = "1.0.0";

    private static final String SQL_NEXT_SMDID = "SELECT SQSMD.NEXTVAL FROM DUAL";
    private static final String SQL_NEXT_SMDID_FALLBACK = "SELECT NVL(MAX(SMDID),0)+1 AS NEXTVAL FROM SMD";

    private static final String SQL_COUNTRY_ID = ""
            + "SELECT COUNTRYID FROM COUNTRY WHERE UPPER(TRIM(COUNTRYCODE)) = ? "
            + "AND COUNTRYSDATE <= SYSDATE AND COUNTRYEDATE >= SYSDATE AND ROWNUM = 1";

    private static final String SQL_STATUS_NEW = ""
            + "SELECT SMDSTATUSID FROM SMDSTATUS "
            + "WHERE TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
            + "AND UPPER(TRIM(SMDSTATUSCODE)) = 'NEW' AND SMDSTATUSACTFL = 1 AND ROWNUM = 1";

    private static final String SQL_DUPLICATE_DOC = ""
            + "SELECT COUNT(*) AS CNT FROM SMD "
            + "WHERE TRIM(DOCID) = TRIM(?) "
            + "AND TRUNC(DOCCREATIONDATE) = TRUNC(?) "
            + "AND SMDVERSION = 1 "
            + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ?";

    private static final String SQL_INSERT_SMD = ""
            + "INSERT INTO SMD (SMDID, DATASOURCEKINDCODE, DOCCOUNTRYID, DOCID, DOCCREATIONDATE, "
            + "SMDVERSION, SMDSTATUSID, MESSAGECODE, SANITARYMEASURESTARTDATE, SANITARYMEASUREENDDATE, "
            + "CREATIONDATETIME, MODIFICATIONDATETIME) "
            + "VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, SYSDATE, SYSDATE)";

    private static final String SQL_INSERT_SMDXML = ""
            + "INSERT INTO SMDXML (SMDID, SMDXMLBODY, EDOCCODE, EDOCVERSION) VALUES (?, ?, ?, ?)";

    private static final String SQL_INSERT_HIST = ""
            + "INSERT INTO SMDSTATUSHIST (SMDID, SMDSTATUSID, SMDSTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, ?)";

    private static final String SQL_INSERT_DEP = "INSERT INTO SMDDEPPERMIS (SMDID, DEPID, GRANTDATETIME) VALUES (?, ?, SYSDATE)";
    private static final String SQL_EXISTS_DEP = "SELECT 1 FROM TB_DEP WHERE DEPID = ?";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        request.setCharacterEncoding("UTF-8");

        String body = readBody(request);
        if (body == null || body.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Тело запроса пусто");
            return;
        }

        boolean isNew = extractJsonBoolean(body, "isNew");
        if (!isNew) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Обновление карты SMD пока не поддерживается; укажите isNew: true");
            return;
        }

        String guid = extractJsonString(body, "guid");
        if (guid == null) guid = extractJsonStringOrNumberAsString(body, "GUID");
        if (guid == null || guid.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid");
            return;
        }
        guid = guid.trim();

        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Права по GUID не найдены");
            return;
        }
        if (!AccessRightService.hasSanitaryMeasureOutEdit(rightsJson)) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                    "Нет права sanitaryMeasureOut:edit на создание карты");
            return;
        }

        String xmlBody = extractJsonStringXmlBody(body);
        if (xmlBody == null || xmlBody.trim().isEmpty() || !xmlBody.trim().startsWith("<")) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Требуется корректный xmlBody");
            return;
        }

        String metaBlock = extractJsonObject(body, "metadata");
        if (metaBlock == null) metaBlock = "{}";
        String docId = trimToEmpty(extractJsonString(metaBlock, "docId"));
        String docCreationDate = extractJsonString(metaBlock, "docCreationDate");
        String countryCode = trimToEmpty(extractJsonString(metaBlock, "countryCode"));
        if (countryCode.isEmpty()) countryCode = "BY";
        String messageCode = trimToEmpty(extractJsonString(metaBlock, "messageCode"));
        if (messageCode.isEmpty()) messageCode = "P.SS.09.MSG.001";
        String edocCode = trimToEmpty(extractJsonString(metaBlock, "edocCode"));
        if (edocCode.isEmpty()) edocCode = EDOCCODE_DEFAULT;
        String edocVersion = trimToEmpty(extractJsonString(metaBlock, "edocVersion"));
        if (edocVersion.isEmpty()) edocVersion = EDOCVERSION_DEFAULT;

        if (docId.isEmpty()) {
            docId = extractRegulatoryDocIdFromXml(xmlBody);
        }
        if (docId.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите номер документа (metadata.docId)");
            return;
        }
        if (docCreationDate == null || docCreationDate.trim().isEmpty()) {
            docCreationDate = extractRegulatoryDocCreationDateFromXml(xmlBody);
        }
        if (docCreationDate == null || docCreationDate.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите дату документа (metadata.docCreationDate)");
            return;
        }

        String sanitaryMeasureStartDate = extractJsonString(metaBlock, "sanitaryMeasureStartDate");
        if (sanitaryMeasureStartDate == null || sanitaryMeasureStartDate.trim().isEmpty()) {
            sanitaryMeasureStartDate = docCreationDate.trim();
        } else {
            sanitaryMeasureStartDate = sanitaryMeasureStartDate.trim();
        }
        String sanitaryMeasureEndDate = extractJsonString(metaBlock, "sanitaryMeasureEndDate");
        if (sanitaryMeasureEndDate != null) {
            sanitaryMeasureEndDate = sanitaryMeasureEndDate.trim();
            if (sanitaryMeasureEndDate.isEmpty()) sanitaryMeasureEndDate = null;
        }

        Integer userId = getUserIdFromRights(rightsJson);
        if (userId == null) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "В карте прав должен быть указан userId");
            return;
        }

        Connection conn = null;
        boolean transactionEnded = false;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            conn.setAutoCommit(false);

            if (existsDuplicateDoc(conn, docId, docCreationDate.trim())) {
                conn.rollback();
                sendJsonError(response, HttpServletResponse.SC_CONFLICT,
                        "Карта с указанными Страной, Номером и Датой уже существует. Сохранение невозможно");
                return;
            }

            Integer countryId = resolveCountryId(conn, countryCode);
            if (countryId == null) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Не удалось определить DOCCOUNTRYID по countryCode");
                return;
            }

            int statusId = resolveNewStatusId(conn);
            if (statusId <= 0) {
                sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Не найден статус NEW для исходящих SMD (SMDSTATUS)");
                return;
            }

            long smdid = getNextSmdid(conn);

            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_SMD)) {
                ps.setLong(1, smdid);
                ps.setString(2, DATASOURCE_OUTGOING);
                ps.setInt(3, countryId);
                ps.setString(4, docId);
                setDateOrNull(ps, 5, docCreationDate.trim());
                ps.setInt(6, statusId);
                ps.setString(7, messageCode);
                setDateOrNull(ps, 8, sanitaryMeasureStartDate);
                setDateOrNull(ps, 9, sanitaryMeasureEndDate);
                ps.executeUpdate();
            }

            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_SMDXML)) {
                ps.setLong(1, smdid);
                Clob clob = conn.createClob();
                clob.setString(1, xmlBody);
                ps.setClob(2, clob);
                ps.setString(3, edocCode);
                ps.setString(4, edocVersion);
                ps.executeUpdate();
            }

            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                ps.setLong(1, smdid);
                ps.setInt(2, statusId);
                ps.setInt(3, userId);
                ps.executeUpdate();
            }

            Integer creatorDepId = getDepartmentDepIdFromRights(rightsJson);
            if (creatorDepId != null && existsDepId(conn, creatorDepId)) {
                try (PreparedStatement psDep = conn.prepareStatement(SQL_INSERT_DEP)) {
                    psDep.setLong(1, smdid);
                    psDep.setInt(2, creatorDepId);
                    psDep.executeUpdate();
                }
            }

            conn.commit();
            transactionEnded = true;
            response.getWriter().print("{\"success\":true,\"smdid\":" + smdid + "}");
        } catch (SQLException e) {
            if (conn != null && !transactionEnded) {
                try {
                    conn.rollback();
                } catch (SQLException ignored) {
                }
            }
            System.err.println("[SmdSaveServlet] DB error: " + e.getMessage());
            e.printStackTrace();
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            if (conn != null) {
                try {
                    if (!transactionEnded) conn.rollback();
                } catch (SQLException ignored) {
                }
                DatabaseUtil.closeConnection(conn);
            }
        }
    }

    private static boolean existsDuplicateDoc(Connection conn, String docId, String docCreationDate) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_DUPLICATE_DOC)) {
            ps.setString(1, docId);
            setDateOrNull(ps, 2, docCreationDate);
            ps.setString(3, DATASOURCE_OUTGOING);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt("CNT") > 0;
            }
        }
        return false;
    }

    private static long getNextSmdid(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_NEXT_SMDID);
             ResultSet rs = ps.executeQuery()) {
            if (rs.next()) return rs.getLong(1);
        } catch (SQLException e) {
            if (!isMissingSequence(e)) throw e;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_NEXT_SMDID_FALLBACK);
             ResultSet rs = ps.executeQuery()) {
            if (rs.next()) return rs.getLong("NEXTVAL");
        }
        throw new SQLException("Не удалось получить SMDID");
    }

    private static boolean isMissingSequence(SQLException e) {
        String msg = e.getMessage();
        return msg != null && (msg.contains("ORA-02289") || msg.contains("ORA-00942"));
    }

    private static int resolveNewStatusId(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_STATUS_NEW)) {
            ps.setString(1, DATASOURCE_OUTGOING);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt(1);
            }
        }
        return -1;
    }

    private static Integer resolveCountryId(Connection conn, String countryCode) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_COUNTRY_ID)) {
            ps.setString(1, countryCode.trim().toUpperCase());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt(1);
            }
        }
        return null;
    }

    private static boolean existsDepId(Connection conn, int depId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_EXISTS_DEP)) {
            ps.setInt(1, depId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static void setDateOrNull(PreparedStatement ps, int index, String isoDate) throws SQLException {
        if (isoDate == null || isoDate.trim().isEmpty()) {
            ps.setNull(index, Types.DATE);
            return;
        }
        String d = isoDate.trim().length() >= 10 ? isoDate.trim().substring(0, 10) : isoDate.trim();
        ps.setDate(index, java.sql.Date.valueOf(d));
    }

    private static Integer getUserIdFromRights(String json) {
        if (json == null) return null;
        Matcher m = Pattern.compile("\"userId\"\\s*:\\s*(-?\\d+)").matcher(json);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        m = Pattern.compile("\"userId\"\\s*:\\s*\"(-?\\d+)\"").matcher(json);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static Integer getDepartmentDepIdFromRights(String json) {
        if (json == null) return null;
        Matcher m = Pattern.compile("\"depid\"\\s*:\\s*(\\d+)").matcher(json);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        m = Pattern.compile("\"depId\"\\s*:\\s*(\\d+)").matcher(json);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private static String readBody(HttpServletRequest request) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (java.io.BufferedReader reader = request.getReader()) {
            char[] buf = new char[4096];
            int n;
            while ((n = reader.read(buf)) >= 0) sb.append(buf, 0, n);
        }
        return sb.toString();
    }

    private static boolean extractJsonBoolean(String json, String key) {
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(true|false)").matcher(json);
        return m.find() && "true".equals(m.group(1));
    }

    private static String extractJsonString(String json, String key) {
        if (json == null) return null;
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"")
                .matcher(json);
        if (!m.find()) return null;
        return unescapeJson(m.group(1));
    }

    private static String extractJsonStringOrNumberAsString(String json, String key) {
        String s = extractJsonString(json, key);
        if (s != null) return s;
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(-?\\d+)").matcher(json);
        return m.find() ? m.group(1) : null;
    }

    private static String extractJsonObject(String json, String key) {
        int keyPos = json.indexOf("\"" + key + "\"");
        if (keyPos < 0) return null;
        int braceStart = json.indexOf('{', keyPos);
        if (braceStart < 0) return null;
        int depth = 1;
        int i = braceStart + 1;
        while (i < json.length() && depth > 0) {
            char c = json.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') depth--;
            i++;
        }
        return depth == 0 ? json.substring(braceStart, i) : null;
    }

    private static String extractJsonStringXmlBody(String json) {
        int keyPos = json.indexOf("\"xmlBody\"");
        if (keyPos < 0) return null;
        int colon = json.indexOf(':', keyPos);
        if (colon < 0) return null;
        int i = colon + 1;
        while (i < json.length() && Character.isWhitespace(json.charAt(i))) i++;
        if (i >= json.length() || json.charAt(i) != '"') return null;
        i++;
        StringBuilder sb = new StringBuilder();
        while (i < json.length()) {
            char c = json.charAt(i);
            if (c == '\\' && i + 1 < json.length()) {
                char n = json.charAt(i + 1);
                if (n == 'n') sb.append('\n');
                else if (n == 'r') sb.append('\r');
                else if (n == 't') sb.append('\t');
                else if (n == '"') sb.append('"');
                else if (n == '\\') sb.append('\\');
                else sb.append(n);
                i += 2;
                continue;
            }
            if (c == '"') break;
            sb.append(c);
            i++;
        }
        return sb.toString();
    }

    private static String unescapeJson(String s) {
        return s.replace("\\\"", "\"").replace("\\\\", "\\").replace("\\n", "\n").replace("\\r", "\r").replace("\\t", "\t");
    }

    private static String trimToEmpty(String s) {
        return s == null ? "" : s.trim();
    }

    /** csdo:DocId из первого smcdo:MeasureDocDetails (не InitialMeasureDocDetails). */
    private static String extractRegulatoryDocIdFromXml(String xml) {
        if (xml == null || xml.isEmpty()) return "";
        int pos = indexOfMeasureDocDetailsOpen(xml, 0);
        if (pos < 0) return "";
        String block = xml.substring(pos);
        Matcher m = Pattern.compile("<csdo:DocId>([^<]*)</csdo:DocId>", Pattern.CASE_INSENSITIVE).matcher(block);
        if (!m.find()) return "";
        int close = block.indexOf("</smcdo:MeasureDocDetails>");
        if (close >= 0 && m.start() > close) return "";
        return trimToEmpty(m.group(1));
    }

    private static String extractRegulatoryDocCreationDateFromXml(String xml) {
        if (xml == null || xml.isEmpty()) return null;
        int pos = indexOfMeasureDocDetailsOpen(xml, 0);
        if (pos < 0) return null;
        String block = xml.substring(pos);
        Matcher m = Pattern.compile("<csdo:DocCreationDate>([^<]*)</csdo:DocCreationDate>", Pattern.CASE_INSENSITIVE)
                .matcher(block);
        if (!m.find()) return null;
        int close = block.indexOf("</smcdo:MeasureDocDetails>");
        if (close >= 0 && m.start() > close) return null;
        String d = trimToEmpty(m.group(1));
        return d.isEmpty() ? null : (d.length() >= 10 ? d.substring(0, 10) : d);
    }

    private static int indexOfMeasureDocDetailsOpen(String xml, int from) {
        int p = xml.indexOf("<smcdo:MeasureDocDetails", from);
        while (p >= 0) {
            int before = Math.max(0, p - 24);
            String prefix = xml.substring(before, p);
            if (!prefix.contains("InitialMeasureDocDetails")) {
                return p;
            }
            p = xml.indexOf("<smcdo:MeasureDocDetails", p + 1);
        }
        return -1;
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        String escaped = message != null ? message.replace("\\", "\\\\").replace("\"", "\\\"") : "Unknown error";
        response.getWriter().print("{\"error\":\"" + escaped + "\"}");
    }
}
