package com.eec.servlet.pha;

import com.eec.rights.RightsRegistryProvider;
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
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Создание и обновление карты PHA (исходящие сведения о болезни).
 * POST /api/pha/save — тело JSON: { "isNew": true|false, "phaid"?: number, "xmlBody": "...", "guid": "...", "metadata": { ... } }.
 */
public class PhaSaveServlet extends HttpServlet {

    private static final String DATASOURCE_OUTGOING = "2";
    /** Статус «Новое» при создании (PHASTATUS). */
    private static final int PHA_STATUS_NEW_ID = 5;

    private static final String SQL_NEXT_PHAID = "SELECT SQPHA.NEXTVAL FROM DUAL";
    private static final String SQL_NEXT_PHAID_FALLBACK = "SELECT NVL(MAX(PHAID),0)+1 AS NEXTVAL FROM PHA";
    private static final String SQL_COUNTRY_ID = ""
            + "SELECT COUNTRYID FROM COUNTRY WHERE UPPER(TRIM(COUNTRYCODE)) = ? "
            + "AND COUNTRYSDATE <= SYSDATE AND COUNTRYEDATE >= SYSDATE";

    private static final String SQL_INSERT_PHA = ""
            + "INSERT INTO PHA (PHAID, DATASOURCEKINDCODE, ALERTCOUNTRYID, INCIDENTID, PHAVERSION, "
            + "PHASTATUSID, AUTHORITYID, ENDDATE, CREATIONDATETIME, MODIFICATIONDATETIME, INCIDENTALERTKINDCODE, DOCCREATIONDATE, "
            + "DISEASEHEALTHPROBLEMID, DISEASEHEALTHPROBLEMNAME, INCIDENTEVENTDATE, INCIDENTENDDATE, CROSSBOARDERRISKFL) "
            + "VALUES (?, ?, ?, ?, 1, ?, ?, ?, SYSDATE, SYSDATE, ?, ?, ?, ?, ?, ?, ?)";

    private static final String SQL_INSERT_PHAXML = "INSERT INTO PHAXML (PHAID, PHAXMLBODY) VALUES (?, ?)";
    private static final String SQL_INSERT_HIST = ""
            + "INSERT INTO PHASTATUSHIST (PHAID, PHASTATUSID, PHASTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, ?)";
    private static final String SQL_INSERT_DEP = "INSERT INTO PHADEPPERMIS (PHAID, DEPID, GRANTDATETIME) VALUES (?, ?, SYSDATE)";
    private static final String SQL_EXISTS_DEP = "SELECT 1 FROM TB_DEP WHERE DEPID = ?";

    private static final String SQL_UPDATE_PHAXML = "UPDATE PHAXML SET PHAXMLBODY = ? WHERE PHAID = ?";
    private static final String SQL_UPDATE_PHA_MOD = "UPDATE PHA SET MODIFICATIONDATETIME = SYSDATE WHERE PHAID = ?";
    private static final String SQL_CURRENT_PHA = ""
            + "SELECT DATASOURCEKINDCODE, PHASTATUSID FROM PHA WHERE PHAID = ?";
    private static final String SQL_PHA_DEPS = "SELECT DEPID FROM PHADEPPERMIS WHERE PHAID = ?";
    private static final String SQL_DISEASE_ID_BY_NAME = ""
            + "SELECT DISEASEHEALTHPROBLEMID FROM DISEASEHEALTHPROBLEM "
            + "WHERE UPPER(TRIM(DISEASEHEALTHPROBLEMNAME)) = UPPER(TRIM(?))";
    /** AUTHORITYID по AUTHORITYUID (идентификатор УО из фронта). */
    private static final String SQL_AUTHORITY_ID_BY_UID = "SELECT AUTHORITYID FROM AUTHORITY WHERE TRIM(AUTHORITYUID) = ?";
    private static final String SQL_UPDATE_PHA_META = ""
            + "UPDATE PHA SET INCIDENTALERTKINDCODE = ?, "
            + "AUTHORITYID = ?, ENDDATE = ?, "
            + "DISEASEHEALTHPROBLEMID = ?, DISEASEHEALTHPROBLEMNAME = ?, "
            + "INCIDENTEVENTDATE = ?, INCIDENTENDDATE = ?, "
            + "CROSSBOARDERRISKFL = ?, MODIFICATIONDATETIME = SYSDATE "
            + "WHERE PHAID = ?";

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
        Long phaidParam = extractJsonLong(body, "phaid");
        String guid = extractJsonString(body, "guid");
        if (guid == null) guid = extractJsonStringOrNumberAsString(body, "GUID");
        if (guid != null) guid = guid.trim();

