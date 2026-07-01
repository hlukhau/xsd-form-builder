package com.eec.servlet.smr;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.DatabaseUtil;
import com.eec.util.SmrCreateSupport;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Первое сохранение черновика SMR (ответ на входящую SMD) в одной транзакции: SMR, SMRXML, SMRSTATUSHIST.
 * POST /api/smr/create-save
 * Тело JSON: {@code guid}, {@code smdid}; опционально {@code smrXmlB64} (полный XML UTF-8 в Base64),
 * иначе минимальный черновик по {@code authorityId}, {@code authorityName}, {@code authorityBriefName}, {@code descriptionText}.
 */
public class SmrCreateSaveServlet extends HttpServlet {

    private static final String SQL_NEXT_SMRID = "SELECT sqsmr.NEXTVAL AS N FROM DUAL";

    private static final String SQL_INSERT_SMR = ""
            + "INSERT INTO SMR (SMRID, SMDID, DOCID, DATASOURCEKINDCODE, SMRSTATUSID, "
            + "CREATIONDATETIME, MODIFICATIONDATETIME, RESPONSECOUNTRYID, SMRVERSION) "
            + "VALUES (?, ?, ?, 2, ?, SYSDATE, SYSDATE, ?, 1)";

    private static final String SQL_INSERT_DPR_MIN = ""
            + "INSERT INTO SMR (SMRID, SMDID, DATASOURCEKINDCODE, SMRSTATUSID, "
            + "CREATIONDATETIME, MODIFICATIONDATETIME, RESPONSECOUNTRYID, SMRVERSION) "
            + "VALUES (?, ?, 2, ?, SYSDATE, SYSDATE, ?, 1)";

    private static final String SQL_INSERT_SMRXML = "INSERT INTO SMRXML (SMRID, SMRXMLBODY) VALUES (?, ?)";

