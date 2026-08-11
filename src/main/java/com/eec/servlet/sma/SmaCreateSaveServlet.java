package com.eec.servlet.sma;

import com.eec.util.DatabaseUtil;
import com.eec.util.SmaCreateSupport;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Base64;

/**
 * Первое сохранение карты SMAQ/SMAR.
 * POST /api/sma/create-save
 */
public class SmaCreateSaveServlet extends HttpServlet {

    private static final String SQL_NEXT_SMAQID = "SELECT sqsmaq.NEXTVAL AS N FROM DUAL";
    private static final String SQL_NEXT_SMARID = "SELECT sqsmar.NEXTVAL AS N FROM DUAL";

    private static final String SQL_NEXT_SMAQ_VERSION = ""
            + "SELECT NVL(MAX(SMAQVERSION), 0) + 1 AS N FROM SMAQ WHERE SMDID = ?";

    static final String SQL_INSERT_SMAQ = ""
            + "INSERT INTO SMAQ (SMAQID, SMDID, DOCID, DATASOURCEKINDCODE, SMAQSTATUSID, "
            + "CREATIONDATETIME, MODIFICATIONDATETIME, REQUESTCOUNTRYID, SMAQVERSION, AUTHORITYID) "
            + "VALUES (?, ?, ?, 2, ?, SYSDATE, SYSDATE, ?, ?, ?)";

    private static final String SQL_INSERT_SMAQ_NO_AUTH = ""
            + "INSERT INTO SMAQ (SMAQID, SMDID, DOCID, DATASOURCEKINDCODE, SMAQSTATUSID, "
            + "CREATIONDATETIME, MODIFICATIONDATETIME, REQUESTCOUNTRYID, SMAQVERSION) "
            + "VALUES (?, ?, ?, 2, ?, SYSDATE, SYSDATE, ?, ?)";

    private static final String SQL_INSERT_SMAQ_MIN = ""
            + "INSERT INTO SMAQ (SMAQID, SMDID, DATASOURCEKINDCODE, SMAQSTATUSID, "
            + "CREATIONDATETIME, MODIFICATIONDATETIME, REQUESTCOUNTRYID, SMAQVERSION) "
            + "VALUES (?, ?, 2, ?, SYSDATE, SYSDATE, ?, ?)";

    private static final String SQL_INSERT_SMAR = ""
            + "INSERT INTO SMAR (SMARID, SMAQID, DATASOURCEKINDCODE, SMARSTATUSID, "
            + "CREATIONDATETIME, MODIFICATIONDATETIME, SMARVERSION, RESPONSECOUNTRYID) "
            + "VALUES (?, ?, 2, ?, SYSDATE, SYSDATE, 1, ?)";

    private static final String SQL_INSERT_SMAR_NO_RESP_COUNTRY = ""
            + "INSERT INTO SMAR (SMARID, SMAQID, DATASOURCEKINDCODE, SMARSTATUSID, "
            + "CREATIONDATETIME, MODIFICATIONDATETIME, SMARVERSION) "
            + "VALUES (?, ?, 2, ?, SYSDATE, SYSDATE, 1)";

    private static final String SQL_INSERT_SMAQXML = ""
            + "INSERT INTO SMAQXML (SMAQID, SMAQXMLBODY, EDOCCODE, EDOCVERSION) VALUES (?, ?, ?, ?)";

    private static final String SQL_INSERT_SMARXML = ""
            + "INSERT INTO SMARXML (SMARID, SMARXMLBODY, EDOCCODE, EDOCVERSION) VALUES (?, ?, ?, ?)";

    private static final String SQL_INSERT_SMAQ_HIST = ""
            + "INSERT INTO SMAQSTATUSHIST (SMAQID, SMAQSTATUSID, SMAQSTATUSDATETIME, USERID) "
            + "VALUES (?, ?, SYSDATE, ?)";

    private static final String SQL_INSERT_SMAR_HIST = ""
            + "INSERT INTO SMARSTATUSHIST (SMARID, SMARSTATUSID, SMARSTATUSDATETIME, USERID) "
            + "VALUES (?, ?, SYSDATE, ?)";

    private static final String EDOC_VERSION_INFO = "1.0.0";
    private static final String EDOC_VERSION_ABSENT = "1.0.7";
    private static final String EDOC_SMAQ = "R.SM.SS.09.002";
    private static final String EDOC_SMAR_INFO = "R.SM.SS.09.002";
    private static final String EDOC_SMAR_ABSENT = "R.006";