        String xmlBody = extractJsonStringXmlBody(body);
        if (xmlBody == null || xmlBody.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Требуется xmlBody");
            return;
        }
        if (!xmlBody.trim().startsWith("<")) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "xmlBody должен содержать XML");
            return;
        }

        String metaBlock = extractJsonObject(body, "metadata");
        if (metaBlock == null) metaBlock = "{}";
        String incidentId = extractJsonString(metaBlock, "incidentId");
        String countryCode = extractJsonString(metaBlock, "countryCode");
        String docCreationDate = extractJsonString(metaBlock, "docCreationDate");
        String authorityIdentifier = extractJsonString(metaBlock, "authorityIdentifier");
        String endDate = extractJsonString(metaBlock, "endDate");
        String incidentAlertKindCode = extractJsonString(metaBlock, "incidentAlertKindCode");
        String diseaseName = extractJsonString(metaBlock, "diseaseName");
        String firstCaseDate = extractJsonString(metaBlock, "firstCaseDate");
        String lastCaseDate = extractJsonString(metaBlock, "lastCaseDate");
        Integer crossborderRiskFl = extractJsonInt(metaBlock, "crossborderRiskFl");

        Integer userId = getUserIdFromRightsByGuid(guid);

        Connection conn = null;
        boolean transactionEnded = false;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            conn.setAutoCommit(false);

            if (isNew) {
                if (userId == null) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                            "Укажите guid (в карте прав должен быть userId)");
                    return;
                }
                String incId = incidentId != null ? incidentId.trim() : "";
                if (incId.isEmpty()) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                            "При создании обязателен регистрационный номер (metadata.incidentId)");
                    return;
                }
                if (isBlank(incidentAlertKindCode)) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                            "Вид уведомления должен быть указан");
                    return;
                }

                Integer alertCountryId = resolveCountryId(conn, countryCode);
                if (alertCountryId == null && "RU".equalsIgnoreCase(trimToEmpty(countryCode))) {
                    alertCountryId = 191;
                }
                if (alertCountryId == null) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Не удалось определить ALERTCOUNTRYID по countryCode");
                    return;
                }
                Integer authorityId = resolveAuthorityId(conn, authorityIdentifier);
                Integer diseaseId = resolveDiseaseIdByName(conn, diseaseName);

                long phaid = getNextPhaid(conn);

                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_PHA)) {
                    int i = 1;
                    ps.setLong(i++, phaid);
                    ps.setString(i++, DATASOURCE_OUTGOING);
                    ps.setInt(i++, alertCountryId);
                    ps.setString(i++, incId);
                    ps.setInt(i++, PHA_STATUS_NEW_ID);
                    if (authorityId != null) ps.setInt(i++, authorityId);
                    else ps.setNull(i++, Types.INTEGER);
                    setDateOrNull(ps, i++, endDate);
                    ps.setString(i++, incidentAlertKindCode != null ? incidentAlertKindCode : "");
                    setDateOrNull(ps, i++, docCreationDate);
                    if (diseaseId != null) ps.setInt(i++, diseaseId);
                    else ps.setNull(i++, Types.INTEGER);
                    ps.setString(i++, trimToEmpty(diseaseName));
                    setDateOrNull(ps, i++, firstCaseDate);
                    setDateOrNull(ps, i++, lastCaseDate);
                    if (crossborderRiskFl == null) ps.setNull(i++, Types.INTEGER);
                    else ps.setInt(i++, crossborderRiskFl);
                    ps.executeUpdate();
                }

                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_PHAXML)) {
                    ps.setLong(1, phaid);
                    Clob clob = conn.createClob();
                    clob.setString(1, xmlBody);
                    ps.setClob(2, clob);
                    ps.executeUpdate();
                }

                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                    ps.setLong(1, phaid);
                    ps.setInt(2, PHA_STATUS_NEW_ID);
                    ps.setInt(3, userId);
                    ps.executeUpdate();
                }

                String rightsJson = (guid != null && !guid.isEmpty()) ? RightsRegistryProvider.get().getRightsJson(guid) : null;
                Integer creatorDepId = getDepartmentDepIdFromRights(rightsJson);
                if (creatorDepId != null && existsDepIdInTbDep(conn, creatorDepId)) {
                    try (PreparedStatement psDep = conn.prepareStatement(SQL_INSERT_DEP)) {
                        psDep.setLong(1, phaid);
                        psDep.setInt(2, creatorDepId);
                        psDep.executeUpdate();
                    }
                }

                conn.commit();
                transactionEnded = true;
                response.getWriter().print("{\"success\":true,\"phaid\":" + phaid + "}");
            } else {
                if (phaidParam == null || phaidParam <= 0) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Для обновления укажите phaid");
                    return;
                }
                long phaid = phaidParam;
                if (userId == null) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                            "Укажите guid (в карте прав должен быть userId)");
                    return;
                }
                String rightsJson = (guid != null && !guid.isEmpty()) ? RightsRegistryProvider.get().getRightsJson(guid) : null;
                if (rightsJson == null || rightsJson.isEmpty()) {
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Права по GUID не найдены");
                    return;
                }
                if (!isAllowedToEditOutgoing(conn, phaid, rightsJson)) {
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                            "Нет права на редактирование исходящих сведений (publicHealthOut:edit) в пределах подразделений доступа к карте или карта недоступна для редактирования");
                    return;
                }
                if (isBlank(incidentAlertKindCode)) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                            "Вид уведомления должен быть указан");
                    return;
                }
                try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_PHAXML)) {
                    Clob clob = conn.createClob();
                    clob.setString(1, xmlBody);
                    ps.setClob(1, clob);
                    ps.setLong(2, phaid);
                    if (ps.executeUpdate() == 0) {
                        conn.rollback();
                        sendJsonError(response, HttpServletResponse.SC_NOT_FOUND, "PHAXML для PHAID " + phaid + " не найдена");
                        return;
                    }
                }
                Integer diseaseId = resolveDiseaseIdByName(conn, diseaseName);
                Integer authorityId = resolveAuthorityId(conn, authorityIdentifier);
                try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_PHA_META)) {
                    ps.setString(1, trimToEmpty(incidentAlertKindCode));
                    if (authorityId != null) ps.setInt(2, authorityId);
                    else ps.setNull(2, Types.INTEGER);
                    setDateOrNull(ps, 3, endDate);
                    if (diseaseId != null) ps.setInt(4, diseaseId);
                    else ps.setNull(4, Types.INTEGER);
                    ps.setString(5, trimToEmpty(diseaseName));
                    setDateOrNull(ps, 6, firstCaseDate);
                    setDateOrNull(ps, 7, lastCaseDate);
                    if (crossborderRiskFl == null) ps.setNull(8, Types.INTEGER);
                    else ps.setInt(8, crossborderRiskFl);
                    ps.setLong(9, phaid);
                    ps.executeUpdate();
                }
                int prevStatus = loadCurrentStatusId(conn, phaid);
                if (prevStatus == 8 || prevStatus == 9) {
                    try (PreparedStatement ps = conn.prepareStatement("UPDATE PHA SET PHASTATUSID = ? WHERE PHAID = ?")) {
                        ps.setInt(1, PHA_STATUS_NEW_ID);
                        ps.setLong(2, phaid);
                        ps.executeUpdate();
                    }
                    try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                        ps.setLong(1, phaid);
                        ps.setInt(2, PHA_STATUS_NEW_ID);
                        ps.setInt(3, userId);
                        ps.executeUpdate();
                    }
                } else {
                    try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_PHA_MOD)) {
                        ps.setLong(1, phaid);
                        ps.executeUpdate();
                    }
                }
                conn.commit();
                transactionEnded = true;
                response.getWriter().print("{\"success\":true,\"phaid\":" + phaid + "}");
            }
        } catch (SQLException e) {
            DatabaseUtil.rollbackQuietly(conn);
            transactionEnded = true;
            e.printStackTrace();
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            if (conn != null) {
                if (!transactionEnded) {
                    DatabaseUtil.rollbackQuietly(conn);
                }
                DatabaseUtil.closeConnection(conn);
            }
        }
    }

    private static long getNextPhaid(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_NEXT_PHAID);
             ResultSet rs = ps.executeQuery()) {
            if (rs.next()) return rs.getLong(1);
        } catch (SQLException e) {
            if (e.getMessage() != null && (e.getMessage().contains("ORA-02289") || e.getMessage().contains("SQPHA"))) {
                try (PreparedStatement ps = conn.prepareStatement(SQL_NEXT_PHAID_FALLBACK);
                     ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) return rs.getLong(1);
                }
            }
            throw e;
        }
        throw new SQLException("Не удалось получить PHAID");
    }

    private static Integer resolveCountryId(Connection conn, String countryCode) throws SQLException {
        if (countryCode == null || countryCode.trim().isEmpty()) return null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_COUNTRY_ID)) {
            ps.setString(1, countryCode.trim().toUpperCase());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt(1);
            }
        }
        return null;
    }

    private static void setDateOrNull(PreparedStatement ps, int index, String dateStr) throws SQLException {
        if (dateStr == null || dateStr.trim().isEmpty()) {
            ps.setNull(index, Types.DATE);
            return;
        }
        try {
            java.sql.Date d = java.sql.Date.valueOf(dateStr.trim().substring(0, Math.min(10, dateStr.trim().length())));
            ps.setDate(index, d);
        } catch (IllegalArgumentException e) {
            ps.setNull(index, Types.DATE);
        }
    }

    private static boolean existsDepIdInTbDep(Connection conn, int depId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_EXISTS_DEP)) {
            ps.setInt(1, depId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static Integer getDepartmentDepIdFromRights(String json) {
        if (json == null) return null;
        Matcher m = Pattern.compile("\"depid\"\\s*:\\s*(\\d+)").matcher(json);
        if (m.find()) try { return Integer.parseInt(m.group(1)); } catch (NumberFormatException e) { return null; }
        m = Pattern.compile("\"depId\"\\s*:\\s*(\\d+)").matcher(json);
        if (m.find()) try { return Integer.parseInt(m.group(1)); } catch (NumberFormatException e) { return null; }
        return null;
    }

    private static Integer extractJsonInt(String json, String key) {
        if (json == null) return null;
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(-?\\d+)").matcher(json);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static int loadCurrentStatusId(Connection conn, long phaid) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT PHASTATUSID FROM PHA WHERE PHAID = ?")) {
            ps.setLong(1, phaid);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt(1);
            }
        }
        return -1;
    }

    private static Integer resolveDiseaseIdByName(Connection conn, String diseaseName) throws SQLException {
        if (diseaseName == null || diseaseName.trim().isEmpty()) return null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_DISEASE_ID_BY_NAME)) {
            ps.setString(1, diseaseName.trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt(1);
            }
        }
        return null;
    }

    /** Разрешает UID выбранного УО (AUTHORITY.AUTHORITYUID) в PHA.AUTHORITYID. */
    private static Integer resolveAuthorityId(Connection conn, String authorityIdentifier) throws SQLException {
        if (authorityIdentifier == null || authorityIdentifier.trim().isEmpty()) return null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_AUTHORITY_ID_BY_UID)) {
            ps.setString(1, authorityIdentifier.trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt("AUTHORITYID");
            }
        }
        return null;
    }

    private static boolean isAllowedToEditOutgoing(Connection conn, long phaid, String rightsJson) throws SQLException {
        String dsCode = null;
        int statusId = -1;
        try (PreparedStatement ps = conn.prepareStatement(SQL_CURRENT_PHA)) {
            ps.setLong(1, phaid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return false;
                dsCode = rs.getString("DATASOURCEKINDCODE");
                statusId = rs.getInt("PHASTATUSID");
            }
        }
        if (dsCode == null || !DATASOURCE_OUTGOING.equals(dsCode.trim())) return false;
        if (statusId != 5 && statusId != 8 && statusId != 9) return false;

        Set<String> cardDepIds = new HashSet<>();
        try (PreparedStatement ps = conn.prepareStatement(SQL_PHA_DEPS)) {
            ps.setLong(1, phaid);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String d = rs.getString(1);
                    if (d != null && !d.trim().isEmpty()) cardDepIds.add(d.trim());
                }
            }
        }
        if (cardDepIds.isEmpty()) return false;
        Set<String> userEditDepIds = parsePublicHealthOutEditDepIds(rightsJson);
        for (String depId : userEditDepIds) {
            if (cardDepIds.contains(depId)) return true;
        }
        return false;
    }

    private static Set<String> parsePublicHealthOutEditDepIds(String json) {
        Set<String> out = new HashSet<>();
        if (json == null) return out;
        int outStart = json.indexOf("\"publicHealthOut\"");
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
        Matcher m = Pattern.compile("\"([^\"]+)\"\\s*:").matcher(editBlock);
        while (m.find()) out.add(m.group(1).trim());
        return out;
    }

    private static Integer getUserIdFromRightsByGuid(String guid) {
        if (guid == null || guid.isEmpty()) return null;
        String json = RightsRegistryProvider.get().getRightsJson(guid.trim());
        if (json == null || json.isEmpty()) return null;
        Matcher m = Pattern.compile("\"userId\"\\s*:\\s*(-?\\d+)").matcher(json);
        if (m.find()) try { return Integer.parseInt(m.group(1)); } catch (NumberFormatException e) { return null; }
        m = Pattern.compile("\"userId\"\\s*:\\s*\"(-?\\d+)\"").matcher(json);
        if (m.find()) try { return Integer.parseInt(m.group(1)); } catch (NumberFormatException e) { return null; }
        return null;
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private static String trimToEmpty(String s) {
        return s == null ? "" : s.trim();
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
                char next = json.charAt(i + 1);
                switch (next) {
                    case '"':
                        sb.append('"');
                        i += 2;
                        continue;
                    case '\\':
                        sb.append('\\');
                        i += 2;
                        continue;
                    case '/':
                        sb.append('/');
                        i += 2;
                        continue;
                    case 'b':
                        sb.append('\b');
                        i += 2;
                        continue;
                    case 'f':
                        sb.append('\f');
                        i += 2;
                        continue;
                    case 'n':
                        sb.append('\n');
                        i += 2;
                        continue;
                    case 'r':
                        sb.append('\r');
                        i += 2;
                        continue;
                    case 't':
                        sb.append('\t');
                        i += 2;
                        continue;
                    case 'u':
                        if (i + 5 < json.length()) {
                            try {
                                int cp = Integer.parseInt(json.substring(i + 2, i + 6), 16);
                                sb.append((char) cp);
                                i += 6;
                                continue;
                            } catch (NumberFormatException ignored) {
                                // оставляем '\' в выводе, повторно обрабатываем 'u'
                            }
                        }
                        sb.append('\\');
                        i++;
                        continue;
                    default:
                        // Неизвестная escape: как в JSON — только символ после \
                        sb.append(next);
                        i += 2;
                        continue;
                }
            }
            if (c == '"') break;
            sb.append(c);
            i++;
        }
        return sb.toString();
    }

    private static String extractJsonString(String json, String key) {
        Pattern p = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher m = p.matcher(json);
        return m.find() ? m.group(1) : null;
    }

    private static String extractJsonStringOrNumberAsString(String json, String key) {
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(\\d+)").matcher(json);
        return m.find() ? m.group(1) : null;
    }

    private static Long extractJsonLong(String json, String key) {
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(-?\\d+)").matcher(json);
        if (m.find()) try { return Long.parseLong(m.group(1)); } catch (NumberFormatException e) { return null; }
        return null;
    }

    private static boolean extractJsonBoolean(String json, String key) {
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(true|false)").matcher(json);
        return m.find() && "true".equalsIgnoreCase(m.group(1));
    }

    private static String extractJsonObject(String json, String key) {
        Pattern p = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*");
        Matcher m = p.matcher(json);
        if (!m.find()) return null;
        int start = m.end();
        while (start < json.length() && Character.isWhitespace(json.charAt(start))) start++;
        if (start >= json.length() || json.charAt(start) != '{') return null;
        int depth = 1;
        int i = start + 1;
        while (i < json.length() && depth > 0) {
            char c = json.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') depth--;
            i++;
        }
        return depth == 0 ? json.substring(start, i) : null;
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        String esc = message != null ? message.replace("\\", "\\\\").replace("\"", "\\\"") : "";
        response.getWriter().print("{\"error\":\"" + esc + "\"}");
    }
}
