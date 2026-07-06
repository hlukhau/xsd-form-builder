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
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Создание и обновление карты SMD (исходящие сведения о временной санитарной мере).
 * POST /api/smd/save — isNew: true — создание; isNew: false + smdid — сохранение существующей.
 */
public class SmdSaveServlet extends HttpServlet {

    private static final String DATASOURCE_OUTGOING = "2";
    private static final String EDOCCODE_DEFAULT = "R.SM.SS.09.001";
    private static final String EDOCVERSION_DEFAULT = "1.0.0";
    private static final String MESSAGE_CANCEL = "P.SS.09.MSG.003";
    private static final String MESSAGE_CHANGE = "P.SS.09.MSG.002";
    private static final String STATUS_DELIVERED = "DELIVERED";

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
            + "AND SMDVERSION = ? "
            + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ?";

    private static final String SQL_INSERT_SMD = ""
            + "INSERT INTO SMD (SMDID, DATASOURCEKINDCODE, DOCCOUNTRYID, DOCID, DOCCREATIONDATE, "
            + "SMDVERSION, SMDSTATUSID, MESSAGECODE, SANITARYMEASURESTARTDATE, SANITARYMEASUREENDDATE, "
            + "SANITARYMEASUREID, SANITARYMEASURENAME, SANITARYMEASUREREASONCODE, "
            + "CREATIONDATETIME, MODIFICATIONDATETIME) "
            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, SYSDATE, SYSDATE)";

    private static final String SQL_SANITARY_MEASURE_BY_CODE = ""
            + "SELECT SANITARYMEASUREID, SANITARYMEASURENAME FROM SANITARYMEASURE "
            + "WHERE TRIM(SANITARYMEASURECODE) = TRIM(?) AND ROWNUM = 1";

    private static final String SQL_SOURCE_SMD_FOR_COPY = ""
            + "SELECT s.SMDID, s.SMDVERSION, s.SMDSTATUSID, s.DATASOURCEKINDCODE, s.DOCID, s.DOCCOUNTRYID, "
            + "       s.DOCCREATIONDATE, TRIM(s.MESSAGECODE) AS MESSAGECODE "
            + "FROM SMD s WHERE s.SMDID = ? AND TRIM(TO_CHAR(s.DATASOURCEKINDCODE)) = ? AND s.SMDSTATUSID = ?";

    private static final String SQL_MAX_VERSION = ""
            + "SELECT NVL(MAX(SMDVERSION), 0) FROM SMD "
            + "WHERE TRIM(DOCID) = TRIM(?) AND DOCCOUNTRYID = ? AND TRUNC(DOCCREATIONDATE) = TRUNC(?) "
            + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ?";

    private static final String SQL_SMD_DEPS = "SELECT DEPID FROM SMDDEPPERMIS WHERE SMDID = ?";

    private static final String SQL_INSERT_SMDXML = ""
            + "INSERT INTO SMDXML (SMDID, SMDXMLBODY, EDOCCODE, EDOCVERSION) VALUES (?, ?, ?, ?)";

    private static final String SQL_INSERT_HIST = ""
            + "INSERT INTO SMDSTATUSHIST (SMDID, SMDSTATUSID, SMDSTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, ?)";

    private static final String SQL_INSERT_DEP = "INSERT INTO SMDDEPPERMIS (SMDID, DEPID, GRANTDATETIME) VALUES (?, ?, SYSDATE)";
    private static final String SQL_EXISTS_DEP = "SELECT 1 FROM TB_DEP WHERE DEPID = ?";

    private static final String SQL_CURRENT_STATUS = ""
            + "SELECT s.SMDSTATUSID, TRIM(UPPER(NVL(st.SMDSTATUSCODE, ''))) AS STCODE "
            + "FROM SMD s LEFT JOIN SMDSTATUS st ON st.SMDSTATUSID = s.SMDSTATUSID WHERE s.SMDID = ?";

    private static final String SQL_UPDATE_SMDXML = ""
            + "UPDATE SMDXML SET SMDXMLBODY = ?, EDOCCODE = ?, EDOCVERSION = ? WHERE SMDID = ?";

    private static final String SQL_UPDATE_SMD = ""
            + "UPDATE SMD SET MODIFICATIONDATETIME = SYSDATE, SMDSTATUSID = ?, "
            + "SANITARYMEASURESTARTDATE = ?, SANITARYMEASUREENDDATE = ?, "
            + "SANITARYMEASUREID = ?, SANITARYMEASURENAME = ?, SANITARYMEASUREREASONCODE = ? "
            + "WHERE SMDID = ? AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ?";

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
        String guid = extractJsonString(body, "guid");
        if (guid == null) guid = extractJsonStringOrNumberAsString(body, "GUID");
        if (guid == null || guid.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid");
            return;
        }
        guid = guid.trim();

        if (!isNew) {
            handleUpdate(request, response, body, guid);
            return;
        }

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
        Long copyFromSmdid = extractJsonLong(body, "copyFromSmdid");
        boolean isNewVersionCopy = copyFromSmdid != null && copyFromSmdid > 0;

        if (isNewVersionCopy) {
            if (messageCode.isEmpty()) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите вид сообщения");
                return;
            }
            if (!MESSAGE_CHANGE.equalsIgnoreCase(messageCode) && !MESSAGE_CANCEL.equalsIgnoreCase(messageCode)) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Для новой версии укажите вид сообщения P.SS.09.MSG.002 или P.SS.09.MSG.003");
                return;
            }
        } else if (messageCode.isEmpty()) {
            messageCode = "P.SS.09.MSG.001";
        }
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

        String sanitaryMeasureCode = trimToEmpty(extractJsonString(metaBlock, "sanitaryMeasureCode"));
        String sanitaryMeasureName = trimToEmpty(extractJsonString(metaBlock, "sanitaryMeasureName"));
        String sanitaryMeasureReasonCode = trimToEmpty(extractJsonString(metaBlock, "sanitaryMeasureReasonCode"));
        if (sanitaryMeasureCode.isEmpty()) {
            sanitaryMeasureCode = extractMeasureCodeFromXml(xmlBody);
        }
        if (sanitaryMeasureName.isEmpty() && sanitaryMeasureCode.isEmpty()) {
            sanitaryMeasureName = extractMeasureNameFromXml(xmlBody);
        }
        if (sanitaryMeasureReasonCode.isEmpty()) {
            sanitaryMeasureReasonCode = extractMeasureReasonCodeFromXml(xmlBody);
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

            if (isNewVersionCopy) {
                Long newSmdid = handleNewVersionCopy(conn, response, request, copyFromSmdid, guid, xmlBody,
                        docId, docCreationDate.trim(), messageCode, sanitaryMeasureStartDate, sanitaryMeasureEndDate,
                        sanitaryMeasureCode, sanitaryMeasureName, sanitaryMeasureReasonCode,
                        edocCode, edocVersion, userId, rightsJson);
                if (newSmdid == null) {
                    return;
                }
                conn.commit();
                transactionEnded = true;
                response.getWriter().print("{\"success\":true,\"smdid\":" + newSmdid + "}");
                return;
            }

            if (existsDuplicateDoc(conn, docId, docCreationDate.trim(), 1)) {
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

            insertSmdRow(conn, smdid, countryId, docId, docCreationDate.trim(), 1, statusId, messageCode,
                    sanitaryMeasureStartDate, sanitaryMeasureEndDate,
                    sanitaryMeasureCode, sanitaryMeasureName, sanitaryMeasureReasonCode);

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

    private static boolean existsDuplicateDoc(Connection conn, String docId, String docCreationDate, int version)
            throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_DUPLICATE_DOC)) {
            ps.setString(1, docId);
            setDateOrNull(ps, 2, docCreationDate);
            ps.setInt(3, version);
            ps.setString(4, DATASOURCE_OUTGOING);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt("CNT") > 0;
            }
        }
        return false;
    }

    private Long handleNewVersionCopy(Connection conn, HttpServletResponse response, HttpServletRequest request,
                                      long sourceSmdid, String guid, String xmlBody, String docId, String docCreationDate,
                                      String messageCode, String sanitaryMeasureStartDate, String sanitaryMeasureEndDate,
                                      String sanitaryMeasureCode, String sanitaryMeasureName, String sanitaryMeasureReasonCode,
                                      String edocCode, String edocVersion, Integer userId, String rightsJson)
            throws IOException, SQLException {
        int deliveredStatusId = resolveStatusIdByCode(conn, STATUS_DELIVERED);
        if (deliveredStatusId <= 0) {
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "Не найден статус DELIVERED для исходящих SMD");
            return null;
        }

        try (PreparedStatement ps = conn.prepareStatement(SQL_SOURCE_SMD_FOR_COPY)) {
            ps.setLong(1, sourceSmdid);
            ps.setString(2, DATASOURCE_OUTGOING);
            ps.setInt(3, deliveredStatusId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                            "Исходная карта не найдена или не подходит для создания новой версии "
                                    + "(исходящая, статус «Доставлено»).");
                    return null;
                }

                int sourceVersion = rs.getInt("SMDVERSION");
                if (rs.wasNull()) sourceVersion = 0;
                String sourceDocId = trimToEmpty(rs.getString("DOCID"));
                java.sql.Date sourceDocDate = rs.getDate("DOCCREATIONDATE");
                Integer docCountryId = toNullableInt(rs.getObject("DOCCOUNTRYID"));
                String sourceMessageCode = trimToEmpty(rs.getString("MESSAGECODE"));

                if (MESSAGE_CANCEL.equalsIgnoreCase(sourceMessageCode)) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                            "Создание новой версии недоступно для карты с видом сообщения P.SS.09.MSG.003");
                    return null;
                }

                if (!docId.trim().equalsIgnoreCase(sourceDocId)) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                            "Номер документа новой версии должен совпадать с исходной картой");
                    return null;
                }
                if (sourceDocDate != null && docCreationDate != null) {
                    String reqDate = docCreationDate.trim().length() >= 10
                            ? docCreationDate.trim().substring(0, 10) : docCreationDate.trim();
                    if (!sourceDocDate.toLocalDate().toString().equals(reqDate)) {
                        sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                                "Дата документа новой версии должна совпадать с исходной картой");
                        return null;
                    }
                }

                int maxVersion = 0;
                try (PreparedStatement psMax = conn.prepareStatement(SQL_MAX_VERSION)) {
                    psMax.setString(1, sourceDocId);
                    psMax.setObject(2, docCountryId);
                    psMax.setDate(3, sourceDocDate);
                    psMax.setString(4, DATASOURCE_OUTGOING);
                    try (ResultSet rsMax = psMax.executeQuery()) {
                        if (rsMax.next()) maxVersion = rsMax.getInt(1);
                    }
                }
                if (sourceVersion < maxVersion) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                            "Создание новой версии доступно только для карты с максимальной версией по данному номеру и дате документа");
                    return null;
                }

                Set<String> cardDepIds = new HashSet<>();
                try (PreparedStatement psDep = conn.prepareStatement(SQL_SMD_DEPS)) {
                    psDep.setLong(1, sourceSmdid);
                    try (ResultSet rsDep = psDep.executeQuery()) {
                        while (rsDep.next()) {
                            String depId = rsDep.getString(1);
                            if (depId != null && !depId.trim().isEmpty()) cardDepIds.add(depId.trim());
                        }
                    }
                }
                if (cardDepIds.isEmpty()) {
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет доступа к исходной карте");
                    return null;
                }
                Set<String> userEditDepIds = parseSanitaryMeasureOutEditDepIds(rightsJson);
                boolean hasEdit = false;
                for (String depId : userEditDepIds) {
                    if (cardDepIds.contains(depId)) {
                        hasEdit = true;
                        break;
                    }
                }
                if (!hasEdit) {
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                            "Нет права sanitaryMeasureOut:edit в пределах подразделений доступа к исходной карте");
                    return null;
                }

                int newVersion = sourceVersion + 1;
                if (existsDuplicateDoc(conn, docId, docCreationDate, newVersion)) {
                    sendJsonError(response, HttpServletResponse.SC_CONFLICT,
                            "Временная санитарная мера с таким номером, датой документа и версией уже существует");
                    return null;
                }

                int statusId = resolveNewStatusId(conn);
                if (statusId <= 0) {
                    sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                            "Не найден статус NEW для исходящих SMD");
                    return null;
                }

                long newSmdid = getNextSmdid(conn);
                insertSmdRow(conn, newSmdid,
                        docCountryId != null ? docCountryId : resolveCountryId(conn, "BY"),
                        docId, docCreationDate, newVersion, statusId, messageCode,
                        sanitaryMeasureStartDate, sanitaryMeasureEndDate,
                        sanitaryMeasureCode, sanitaryMeasureName, sanitaryMeasureReasonCode);

                try (PreparedStatement psXml = conn.prepareStatement(SQL_INSERT_SMDXML)) {
                    psXml.setLong(1, newSmdid);
                    Clob clob = conn.createClob();
                    clob.setString(1, xmlBody);
                    psXml.setClob(2, clob);
                    psXml.setString(3, edocCode);
                    psXml.setString(4, edocVersion);
                    psXml.executeUpdate();
                }

                try (PreparedStatement psHist = conn.prepareStatement(SQL_INSERT_HIST)) {
                    psHist.setLong(1, newSmdid);
                    psHist.setInt(2, statusId);
                    psHist.setInt(3, userId);
                    psHist.executeUpdate();
                }

                Integer creatorDepId = getDepartmentDepIdFromRights(rightsJson);
                if (creatorDepId != null && existsDepId(conn, creatorDepId)) {
                    try (PreparedStatement psDepIns = conn.prepareStatement(SQL_INSERT_DEP)) {
                        psDepIns.setLong(1, newSmdid);
                        psDepIns.setInt(2, creatorDepId);
                        psDepIns.executeUpdate();
                    }
                }

                System.out.println("[SmdSaveServlet] New SMD version: SMDID=" + newSmdid + ", SMDVERSION=" + newVersion
                        + ", from SMDID=" + sourceSmdid);
                return newSmdid;
            }
        }
    }

    private static int resolveStatusIdByCode(Connection conn, String statusCode) throws SQLException {
        String sql = ""
                + "SELECT SMDSTATUSID FROM SMDSTATUS "
                + "WHERE TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
                + "AND UPPER(TRIM(SMDSTATUSCODE)) = ? AND SMDSTATUSACTFL = 1 AND ROWNUM = 1";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, DATASOURCE_OUTGOING);
            ps.setString(2, statusCode.trim().toUpperCase());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt(1);
            }
        }
        return -1;
    }

    private static Integer toNullableInt(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).intValue();
        try {
            return Integer.valueOf(String.valueOf(v).trim());
        } catch (Exception e) {
            return null;
        }
    }

    private static Set<String> parseSanitaryMeasureOutEditDepIds(String json) {
        Set<String> out = new HashSet<>();
        if (json == null) return out;
        int outStart = json.indexOf("\"sanitaryMeasureOut\"");
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

    private static Long extractJsonLong(String json, String key) {
        if (json == null) return null;
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(-?\\d+)").matcher(json);
        if (!m.find()) return null;
        try {
            return Long.parseLong(m.group(1));
        } catch (NumberFormatException e) {
            return null;
        }
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

    private static void insertSmdRow(Connection conn, long smdid, Integer countryId, String docId,
                                     String docCreationDate, int version, int statusId, String messageCode,
                                     String sanitaryMeasureStartDate, String sanitaryMeasureEndDate,
                                     String sanitaryMeasureCode, String sanitaryMeasureName,
                                     String sanitaryMeasureReasonCode) throws SQLException {
        Integer measureId = resolveSanitaryMeasureId(conn, sanitaryMeasureCode);
        String measureName = resolveSanitaryMeasureName(conn, sanitaryMeasureCode, sanitaryMeasureName);
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_SMD)) {
            ps.setLong(1, smdid);
            ps.setString(2, DATASOURCE_OUTGOING);
            ps.setInt(3, countryId != null ? countryId : 0);
            ps.setString(4, docId);
            setDateOrNull(ps, 5, docCreationDate);
            ps.setInt(6, version);
            ps.setInt(7, statusId);
            ps.setString(8, messageCode);
            setDateOrNull(ps, 9, sanitaryMeasureStartDate);
            setDateOrNull(ps, 10, sanitaryMeasureEndDate);
            if (measureId != null && measureId > 0) {
                ps.setInt(11, measureId);
            } else {
                ps.setNull(11, Types.INTEGER);
            }
            setStringOrNull(ps, 12, measureName);
            setStringOrNull(ps, 13, sanitaryMeasureReasonCode);
            ps.executeUpdate();
        }
    }

    private static Integer resolveSanitaryMeasureId(Connection conn, String measureCode) throws SQLException {
        if (measureCode == null || measureCode.trim().isEmpty()) {
            return null;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_SANITARY_MEASURE_BY_CODE)) {
            ps.setString(1, measureCode.trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    int id = rs.getInt("SANITARYMEASUREID");
                    return rs.wasNull() ? null : id;
                }
            }
        }
        return null;
    }

    private static String resolveSanitaryMeasureName(Connection conn, String measureCode, String measureName)
            throws SQLException {
        // Наименование в БД — только при ручном вводе (smsdo:MeasureName), не из справочника по коду.
        return trimToEmpty(measureName);
    }

    private void handleUpdate(HttpServletRequest request, HttpServletResponse response, String body, String guid)
            throws IOException {
        Long smdidObj = extractJsonLong(body, "smdid");
        if (smdidObj == null || smdidObj <= 0) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Для обновления укажите smdid");
            return;
        }
        long smdid = smdidObj;

        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Права по GUID не найдены");
            return;
        }
        if (!AccessRightService.hasSanitaryMeasureOutEdit(rightsJson)) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                    "Нет права sanitaryMeasureOut:edit на редактирование карты");
            return;
        }

        String xmlBody = extractJsonStringXmlBody(body);
        if (xmlBody == null || xmlBody.trim().isEmpty() || !xmlBody.trim().startsWith("<")) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Требуется корректный xmlBody");
            return;
        }

        String metaBlock = extractJsonObject(body, "metadata");
        if (metaBlock == null) metaBlock = "{}";
        String edocCode = trimToEmpty(extractJsonString(metaBlock, "edocCode"));
        if (edocCode.isEmpty()) edocCode = EDOCCODE_DEFAULT;
        String edocVersion = trimToEmpty(extractJsonString(metaBlock, "edocVersion"));
        if (edocVersion.isEmpty()) edocVersion = EDOCVERSION_DEFAULT;

        String sanitaryMeasureStartDate = extractJsonString(metaBlock, "sanitaryMeasureStartDate");
        if (sanitaryMeasureStartDate != null) {
            sanitaryMeasureStartDate = sanitaryMeasureStartDate.trim();
            if (sanitaryMeasureStartDate.isEmpty()) sanitaryMeasureStartDate = null;
        }
        String sanitaryMeasureEndDate = extractJsonString(metaBlock, "sanitaryMeasureEndDate");
        if (sanitaryMeasureEndDate != null) {
            sanitaryMeasureEndDate = sanitaryMeasureEndDate.trim();
            if (sanitaryMeasureEndDate.isEmpty()) sanitaryMeasureEndDate = null;
        }

        String sanitaryMeasureCode = trimToEmpty(extractJsonString(metaBlock, "sanitaryMeasureCode"));
        String sanitaryMeasureName = trimToEmpty(extractJsonString(metaBlock, "sanitaryMeasureName"));
        String sanitaryMeasureReasonCode = trimToEmpty(extractJsonString(metaBlock, "sanitaryMeasureReasonCode"));
        if (sanitaryMeasureCode.isEmpty()) {
            sanitaryMeasureCode = extractMeasureCodeFromXml(xmlBody);
        }
        if (sanitaryMeasureName.isEmpty() && sanitaryMeasureCode.isEmpty()) {
            sanitaryMeasureName = extractMeasureNameFromXml(xmlBody);
        }
        if (sanitaryMeasureReasonCode.isEmpty()) {
            sanitaryMeasureReasonCode = extractMeasureReasonCodeFromXml(xmlBody);
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
            SmdDeleteSupport.Eligibility editGate = SmdEditSupport.checkEditEligibility(conn, smdid, rightsJson);
            if (!editGate.allowed) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                        editGate.reason != null ? editGate.reason : "Сохранение карты SMD недоступно");
                return;
            }

            int currentStatusId;
            String currentStatusCode;
            try (PreparedStatement ps = conn.prepareStatement(SQL_CURRENT_STATUS)) {
                ps.setLong(1, smdid);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        sendJsonError(response, HttpServletResponse.SC_NOT_FOUND, "Карта SMD не найдена");
                        return;
                    }
                    currentStatusId = rs.getInt("SMDSTATUSID");
                    currentStatusCode = trimToEmpty(rs.getString("STCODE"));
                }
            }

            Integer newStatusIdResolved = resolveOutgoingStatusId(conn, "NEW");
            if (newStatusIdResolved == null || newStatusIdResolved <= 0) {
                sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Не найден статус NEW для исходящих SMD (SMDSTATUS)");
                return;
            }

            int newStatusId = currentStatusId;
            boolean statusChangedToNew = false;
            if ("FAILED".equals(currentStatusCode) || "ERROR".equals(currentStatusCode)) {
                newStatusId = newStatusIdResolved;
                statusChangedToNew = true;
            }

            Integer measureId = resolveSanitaryMeasureId(conn, sanitaryMeasureCode);
            String measureName = resolveSanitaryMeasureName(conn, sanitaryMeasureCode, sanitaryMeasureName);

            conn.setAutoCommit(false);
            try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_SMDXML)) {
                Clob clob = conn.createClob();
                clob.setString(1, xmlBody);
                ps.setClob(1, clob);
                ps.setString(2, edocCode);
                ps.setString(3, edocVersion);
                ps.setLong(4, smdid);
                if (ps.executeUpdate() == 0) {
                    conn.rollback();
                    sendJsonError(response, HttpServletResponse.SC_NOT_FOUND,
                            "Запись SMDXML с SMDID " + smdid + " не найдена");
                    return;
                }
            }

            try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_SMD)) {
                ps.setInt(1, newStatusId);
                setDateOrNull(ps, 2, sanitaryMeasureStartDate);
                setDateOrNull(ps, 3, sanitaryMeasureEndDate);
                if (measureId != null && measureId > 0) {
                    ps.setInt(4, measureId);
                } else {
                    ps.setNull(4, Types.INTEGER);
                }
                setStringOrNull(ps, 5, measureName);
                setStringOrNull(ps, 6, sanitaryMeasureReasonCode);
                ps.setLong(7, smdid);
                ps.setString(8, DATASOURCE_OUTGOING);
                if (ps.executeUpdate() == 0) {
                    conn.rollback();
                    sendJsonError(response, HttpServletResponse.SC_NOT_FOUND, "Карта SMD не найдена");
                    return;
                }
            }

            if (statusChangedToNew) {
                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                    ps.setLong(1, smdid);
                    ps.setInt(2, newStatusId);
                    ps.setInt(3, userId);
                    ps.executeUpdate();
                }
            }

            conn.commit();
            transactionEnded = true;
            StringBuilder json = new StringBuilder("{\"success\":true,\"smdid\":").append(smdid);
            if (statusChangedToNew) {
                json.append(",\"newStatusId\":").append(newStatusId).append(",\"newStatus\":\"Новое\"");
            }
            json.append("}");
            response.getWriter().print(json);
        } catch (SQLException e) {
            if (conn != null && !transactionEnded) {
                try {
                    conn.rollback();
                } catch (SQLException ignored) {
                }
            }
            System.err.println("[SmdSaveServlet] Update DB error: " + e.getMessage());
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

    private static Integer resolveOutgoingStatusId(Connection conn, String statusCode) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT SMDSTATUSID FROM SMDSTATUS WHERE TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
                        + "AND UPPER(TRIM(SMDSTATUSCODE)) = ? AND SMDSTATUSACTFL = 1 AND ROWNUM = 1")) {
            ps.setString(1, DATASOURCE_OUTGOING);
            ps.setString(2, statusCode.trim().toUpperCase());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    int id = rs.getInt(1);
                    return rs.wasNull() ? null : id;
                }
            }
        }
        return null;
    }

    private static void setStringOrNull(PreparedStatement ps, int index, String value) throws SQLException {
        if (value == null || value.trim().isEmpty()) {
            ps.setNull(index, Types.VARCHAR);
        } else {
            ps.setString(index, value.trim());
        }
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

    private static String extractMeasureCodeFromXml(String xml) {
        return extractFirstXmlTagInSanitaryMeasureDetails(xml, "MeasureCode");
    }

    private static String extractMeasureNameFromXml(String xml) {
        return extractFirstXmlTagInSanitaryMeasureDetails(xml, "MeasureName");
    }

    private static String extractMeasureReasonCodeFromXml(String xml) {
        return extractFirstXmlTagInSanitaryMeasureDetails(xml, "MeasureReasonCode");
    }

    private static String extractFirstXmlTagInSanitaryMeasureDetails(String xml, String localTag) {
        if (xml == null || xml.isEmpty()) return "";
        int blockStart = xml.indexOf("SanitaryMeasureDetails");
        if (blockStart < 0) return "";
        String block = xml.substring(blockStart);
        int blockEnd = block.indexOf("</");
        if (blockEnd > 0) {
            int closeTag = block.indexOf("SanitaryMeasureDetails>", blockEnd);
            if (closeTag > 0) {
                block = block.substring(0, closeTag + "SanitaryMeasureDetails>".length());
            }
        }
        Matcher m = Pattern.compile(
                "<(?:smsdo:)?" + Pattern.quote(localTag) + "(?:\\s[^>]*)?>([^<]*)</(?:smsdo:)?" + Pattern.quote(localTag) + ">",
                Pattern.CASE_INSENSITIVE).matcher(block);
        return m.find() ? trimToEmpty(m.group(1)) : "";
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