    private static final String SQL_INSERT_HIST = ""
            + "INSERT INTO SMRSTATUSHIST (SMRID, SMRSTATUSID, SMRSTATUSDATETIME, USERID) "
            + "VALUES (?, ?, SYSDATE, ?)";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String body = readBody(request);
        String guid = jsonStringField(body, "guid");
        String smdidStr = jsonStringField(body, "smdid");
        if (guid == null || guid.isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid в теле запроса");
            return;
        }
        if (smdidStr == null || smdidStr.isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите smdid в теле запроса");
            return;
        }
        long smdid;
        try {
            smdid = Long.parseLong(smdidStr.trim());
        } catch (NumberFormatException e) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный smdid");
            return;
        }

        String smrXmlB64 = jsonStringField(body, "smrXmlB64");
        String authorityId = jsonStringField(body, "authorityId");
        String authorityName = jsonStringField(body, "authorityName");
        String authorityBriefName = jsonStringField(body, "authorityBriefName");
        String descriptionText = jsonStringField(body, "descriptionText");

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            SmrCreateSupport.GateResult gate = SmrCreateSupport.evaluateGate(conn, smdid, guid);
            if (!gate.allowed) {
                sendErr(response, HttpServletResponse.SC_FORBIDDEN, gate.reason != null ? gate.reason : "Создание карты SMR недоступно");
                return;
            }

            Integer userId = getUserIdFromRightsByGuid(guid);
            if (userId == null) {
                sendErr(response, HttpServletResponse.SC_BAD_REQUEST,
                        "В карте прав доступа укажите атрибут userId (для записи SMRSTATUSHIST)");
                return;
            }

            long smrId;
            try (PreparedStatement ps = conn.prepareStatement(SQL_NEXT_SMRID); ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    sendErr(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Не удалось получить SMRID из последовательности sqsmr");
                    return;
                }
                smrId = rs.getLong("N");
            }

            String xml;
            if (smrXmlB64 != null && !smrXmlB64.trim().isEmpty()) {
                try {
                    xml = new String(Base64.getDecoder().decode(smrXmlB64.trim()), StandardCharsets.UTF_8);
                } catch (IllegalArgumentException e) {
                    sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный Base64 в smrXmlB64");
                    return;
                }
                if (xml.trim().isEmpty() || !xml.contains("SanitaryMeasureConsiderationDetails")) {
                    sendErr(response, HttpServletResponse.SC_BAD_REQUEST,
                            "В smrXmlB64 ожидается полный XML документа SMR (корень SanitaryMeasureConsiderationDetails)");
                    return;
                }
            } else {
                xml = SmrDraftXmlBuilder.buildDraftXml(
                        gate.docId,
                        gate.docCountryCode,
                        gate.messageCode,
                        gate.docCreationDate,
                        authorityId,
                        authorityName,
                        authorityBriefName,
                        descriptionText
                );
            }

            conn.setAutoCommit(false);
            try {
                insertDprWithOptionalIncident(conn, smrId, smdid, gate.docId, gate.draftSmrStatusId,
                        gate.responseCountryId);
                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_SMRXML)) {
                    ps.setLong(1, smrId);
                    ps.setString(2, xml);
                    ps.executeUpdate();
                }
                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                    ps.setLong(1, smrId);
                    ps.setInt(2, gate.draftSmrStatusId);
                    ps.setInt(3, userId);
                    ps.executeUpdate();
                }
                conn.commit();
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(true);
            }

            PrintWriter out = response.getWriter();
            response.setStatus(HttpServletResponse.SC_OK);
            out.print("{\"smrId\":" + smrId + "}");
            out.flush();
        } catch (SQLException e) {
            try {
                if (conn != null && !conn.getAutoCommit()) {
                    conn.rollback();
                }
            } catch (SQLException ignored) {
            }
            String msg = e.getMessage() != null ? e.getMessage() : "Ошибка БД";
            if (msg.contains("ORA-02289")) {
                sendErr(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Последовательность sqsmr не найдена в БД (ORA-02289). Создайте sequence sqsmr.");
            } else if (msg.contains("ORA-00904")) {
                sendErr(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Ошибка схемы БД (несовпадение имён колонок таблицы SMR). Детали: " + msg);
            } else {
                sendErr(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка сохранения: " + msg);
            }
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static void insertDprWithOptionalIncident(Connection conn, long smrId, long smdid, String docId,
                                                      int draftStatusId, long responseCountryId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_SMR)) {
            ps.setLong(1, smrId);
            ps.setLong(2, smdid);
            ps.setString(3, docId);
            ps.setInt(4, draftStatusId);
            ps.setLong(5, responseCountryId);
            ps.executeUpdate();
        } catch (SQLException e) {
            String m = e.getMessage() != null ? e.getMessage() : "";
            if (!m.contains("ORA-00904")) {
                throw e;
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_DPR_MIN)) {
                ps.setLong(1, smrId);
                ps.setLong(2, smdid);
                ps.setInt(3, draftStatusId);
                ps.setLong(4, responseCountryId);
                ps.executeUpdate();
            }
        }
    }

    private static Integer getUserIdFromRightsByGuid(String guid) {
        if (guid == null || guid.isEmpty()) {
            return null;
        }
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid.trim());
        if (rightsJson == null || rightsJson.isEmpty()) {
            return null;
        }
        Matcher m = Pattern.compile("\"userId\"\\s*:\\s*(-?\\d+)").matcher(rightsJson);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        m = Pattern.compile("\"userId\"\\s*:\\s*\"(-?\\d+)\"").matcher(rightsJson);
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
        try (BufferedReader r = request.getReader()) {
            char[] buf = new char[8192];
            int n;
            while ((n = r.read(buf)) >= 0) {
                sb.append(buf, 0, n);
            }
        }
        return sb.toString();
    }

    private static String jsonStringField(String json, String field) {
        if (json == null) {
            return null;
        }
        Pattern p = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher m = p.matcher(json);
        if (m.find()) {
            return m.group(1);
        }
        Pattern pNum = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*(-?\\d+)");
        Matcher m2 = pNum.matcher(json);
        if (m2.find()) {
            return m2.group(1);
        }
        return null;
    }

    private static void sendErr(HttpServletResponse response, int status, String msg) throws IOException {
        response.setStatus(status);
        PrintWriter out = response.getWriter();
        out.print("{\"error\":" + quote(msg) + "}");
        out.flush();
    }

    private static String quote(String s) {
        if (s == null) {
            return "null";
        }
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }
}
