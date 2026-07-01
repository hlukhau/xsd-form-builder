package com.eec.servlet.smr;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.DatabaseUtil;
import com.eec.util.SmrCreateSupport;
import com.eec.util.SmrIncomingStatusHelper;
import com.eec.util.SmrOutgoingStatusHelper;
import com.eec.util.OutgoingMarkReadyAuthorityCheck;
import com.eec.util.RightsDepartmentDepKindId;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Смена статуса исходящей SMR (резолюции в SMRRESOLUTION по аналогии с DPA).
 * POST /api/smr/status — тело: {@code smrId}, {@code action}, {@code guid}.
 * Входящая (DSC=1): {@code complete_processing} — PROCESSING→PROCESSED, sanitaryMeasureOut:status ∩ SMDDEPPERMIS.
 * Исходящая (DSC=2): mark_ready, to_new (sanitaryMeasureIn:status ∩ SMDDEPPERMIS);
 * send — отдельный gate {@link SmrCreateSupport#evaluateOutgoingSmrSendGate} (NEW+областная резолюция / FAILED / ERROR).
 * mark_ready: черновик→новое+резолюция (dep0601/dep0602/dep0603 по depkindid 72/73/74); новое+районная→резолюция dep0602 без смены статуса.
 */
public class SmrStatusChangeServlet extends HttpServlet {

    private static final String SQL_CURRENT = ""
            + "SELECT d.SMRID, d.SMRSTATUSID, TRIM(st.SMRSTATUSNAME) AS STNAME, "
            + "       TRIM(UPPER(NVL(st.SMRSTATUSCODE, ''))) AS STCODE, "
            + "       TRIM(TO_CHAR(d.DATASOURCEKINDCODE)) AS DSC "
            + "FROM SMR d "
            + "LEFT JOIN SMRSTATUS st ON st.SMRSTATUSID = d.SMRSTATUSID "
            + "WHERE d.SMRID = ?";

    private static final String SQL_UPDATE = "UPDATE SMR SET SMRSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE WHERE SMRID = ?";
    private static final String SQL_INSERT_HIST = ""
            + "INSERT INTO SMRSTATUSHIST (SMRID, SMRSTATUSID, SMRSTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, ?)";
    private static final String SQL_DEPKIND_ID = ""
            + "SELECT DEPKINDID FROM TB_DEPKIND WHERE TRIM(UPPER(DEPKINDCODE)) = TRIM(UPPER(?)) "
            + "AND DEPKINDACTFL = 1 AND ROWNUM = 1";
    private static final String SQL_INSERT_RESOLUTION = ""
            + "INSERT INTO SMRRESOLUTION (SMRID, SMRSTATUSID, DEPKINDID, RESOLUTIONDATETIME, USERID) VALUES (?, ?, ?, SYSDATE, ?)";
    private static final String SQL_HAS_RESOLUTION_DEPKIND = ""
            + "SELECT 1 FROM SMRRESOLUTION WHERE SMRID = ? AND DEPKINDID = ? AND ROWNUM = 1";
    /** Районная резолюция при статусе «Новое» (для отметки готовности областным ЦГЭ). */
    private static final String SQL_HAS_DISTRICT_RESOLUTION_AT_NEW = ""
            + "SELECT 1 FROM SMRRESOLUTION WHERE SMRID = ? AND SMRSTATUSID = ? AND DEPKINDID = ? AND ROWNUM = 1";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String body = readBody(request);
        String smrIdStr = extractJsonString(body, "smrId");
        String action = extractJsonString(body, "action");
        String guid = extractJsonString(body, "guid");
        if (guid == null) guid = extractJsonStringOrNumber(body, "guid");

        if (smrIdStr == null || smrIdStr.trim().isEmpty() || action == null || action.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Нужны smrId и action");
            return;
        }
        long smrId;
        try {
            smrId = Long.parseLong(smrIdStr.trim());
        } catch (NumberFormatException e) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "smrId должен быть числом");
            return;
        }
        action = action.trim();
        if (guid != null) guid = guid.trim();

        Integer userId = resolveUserId(guid);
        if (userId == null) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Укажите guid в теле запроса (в карте прав должен быть атрибут userId)");
            return;
        }

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            if ("complete_processing".equals(action)) {
                SmrCreateSupport.GateResult inGate = SmrCreateSupport.evaluateIncomingSmrCompleteProcessingGate(conn, smrId, guid);
                if (!inGate.allowed) {
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                            inGate.reason != null ? inGate.reason : "Завершение обработки недоступно");
                    return;
                }
            } else if ("send".equals(action)) {
                SmrCreateSupport.GateResult sendGate = SmrCreateSupport.evaluateOutgoingSmrSendGate(conn, smrId, guid);
                if (!sendGate.allowed) {
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                            sendGate.reason != null ? sendGate.reason : "Направление сведений недоступно");
                    return;
                }
            } else {
                SmrCreateSupport.GateResult gate = SmrCreateSupport.evaluateOutgoingSmrStatusGate(conn, smrId, guid);
                if (!gate.allowed) {
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                            gate.reason != null ? gate.reason : "Смена статуса недоступна");
                    return;
                }
            }

            int currentStatusId;
            String currentStatusCode;
            try (PreparedStatement ps = conn.prepareStatement(SQL_CURRENT)) {
                ps.setLong(1, smrId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        sendJsonError(response, HttpServletResponse.SC_NOT_FOUND, "Карта SMR не найдена");
                        return;
                    }
                    currentStatusId = rs.getInt("SMRSTATUSID");
                    currentStatusCode = rs.getString("STCODE");
                    if (currentStatusCode == null) {
                        currentStatusCode = "";
                    }
                }
            }

            conn.setAutoCommit(false);
            try {
                if ("complete_processing".equals(action)) {
                    handleCompleteProcessing(response, conn, smrId, currentStatusCode, userId);
                } else if ("mark_ready".equals(action)) {
                    handleMarkReady(response, conn, smrId, currentStatusCode, userId, guid);
                } else if ("send".equals(action)) {
                    handleSend(response, conn, smrId, currentStatusId, currentStatusCode, userId);
                } else if ("to_new".equals(action)) {
                    handleToNew(response, conn, smrId, currentStatusId, currentStatusCode, userId);
                } else {
                    fail(conn, response, HttpServletResponse.SC_BAD_REQUEST, "Неизвестное действие: " + action);
                }
            } catch (SQLException e) {
                DatabaseUtil.rollbackQuietly(conn);
                throw e;
            }
        } catch (SQLException e) {
            DatabaseUtil.rollbackQuietly(conn);
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private void handleMarkReady(HttpServletResponse response, Connection conn, long smrId,
                                 String currentStatusCode, Integer userId, String guid)
            throws IOException, SQLException {
        String dsc = null;
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT TRIM(TO_CHAR(DATASOURCEKINDCODE)) FROM SMR WHERE SMRID = ?")) {
            ps.setLong(1, smrId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    dsc = rs.getString(1);
                }
            }
        }
        if (dsc == null || !"2".equals(dsc.trim())) {
            fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                    "Отметка готовности доступна только для исходящей карты (DATASOURCEKINDCODE=2)");
            return;
        }
        if (!"DRAFT".equals(currentStatusCode) && !"NEW".equals(currentStatusCode)) {
            fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                    "Отметка готовности возможна при статусе «Черновик» или «Новое»");
            return;
        }
        if (!OutgoingMarkReadyAuthorityCheck.ensureDprAuthorityNamePresent(conn, response, smrId)) {
            return;
        }
        Integer newStatusIdObj = SmrOutgoingStatusHelper.resolveOutgoingStatusId(conn, "NEW");
        if (newStatusIdObj == null) {
            fail(conn, response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "В справочнике SMRSTATUS не найден активный статус NEW для исходящих (DATASOURCEKINDCODE=2)");
            return;
        }
        int newStatusId = newStatusIdObj;

        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid.trim());
        Integer userRightsDepKindId = RightsDepartmentDepKindId.parseFromRights(rightsJson);
        if (userRightsDepKindId == null) {
            fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                    "Для отметки готовности в карте прав укажите department.depkindid (72 — районный ЦГЭ, 73 — областной, 74 — республиканский)");
            return;
        }

        int dep0601 = resolveDepKindId(conn, "dep0601");
        int dep0602 = resolveDepKindId(conn, "dep0602");
        int dep0603 = resolveDepKindId(conn, "dep0603");
        if (userRightsDepKindId == 72 && dep0601 <= 0) {
            fail(conn, response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "В TB_DEPKIND не найдена активная запись dep0601");
            return;
        }
        if (userRightsDepKindId == 73 && (dep0601 <= 0 || dep0602 <= 0)) {
            fail(conn, response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "В TB_DEPKIND не найдены активные записи dep0601 и dep0602");
            return;
        }
        if (userRightsDepKindId == 74 && dep0603 <= 0) {
            fail(conn, response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "В TB_DEPKIND не найдена активная запись dep0603");
            return;
        }

        boolean isDraft = "DRAFT".equals(currentStatusCode);
        boolean isNew = "NEW".equals(currentStatusCode);
        int resolutionDepKindId;
        boolean transitionDraftToNew;

        if (userRightsDepKindId == 72) {
            if (!isDraft) {
                fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                        "Отметка готовности районного ЦГЭ доступна только при статусе «Черновик»");
                return;
            }
            resolutionDepKindId = dep0601;
            transitionDraftToNew = true;
        } else if (userRightsDepKindId == 73) {
            if (isDraft) {
                resolutionDepKindId = dep0602;
                transitionDraftToNew = true;
            } else if (isNew) {
                if (!hasDistrictResolutionAtNew(conn, smrId, newStatusId, dep0601)) {
                    fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                            "Отметка готовности областного ЦГЭ при статусе «Новое» доступна при наличии резолюции районного ЦГЭ");
                    return;
                }
                resolutionDepKindId = dep0602;
                transitionDraftToNew = false;
            } else {
                fail(conn, response, HttpServletResponse.SC_BAD_REQUEST, "Отметка готовности недоступна");
                return;
            }
        } else if (userRightsDepKindId == 74) {
            if (!isDraft) {
                fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                        "Отметка готовности республиканского ЦГЭ доступна только при статусе «Черновик»");
                return;
            }
            resolutionDepKindId = dep0603;
            transitionDraftToNew = true;
        } else {
            fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                    "Отметка готовности для department.depkindid=" + userRightsDepKindId + " не предусмотрена (ожидаются 72, 73 или 74)");
            return;
        }

        if (transitionDraftToNew) {
            if (!isDraft) {
                fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                        "Внутренняя ошибка: ожидался статус «Черновик» для перевода в «Новое»");
                return;
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE)) {
                ps.setInt(1, newStatusId);
                ps.setLong(2, smrId);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                ps.setLong(1, smrId);
                ps.setInt(2, newStatusId);
                ps.setInt(3, userId);
                ps.executeUpdate();
            }
        }

        Savepoint sp = conn.setSavepoint("dpr_resolution");
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_RESOLUTION)) {
            ps.setLong(1, smrId);
            ps.setInt(2, newStatusId);
            ps.setInt(3, resolutionDepKindId);
            ps.setInt(4, userId);
            ps.executeUpdate();
        } catch (SQLException e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("ORA-00001") || msg.contains("unique") || msg.contains("Unique")) {
                conn.rollback(sp);
                conn.commit();
                response.getWriter().print("{\"ok\":true,\"newStatus\":\"Новое\",\"newStatusId\":" + newStatusId + "}");
                return;
            }
            if (msg.contains("ORA-00942") || msg.toLowerCase().contains("does not exist")) {
                conn.rollback(sp);
                conn.rollback();
                sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Таблица SMRRESOLUTION не найдена в БД. Создайте её по образцу DPARESOLUTION (SMRID, SMRSTATUSID, DEPKINDID, RESOLUTIONDATETIME, USERID).");
                return;
            }
            throw e;
        }
        conn.commit();
        response.getWriter().print("{\"ok\":true,\"newStatus\":\"Новое\",\"newStatusId\":" + newStatusId + "}");
    }

    private static boolean hasResolutionWithDepKind(Connection conn, long smrId, int depKindId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_HAS_RESOLUTION_DEPKIND)) {
            ps.setLong(1, smrId);
            ps.setInt(2, depKindId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static boolean hasDistrictResolutionAtNew(Connection conn, long smrId, int newStatusId, int districtDepKindId)
            throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_HAS_DISTRICT_RESOLUTION_AT_NEW)) {
            ps.setLong(1, smrId);
            ps.setInt(2, newStatusId);
            ps.setInt(3, districtDepKindId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private void handleSend(HttpServletResponse response, Connection conn, long smrId, int currentStatusId,
                            String currentStatusCode, Integer userId) throws IOException, SQLException {
        if ("NEW".equals(currentStatusCode)) {
            if (!SmrCreateSupport.hasRegionalResolutionForOutgoingSend(conn, smrId)) {
                fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                        "Направление при статусе «Новое» возможно только при наличии резолюции областного уровня "
                                + "(в SMRRESOLUTION запись по DEPKINDCODE dep0602 или DEPKINDID 73).");
                return;
            }
        } else if ("FAILED".equals(currentStatusCode) || "ERROR".equals(currentStatusCode)) {
            // повторная отправка без дополнительной проверки резолюции по ТЗ
        } else {
            fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                    "Направление возможно только при статусе «Новое» (с резолюцией областного уровня), "
                            + "«Отправка не удалась» или «Ошибка обработки».");
            return;
        }
        Integer pendingIdObj = SmrOutgoingStatusHelper.resolveOutgoingStatusId(conn, "PENDING");
        if (pendingIdObj == null) {
            fail(conn, response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "В справочнике SMRSTATUS не найден активный статус PENDING для исходящих (DATASOURCEKINDCODE=2)");
            return;
        }
        int pendingId = pendingIdObj;
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE SMR SET SMRSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE WHERE SMRID = ? AND SMRSTATUSID = ?")) {
            ps.setInt(1, pendingId);
            ps.setLong(2, smrId);
            ps.setInt(3, currentStatusId);
            if (ps.executeUpdate() == 0) {
                fail(conn, response, HttpServletResponse.SC_CONFLICT,
                        "Статус карты был изменён. Обновите страницу и повторите направление сведений.");
                return;
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
            ps.setLong(1, smrId);
            ps.setInt(2, pendingId);
            ps.setInt(3, userId);
            ps.executeUpdate();
        }
        conn.commit();
        response.getWriter().print("{\"ok\":true,\"newStatus\":\"Ожидает отправки\",\"newStatusId\":" + pendingId + "}");
    }

    private void handleCompleteProcessing(HttpServletResponse response, Connection conn, long smrId,
                                          String currentStatusCode, Integer userId) throws IOException, SQLException {
        if (!"PROCESSING".equals(currentStatusCode)) {
            fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                    "Завершение обработки возможно только при статусе «В обработке» (PROCESSING)");
            return;
        }
        Integer processingIdObj = SmrIncomingStatusHelper.resolveIncomingStatusId(conn, "PROCESSING");
        if (processingIdObj == null) {
            fail(conn, response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "В справочнике SMRSTATUS не найден активный статус PROCESSING для входящих (DATASOURCEKINDCODE=1)");
            return;
        }
        Integer processedIdObj = SmrIncomingStatusHelper.resolveIncomingStatusId(conn, "PROCESSED");
        if (processedIdObj == null) {
            fail(conn, response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "В справочнике SMRSTATUS не найден активный статус PROCESSED для входящих (DATASOURCEKINDCODE=1)");
            return;
        }
        int processingId = processingIdObj;
        int processedId = processedIdObj;
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE SMR SET SMRSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE WHERE SMRID = ? AND SMRSTATUSID = ?")) {
            ps.setInt(1, processedId);
            ps.setLong(2, smrId);
            ps.setInt(3, processingId);
            int updated = ps.executeUpdate();
            if (updated == 0) {
                fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                        "Карта не в статусе «В обработке» или уже обновлена другим запросом");
                return;
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
            ps.setLong(1, smrId);
            ps.setInt(2, processedId);
            ps.setInt(3, userId);
            ps.executeUpdate();
        }
        conn.commit();
        String displayName = SmrIncomingStatusHelper.resolveIncomingStatusName(conn, processedId);
        if (displayName == null) {
            displayName = "Обработано";
        }
        String esc = displayName.replace("\\", "\\\\").replace("\"", "\\\"");
        response.getWriter().print("{\"ok\":true,\"newStatus\":\"" + esc + "\",\"newStatusId\":" + processedId + "}");
    }

    private void handleToNew(HttpServletResponse response, Connection conn, long smrId, int currentStatusId,
                             String currentStatusCode, Integer userId) throws IOException, SQLException {
        if (!"FAILED".equals(currentStatusCode) && !"ERROR".equals(currentStatusCode)) {
            fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                    "Перевод в «Новое» возможен только из «Отправка не удалась» или «Ошибка обработки»");
            return;
        }
        Integer newStatusIdObj = SmrOutgoingStatusHelper.resolveOutgoingStatusId(conn, "NEW");
        if (newStatusIdObj == null) {
            fail(conn, response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "В справочнике SMRSTATUS не найден активный статус NEW для исходящих (DATASOURCEKINDCODE=2)");
            return;
        }
        int newStatusId = newStatusIdObj;
        try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE)) {
            ps.setInt(1, newStatusId);
            ps.setLong(2, smrId);
            ps.executeUpdate();
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
            ps.setLong(1, smrId);
            ps.setInt(2, newStatusId);
            ps.setInt(3, userId);
            ps.executeUpdate();
        }
        conn.commit();
        response.getWriter().print("{\"ok\":true,\"newStatus\":\"Новое\",\"newStatusId\":" + newStatusId + "}");
    }

    private static int resolveDepKindId(Connection conn, String depKindCode) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_DEPKIND_ID)) {
            ps.setString(1, depKindCode);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1);
                }
            }
        }
        return -1;
    }

    private static Integer resolveUserId(String guid) {
        if (guid == null || guid.isEmpty()) {
            return null;
        }
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid.trim());
        if (rightsJson == null) {
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

    private static String extractJsonString(String json, String field) {
        if (json == null) return null;
        Pattern p = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher m = p.matcher(json);
        if (m.find()) return m.group(1);
        return null;
    }

    private static String extractJsonStringOrNumber(String json, String field) {
        if (json == null) return null;
        Pattern pNum = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*(-?\\d+)");
        Matcher m2 = pNum.matcher(json);
        if (m2.find()) return m2.group(1);
        return extractJsonString(json, field);
    }

    private static void fail(Connection conn, HttpServletResponse response, int status, String msg) throws IOException {
        DatabaseUtil.rollbackQuietly(conn);
        sendJsonError(response, status, msg);
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        if (response.isCommitted()) {
            return;
        }
        response.setStatus(status);
        String escaped = message != null ? message.replace("\\", "\\\\").replace("\"", "\\\"") : "Unknown error";
        response.getWriter().print("{\"error\":\"" + escaped + "\"}");
    }
}