    private static String edocVersionFor(String edocCode) {
        return EDOC_SMAR_ABSENT.equals(edocCode) ? EDOC_VERSION_ABSENT : EDOC_VERSION_INFO;
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String body = SmaServletUtil.readBody(request);
        String guid = SmaServletUtil.jsonStringField(body, "guid");
        SmaCardKind kind = SmaServletUtil.parseKindFromJson(body);
        if (guid == null || guid.isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid в теле запроса");
            return;
        }
        if (kind == null) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите kind: smaq или smar");
            return;
        }

        String smaXmlB64 = SmaServletUtil.jsonStringField(body, "smaXmlB64");
        String authorityId = SmaServletUtil.jsonStringField(body, "authorityId");
        String authorityName = SmaServletUtil.jsonStringField(body, "authorityName");
        String authorityBriefName = SmaServletUtil.jsonStringField(body, "authorityBriefName");
        String descriptionText = SmaServletUtil.jsonStringField(body, "descriptionText");
        String responseKind = SmaServletUtil.jsonStringField(body, "responseKind");

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            if (kind == SmaCardKind.SMAQ) {
                handleSmaqCreate(response, conn, body, guid, smaXmlB64, authorityId, authorityName,
                        authorityBriefName, descriptionText);
            } else {
                handleSmarCreate(response, conn, body, guid, smaXmlB64, authorityId, authorityName,
                        authorityBriefName, descriptionText, responseKind);
            }
        } catch (IOException e) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
        } catch (SQLException e) {
            handleSqlError(response, conn, e, kind);
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private void handleSmaqCreate(HttpServletResponse response, Connection conn,
                                  String body, String guid, String smaXmlB64, String authorityId,
                                  String authorityName, String authorityBriefName, String descriptionText)
            throws SQLException, IOException {
        String smdidStr = SmaServletUtil.jsonStringField(body, "smdid");
        if (smdidStr == null || smdidStr.isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите smdid в теле запроса");
            return;
        }
        long smdid = Long.parseLong(smdidStr.trim());
        SmaCreateSupport.GateResult gate = SmaCreateSupport.evaluateSmaqCreateGate(conn, smdid, guid);
        if (!gate.allowed) {
            sendErr(response, HttpServletResponse.SC_FORBIDDEN,
                    gate.reason != null ? gate.reason : "Создание карты SMAQ недоступно");
            return;
        }
        Integer userId = SmaServletUtil.getUserIdFromRightsByGuid(guid);
        if (userId == null) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST,
                    "В карте прав доступа укажите атрибут userId (для записи SMAQSTATUSHIST)");
            return;
        }
        if (authorityName == null || authorityName.trim().isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Заполните наименование уполномоченного органа");
            return;
        }
        if (descriptionText == null || descriptionText.trim().isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Заполните описание запроса");
            return;
        }
        Integer resolvedAuthorityId = com.eec.util.SmrAuthorityDbSupport.resolveAuthorityId(conn, authorityId);
        if (resolvedAuthorityId == null) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Выберите уполномоченный орган (не удалось определить AUTHORITYID для SMAQ.AUTHORITYID)");
            return;
        }

        long smaqId = nextId(conn, SQL_NEXT_SMAQID, "sqsmaq");
        int smaqVersion = resolveNextSmaqVersion(conn, smdid);
        String xml;
        if (smaXmlB64 != null && !smaXmlB64.trim().isEmpty()) {
            xml = decodeXmlB64(smaXmlB64);
        } else {
            xml = SmaDraftXmlBuilder.buildSmaqDraftXml(gate.docCountryCode, gate.docId, gate.docCreationDate,
                    authorityId, authorityName, authorityBriefName, descriptionText);
        }

        conn.setAutoCommit(false);
        try {
            insertSmaq(conn, smaqId, smdid, gate.docId, gate.draftStatusId, gate.requestCountryId, smaqVersion,
                    resolvedAuthorityId);
            // Гарантируем AUTHORITYID даже если INSERT шёл без колонки / с fallback.
            com.eec.util.SmrAuthorityDbSupport.updateSmaqAuthorityId(conn, smaqId, resolvedAuthorityId);
            insertXml(conn, true, smaqId, xml, EDOC_SMAQ);
            insertHist(conn, true, smaqId, gate.draftStatusId, userId);
            conn.commit();
        } catch (SQLException e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(true);
        }

        writeOk(response, SmaCardKind.SMAQ, smaqId);
    }

    private void handleSmarCreate(HttpServletResponse response, Connection conn,
                                  String body, String guid, String smaXmlB64, String authorityId,
                                  String authorityName, String authorityBriefName, String descriptionText,
                                  String responseKind)
            throws SQLException, IOException {
        String smaqidStr = SmaServletUtil.jsonStringField(body, "smaqid");
        if (smaqidStr == null || smaqidStr.isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите smaqid в теле запроса");
            return;
        }
        long smaqid = Long.parseLong(smaqidStr.trim());
        SmaCreateSupport.GateResult gate = SmaCreateSupport.evaluateSmarCreateGate(conn, smaqid, guid);
        if (!gate.allowed) {
            sendErr(response, HttpServletResponse.SC_FORBIDDEN,
                    gate.reason != null ? gate.reason : "Создание карты SMAR недоступно");
            return;
        }
        Integer userId = SmaServletUtil.getUserIdFromRightsByGuid(guid);
        if (userId == null) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST,
                    "В карте прав доступа укажите атрибут userId (для записи SMARSTATUSHIST)");
            return;
        }

        boolean absent = "absent".equalsIgnoreCase(trim(responseKind));
        long smarId = nextId(conn, SQL_NEXT_SMARID, "sqsmar");
        String edocCode = absent ? EDOC_SMAR_ABSENT : EDOC_SMAR_INFO;
        String xml;
        if (smaXmlB64 != null && !smaXmlB64.trim().isEmpty()) {
            xml = decodeXmlB64(smaXmlB64);
        } else if (absent) {
            xml = SmaDraftXmlBuilder.buildSmarAbsentDraftXml(descriptionText);
        } else {
            xml = SmaDraftXmlBuilder.buildSmarInfoDraftXml(gate.docCountryCode, gate.docId, gate.docCreationDate,
                    authorityId, authorityName, authorityBriefName, descriptionText);
        }

        conn.setAutoCommit(false);
        try {
            insertSmar(conn, smarId, smaqid, gate.draftStatusId, gate.requestCountryId);
            insertXml(conn, false, smarId, xml, edocCode);
            insertHist(conn, false, smarId, gate.draftStatusId, userId);
            conn.commit();
        } catch (SQLException e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(true);
        }

        writeOk(response, SmaCardKind.SMAR, smarId);
    }

    private static void insertSmar(Connection conn, long smarId, long smaqid, int statusId,
                                   long responseCountryId) throws SQLException {
        if (responseCountryId > 0) {
            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_SMAR)) {
                ps.setLong(1, smarId);
                ps.setLong(2, smaqid);
                ps.setInt(3, statusId);
                ps.setLong(4, responseCountryId);
                ps.executeUpdate();
                return;
            } catch (SQLException e) {
                String m = e.getMessage() != null ? e.getMessage() : "";
                if (!m.contains("ORA-00904")) {
                    throw e;
                }
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_SMAR_NO_RESP_COUNTRY)) {
            ps.setLong(1, smarId);
            ps.setLong(2, smaqid);
            ps.setInt(3, statusId);
            ps.executeUpdate();
        }
    }

    private static long nextId(Connection conn, String sql, String seqName) throws SQLException, IOException {
        try (PreparedStatement ps = conn.prepareStatement(sql); ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) {
                throw new SQLException("Не удалось получить ID из последовательности " + seqName);
            }
            return rs.getLong("N");
        }
    }

    private static String decodeXmlB64(String smaXmlB64) throws IOException {
        try {
            String xml = new String(Base64.getDecoder().decode(smaXmlB64.trim()), StandardCharsets.UTF_8);
            if (xml.trim().isEmpty() || !SmaServletUtil.isValidSmaXmlBody(xml)) {
                throw new IOException(
                        "В smaXmlB64 ожидается полный XML документа (корень AdditionalInfoDetails или ProcessingResultDetails)");
            }
            return xml;
        } catch (IllegalArgumentException e) {
            throw new IOException("Некорректный Base64 в smaXmlB64");
        }
    }

    private static int resolveNextSmaqVersion(Connection conn, long smdid) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_NEXT_SMAQ_VERSION)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    int n = rs.getInt("N");
                    return rs.wasNull() || n < 1 ? 1 : n;
                }
            }
        }
        return 1;
    }

    private static void insertSmaq(Connection conn, long smaqId, long smdid, String docId,
                                     int statusId, long requestCountryId, int smaqVersion,
                                     Integer authorityId) throws SQLException {
        if (authorityId != null) {
            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_SMAQ)) {
                ps.setLong(1, smaqId);
                ps.setLong(2, smdid);
                ps.setString(3, docId);
                ps.setInt(4, statusId);
                ps.setLong(5, requestCountryId);
                ps.setInt(6, smaqVersion);
                ps.setInt(7, authorityId);
                ps.executeUpdate();
                return;
            } catch (SQLException e) {
                String m = e.getMessage() != null ? e.getMessage() : "";
                if (!m.contains("ORA-00904")) {
                    throw e;
                }
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_SMAQ_NO_AUTH)) {
            ps.setLong(1, smaqId);
            ps.setLong(2, smdid);
            ps.setString(3, docId);
            ps.setInt(4, statusId);
            ps.setLong(5, requestCountryId);
            ps.setInt(6, smaqVersion);
            ps.executeUpdate();
        } catch (SQLException e) {
            String m = e.getMessage() != null ? e.getMessage() : "";
            if (!m.contains("ORA-00904")) {
                throw e;
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_SMAQ_MIN)) {
                ps.setLong(1, smaqId);
                ps.setLong(2, smdid);
                ps.setInt(3, statusId);
                ps.setLong(4, requestCountryId);
                ps.setInt(5, smaqVersion);
                ps.executeUpdate();
            }
        }
    }

    private static void insertXml(Connection conn, boolean smaq, long id, String xml, String edocCode)
            throws SQLException {
        String sql = smaq ? SQL_INSERT_SMAQXML : SQL_INSERT_SMARXML;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            ps.setString(2, xml);
            ps.setString(3, edocCode);
            ps.setString(4, edocVersionFor(edocCode));
            ps.executeUpdate();
        } catch (SQLException e) {
            String m = e.getMessage() != null ? e.getMessage() : "";
            if (!m.contains("ORA-00904")) {
                throw e;
            }
            String fallback = smaq
                    ? "INSERT INTO SMAQXML (SMAQID, SMAQXMLBODY) VALUES (?, ?)"
                    : "INSERT INTO SMARXML (SMARID, SMARXMLBODY) VALUES (?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(fallback)) {
                ps.setLong(1, id);
                ps.setString(2, xml);
                ps.executeUpdate();
            }
        }
    }

    private static void insertHist(Connection conn, boolean smaq, long id, int statusId, int userId)
            throws SQLException {
        String sql = smaq ? SQL_INSERT_SMAQ_HIST : SQL_INSERT_SMAR_HIST;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            ps.setInt(2, statusId);
            ps.setInt(3, userId);
            ps.executeUpdate();
        }
    }

    private static void writeOk(HttpServletResponse response, SmaCardKind kind, long id) throws IOException {
        PrintWriter out = response.getWriter();
        response.setStatus(HttpServletResponse.SC_OK);
        String field = kind == SmaCardKind.SMAQ ? "smaqId" : "smarId";
        out.print("{\"" + field + "\":" + id + ",\"kind\":" + SmaServletUtil.quote(kind.apiName()) + "}");
        out.flush();
    }

    private static void handleSqlError(HttpServletResponse response, Connection conn, SQLException e,
                                       SmaCardKind kind) throws IOException {
        try {
            if (conn != null && !conn.getAutoCommit()) {
                conn.rollback();
            }
        } catch (SQLException ignored) {
        }
        String msg = e.getMessage() != null ? e.getMessage() : "Ошибка БД";
        String seq = kind == SmaCardKind.SMAR ? "sqsmar" : "sqsmaq";
        if (msg.contains("ORA-02289")) {
            sendErr(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "Последовательность " + seq + " не найдена в БД (ORA-02289).");
        } else if (msg.contains("ORA-00001") && msg.contains("SMAQ_UK1")) {
            sendErr(response, HttpServletResponse.SC_CONFLICT,
                    "Запрос дополнительных сведений с такой версией для данной карты SMD уже существует (SMAQ_UK1).");
        } else {
            sendErr(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка сохранения: " + msg);
        }
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

    private static void sendErr(HttpServletResponse response, int status, String msg) throws IOException {
        response.setStatus(status);
        PrintWriter out = response.getWriter();
        out.print("{\"error\":" + SmaServletUtil.quote(msg) + "}");
        out.flush();
    }
}
