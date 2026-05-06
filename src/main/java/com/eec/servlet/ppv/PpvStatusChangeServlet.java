package com.eec.servlet.ppv;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.AccessRightService;
import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.BufferedReader;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.sql.Types;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Смена статуса карты PPV.
 * Входящие: action first_open | complete_processing | close;
 * first_open — Получено→В обработке при открытии карты; права не проверяются (оператор сразу видит «В обработке»).
 * complete_processing | close — право violationDetectedIn:status и пересечение DEPID с PPVDEPPERMIS;
 * complete_processing — текущий статус PROCESSING (PPVSTATUSCODE), целевой PROCESSED.
 * GET /api/ppv/status?preview=incoming_complete&dpaid=...&guid=... — { reviewOutcomeSent } для диалога подтверждения.
 * Исходящие: action mark_ready | send | close; mark_ready/close — violationDetectedOut:status, send — violationDetectedOut:send.
 * mark_ready: тело { "dpaid", "action": "mark_ready", "depKindCode": "dep0601"|"dep0602"|"dep0603" }.
 * Обновляется PPV.PPVSTATUSID, PPVSTATUSHIST (и при mark_ready — PPVRESOLUTION).
 */
public class PpvStatusChangeServlet extends HttpServlet {

    private static final int INCOMING_RECEIVED = 1;
    private static final int INCOMING_COMPLETED = 4;
    private static final String DATASOURCEKIND_INCOMING = "1";
    private static final String DATASOURCEKIND_OUTGOING = "2";
    private static final int OUTGOING_DRAFT = 5;
    private static final int OUTGOING_NEW = 6;
    private static final int OUTGOING_PENDING = 7;
    private static final int OUTGOING_FAILED = 9;
    private static final int OUTGOING_ERROR = 10;
    private static final int OUTGOING_DELIVERED = 11;
    private static final int OUTGOING_EDITED = 12;
    private static final int OUTGOING_COMPLETED = 13;

    /** Текущее состояние: PPVID, PPVSTATUSID, PPVSTATUSNAME, источник */
    private static final String SQL_CURRENT = ""
            + "SELECT vw.PPVID, vw.PPVSTATUSID, vw.PPVSTATUSNAME, t.DATASOURCEKINDNAME, vw.DATASOURCEKINDCODE "
            + "FROM VW_PPV vw "
            + "LEFT JOIN DATASOURCEKIND t ON vw.DATASOURCEKINDCODE = t.DATASOURCEKINDCODE "
            + "WHERE vw.PPVID = ?";
    /** PPVSTATUSID по названию статуса */
    private static final String SQL_STATUS_ID = "SELECT PPVSTATUSID FROM PPVSTATUS WHERE TRIM(PPVSTATUSNAME) = ?";
    private static final String SQL_UPDATE = "UPDATE PPV SET PPVSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE WHERE PPVID = ?";
    private static final String SQL_INSERT_HIST = ""
            + "INSERT INTO PPVSTATUSHIST (PPVID, PPVSTATUSID, PPVSTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, ?)";
    /** DEPKINDID по DEPKINDCODE (TB_DEPKIND) */
    private static final String SQL_DEPKIND_ID = "SELECT DEPKINDID FROM TB_DEPKIND WHERE TRIM(UPPER(DEPKINDCODE)) = TRIM(UPPER(?))";
    /** DEPKINDCODE по DEPKINDID (DEPKINDID из карты прав: department.depkindid) */
    private static final String SQL_DEPKINDCODE_BY_DEPKINDID = "SELECT DEPKINDCODE FROM TB_DEPKIND WHERE DEPKINDID = ?";
    /** Вставка резолюции (для mark_ready). PPVSTATUSID — статус карты после наложения резолюции (Новое). При дубликате (PPVID,DEPKINDID) — игнорируем. */
    private static final String SQL_INSERT_RESOLUTION = ""
            + "INSERT INTO PPVRESOLUTION (PPVID, PPVSTATUSID, DEPKINDID, RESOLUTIONDATETIME, USERID) VALUES (?, ?, ?, SYSDATE, ?)";
    /** Есть ли резолюция областного или республиканского ЦГЭ (для разрешения «Направление сведений» при статусе Новое). */
    private static final String SQL_HAS_REGIONAL_OR_REPUBLICAN_RESOLUTION = ""
            + "SELECT 1 FROM PPVRESOLUTION r "
            + "JOIN TB_DEPKIND dk ON r.DEPKINDID = dk.DEPKINDID "
            + "WHERE r.PPVID = ? AND UPPER(TRIM(dk.DEPKINDCODE)) IN ('DEP0602','DEP0603') AND ROWNUM = 1";
    /** Есть ли резолюция районного ЦГЭ (DEP0601) по карте. */
    private static final String SQL_HAS_DISTRICT_RESOLUTION = ""
            + "SELECT 1 FROM PPVRESOLUTION r "
            + "JOIN TB_DEPKIND dk ON r.DEPKINDID = dk.DEPKINDID "
            + "WHERE r.PPVID = ? AND UPPER(TRIM(dk.DEPKINDCODE)) = 'DEP0601' AND ROWNUM = 1";
    /** PARENTDEPID по иерархии OS (Организационная структура) для подразделения — для отметки готовности районным ЦГЭ. */
    private static final String SQL_PARENT_DEPID_OS = ""
            + "SELECT dp.PARENTDEPID FROM TB_DEPLINK dp "
            + "JOIN (SELECT CLASVALID FROM TB_CLASVAL WHERE CLASCODE = 'DEPLINKTYPE' AND CLASVALCODE = 'OS') dpl ON dpl.CLASVALID = dp.DEPLINKTYPEID "
            + "WHERE dp.DEPID = ? AND dp.DEPLINKACTFL = 1 AND ROWNUM = 1";
    /** DEPID республиканского ЦГЭ (006) — для отметки готовности областным ЦГЭ. */
    private static final String SQL_DEPID_BY_DEPCODE_006 = "SELECT DEPID FROM TB_DEP WHERE TRIM(DEPCODE) = '006' AND ROWNUM = 1";
    private static final String SQL_INSERT_PPVDEPPERMIS = "INSERT INTO PPVDEPPERMIS (PPVID, DEPID, GRANTDATETIME) VALUES (?, ?, SYSDATE)";
    private static final String SQL_EXISTS_DEP = "SELECT 1 FROM TB_DEP WHERE DEPID = ?";
    private static final String SQL_EXISTS_PPVDEPPERMIS_ACTIVE = ""
            + "SELECT 1 FROM PPVDEPPERMIS WHERE PPVID = ? AND DEPID = ? AND REVOKEDATETIME IS NULL";

    /** PPVSTATUSID по коду статуса для входящих (DATASOURCEKINDCODE=1). */
    private static final String SQL_STATUS_ID_BY_CODE_INCOMING = ""
            + "SELECT PPVSTATUSID FROM PPVSTATUS "
            + "WHERE TRIM(UPPER(PPVSTATUSCODE)) = TRIM(UPPER(?)) "
            + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
            + "AND PPVSTATUSACTFL = 1 AND ROWNUM = 1";

    private static final String SQL_PPVDEPPERMIS_DEPIDS = ""
            + "SELECT DEPID FROM PPVDEPPERMIS WHERE PPVID = ? AND REVOKEDATETIME IS NULL";

    /** Ответ адресата (связанный ЭД): EDOCID заполнен — результат рассмотрения считается отправленным. */
    private static final String PPV_ACTOR_CODE_REVIEW = "P.SS.08.ACT.005";
    private static final String SQL_REVIEW_OUTCOME_SENT = ""
            + "SELECT 1 FROM PPVACTOR a WHERE a.PPVID = ? AND a.PPVACTORACTFL = 1 "
            + "AND TRIM(a.ACTORCODE) = ? AND a.EDOCID IS NOT NULL "
            + "AND LENGTH(TRIM(TO_CHAR(a.EDOCID))) > 0 AND ROWNUM = 1";

    private static final String SQL_STATUS_NAME_BY_ID = "SELECT TRIM(PPVSTATUSNAME) FROM PPVSTATUS WHERE PPVSTATUSID = ?";

    /** Как в PpvMetadataServlet: только строка в RECEIVED переходит в PROCESSING. */
    private static final String SQL_UPDATE_INCOMING_RECEIVED_TO_PROCESSING = ""
            + "UPDATE PPV SET PPVSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE "
            + "WHERE PPVID = ? AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = '1' AND PPVSTATUSID = ?";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setHeader("Access-Control-Allow-Origin", "*");
        if (!"incoming_complete".equals(request.getParameter("preview"))) {
            response.sendError(HttpServletResponse.SC_METHOD_NOT_ALLOWED);
            return;
        }
        String dpaid = request.getParameter("dpaid");
        String guid = request.getParameter("guid");
        if (guid != null) guid = guid.trim();
        if (guid != null && guid.isEmpty()) guid = null;
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        if (dpaid == null || dpaid.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Нужен параметр dpaid");
            return;
        }
        long ppvid;
        try {
            ppvid = Long.parseLong(dpaid.trim());
            if (ppvid <= 0) throw new NumberFormatException();
        } catch (NumberFormatException e) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "dpaid должен быть положительным числом");
            return;
        }
        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            boolean sent = isReviewOutcomeSent(conn, ppvid);
            PrintWriter out = response.getWriter();
            out.print("{\"reviewOutcomeSent\":" + sent + "}");
            out.flush();
        } catch (SQLException e) {
            log("PpvStatusChange GET preview: " + e.getMessage());
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        request.setCharacterEncoding("UTF-8");
        String body = readBody(request);
        String dpaid = extractJsonString(body, "dpaid");
        String action = extractJsonString(body, "action");
        String depKindCode = extractJsonString(body, "depKindCode");
        String guid = extractJsonString(body, "guid");
        if (guid == null) guid = extractJsonStringOrNumber(body, "guid");
        if (guid == null) guid = extractJsonString(body, "GUID");
        if (guid == null) guid = extractJsonStringOrNumber(body, "GUID");
        log("[PpvStatusChange] request: dpaid=" + dpaid + ", action=" + action + ", guid=" + (guid != null ? guid : "null") + ", depKindCode=" + (depKindCode != null ? depKindCode : "null"));
        if (dpaid == null || dpaid.trim().isEmpty() || action == null || action.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Нужны dpaid и action");
            return;
        }
        dpaid = dpaid.trim();
        action = action.trim();
        if (depKindCode != null) depKindCode = depKindCode.trim();
        if (guid != null) guid = guid.trim();

        /** JSON прав по GUID — violationDetectedIn:status / violationDetectedOut:status (не путать с PPVID). */
        String rightsJson = (guid != null && !guid.isEmpty()) ? RightsRegistryProvider.get().getRightsJson(guid) : null;

        Integer userId = resolveUserId(guid);
        log("[PpvStatusChange] userId from rights: " + (userId != null ? userId : "null") + (guid != null ? " (guid=" + guid + ")" : ""));

        long dpaidNum;
        try {
            dpaidNum = Long.parseLong(dpaid);
            if (dpaidNum <= 0) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "dpaid должен быть положительным числом");
                return;
            }
        } catch (NumberFormatException e) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "dpaid должен быть числом (идентификатор сохранённой карты)");
            return;
        }

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            conn.setAutoCommit(false);
            int currentStatusId = -1;
            String currentStatusName = null;
            String sourceName = null;
            PreparedStatement ps = conn.prepareStatement(SQL_CURRENT);
            ps.setLong(1, dpaidNum);
            ResultSet rs = ps.executeQuery();
            if (!rs.next()) {
                sendJsonError(response, HttpServletResponse.SC_NOT_FOUND, "Карта с PPVID " + dpaid + " не найдена");
                return;
            }
            currentStatusId = rs.getInt("PPVSTATUSID");
            currentStatusName = rs.getString("PPVSTATUSNAME");
            sourceName = rs.getString("DATASOURCEKINDNAME");
            String datasourceKindCodeRow = rs.getString("DATASOURCEKINDCODE");
            rs.close();
            ps.close();

            String dsc = datasourceKindCodeRow != null ? datasourceKindCodeRow.trim() : "";
            boolean incoming = DATASOURCEKIND_INCOMING.equals(dsc)
                    || (sourceName != null && sourceName.toLowerCase().contains("входящ"));
            boolean outgoing = DATASOURCEKIND_OUTGOING.equals(dsc)
                    || (sourceName != null && sourceName.toLowerCase().contains("исходящ"));

            if (incoming) {
                if (!"first_open".equals(action) && userId == null) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid в теле запроса (в карте прав должен быть атрибут userId)");
                    return;
                }
                handleIncoming(response, conn, dpaidNum, action, currentStatusId, currentStatusName, userId, rightsJson, dsc);
                return;
            }
            if (outgoing) {
                if (userId == null) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid в теле запроса (в карте прав должен быть атрибут userId)");
                    return;
                }
                handleOutgoing(response, conn, dpaidNum, action, depKindCode, currentStatusId, currentStatusName, userId, guid, rightsJson);
                return;
            }
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Смена статуса по действию доступна только для входящих или исходящих сведений");
        } catch (SQLException e) {
            DatabaseUtil.rollbackQuietly(conn);
            log("PpvStatusChange: " + e.getMessage());
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.rollbackQuietly(conn);
            DatabaseUtil.closeConnection(conn);
        }
    }

    private void handleIncoming(HttpServletResponse response, Connection conn, long dpaid, String action,
                                int currentStatusId, String currentStatusName, Integer userId, String rightsJson,
                                String datasourceKindCode) throws IOException, SQLException {
        if ("first_open".equals(action)) {
            if (!DATASOURCEKIND_INCOMING.equals(datasourceKindCode != null ? datasourceKindCode.trim() : "")) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Первичное открытие (Получено→В обработке) доступно только для входящей карты (DATASOURCEKINDCODE=1)");
                return;
            }
            Integer receivedIdByCode = findIncomingPpvStatusIdByCode(conn, "RECEIVED");
            Integer processingIdByCode = findIncomingPpvStatusIdByCode(conn, "PROCESSING");
            if (receivedIdByCode != null && processingIdByCode != null) {
                if (currentStatusId == processingIdByCode) {
                    response.getWriter().print(buildDpaFirstOpenJson(false, currentStatusName, currentStatusId));
                    return;
                }
                boolean looksReceived = currentStatusId == receivedIdByCode || isIncomingReceivedStatusName(currentStatusName);
                if (!looksReceived) {
                    response.getWriter().print(buildDpaFirstOpenJson(false, currentStatusName, currentStatusId));
                    return;
                }
                try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_INCOMING_RECEIVED_TO_PROCESSING)) {
                    ps.setInt(1, processingIdByCode);
                    ps.setLong(2, dpaid);
                    ps.setInt(3, receivedIdByCode);
                    int updated = ps.executeUpdate();
                    if (updated == 0) {
                        response.getWriter().print(buildDpaFirstOpenJson(false, currentStatusName, currentStatusId));
                        return;
                    }
                }
                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                    ps.setLong(1, dpaid);
                    ps.setInt(2, processingIdByCode);
                    if (userId != null) {
                        ps.setInt(3, userId);
                    } else {
                        ps.setNull(3, Types.INTEGER);
                    }
                    ps.executeUpdate();
                }
                String displayName = resolvePpvStatusDisplayName(conn, processingIdByCode, "В обработке");
                conn.commit();
                response.getWriter().print("{\"ok\":true,\"changed\":true,\"newStatus\":\"" + escapeJson(displayName)
                        + "\",\"newStatusId\":" + processingIdByCode + "}");
                return;
            }
            boolean isReceived = currentStatusId == INCOMING_RECEIVED || isIncomingReceivedStatusName(currentStatusName);
            if (!isReceived) {
                response.getWriter().print(buildDpaFirstOpenJson(false, currentStatusName, currentStatusId));
                return;
            }
            applyNewStatus(response, conn, dpaid, "В обработке", userId, true);
            return;
        }
        if (!AccessRightService.hasViolationDetectedInStatus(rightsJson)) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                    "Нет права управления статусом входящих сведений (violationDetectedIn:status)");
            return;
        }
        if ("complete_processing".equals(action)) {
            Set<String> statusDepKeys = AccessRightService.violationDetectedInStatusDepKeys(rightsJson);
            if (statusDepKeys.isEmpty()) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                        "В карте прав не заданы подразделения для violationDetectedIn:status");
                return;
            }
            if (!hasPpvDepPermisOverlap(conn, dpaid, statusDepKeys)) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                        "Нет права на завершение обработки: ни одно подразделение из права status не входит в доступ к карте (PPVDEPPERMIS)");
                return;
            }
            Integer processingStatusId = findIncomingPpvStatusIdByCode(conn, "PROCESSING");
            if (processingStatusId == null) {
                sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "В справочнике PPVSTATUS не найден статус PROCESSING для входящих сведений (DATASOURCEKINDCODE=1)");
                return;
            }
            if (currentStatusId != processingStatusId) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Действие «Завершение обработки» возможно только при статусе «В обработке» (PROCESSING)");
                return;
            }
            applyIncomingCompleteToProcessed(response, conn, dpaid, processingStatusId, userId);
            return;
        } else if ("close".equals(action)) {
            if (currentStatusName == null || !currentStatusName.toLowerCase().contains("обработано")) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Действие «Закрытие карты» возможно только при статусе «Обработано»");
                return;
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE)) {
                ps.setInt(1, INCOMING_COMPLETED);
                ps.setLong(2, dpaid);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                ps.setLong(1, dpaid);
                ps.setInt(2, INCOMING_COMPLETED);
                ps.setInt(3, userId);
                ps.executeUpdate();
            }
            conn.commit();
            response.getWriter().print("{\"ok\":true,\"newStatus\":\"Завершено\"}");
            return;
        } else {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Неизвестное действие: " + action);
            return;
        }
    }

    private static Integer findIncomingPpvStatusIdByCode(Connection conn, String statusCode) throws SQLException {
        if (statusCode == null || statusCode.trim().isEmpty()) return null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_STATUS_ID_BY_CODE_INCOMING)) {
            ps.setString(1, statusCode.trim());
            ps.setString(2, "1");
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                return rs.getInt("PPVSTATUSID");
            }
        }
    }

    private static String resolvePpvStatusDisplayName(Connection conn, int statusId, String fallback)
            throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_STATUS_NAME_BY_ID)) {
            ps.setInt(1, statusId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    String n = rs.getString(1);
                    if (n != null && !n.trim().isEmpty()) {
                        return n.trim();
                    }
                }
            }
        }
        return fallback != null ? fallback : "";
    }

    private static boolean isReviewOutcomeSent(Connection conn, long ppvid) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_REVIEW_OUTCOME_SENT)) {
            ps.setLong(1, ppvid);
            ps.setString(2, PPV_ACTOR_CODE_REVIEW);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static String normalizeDepIdKey(String s) {
        if (s == null) return "";
        String t = s.trim();
        if (t.isEmpty()) return "";
        try {
            return String.valueOf(Long.parseLong(t));
        } catch (NumberFormatException e) {
            return t;
        }
    }

    private static boolean hasPpvDepPermisOverlap(Connection conn, long ppvid, Set<String> rightsDepKeys) throws SQLException {
        Set<String> normalizedRights = new HashSet<>();
        for (String k : rightsDepKeys) {
            String n = normalizeDepIdKey(k);
            if (!n.isEmpty()) normalizedRights.add(n);
        }
        if (normalizedRights.isEmpty()) return false;
        try (PreparedStatement ps = conn.prepareStatement(SQL_PPVDEPPERMIS_DEPIDS)) {
            ps.setLong(1, ppvid);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Object v = rs.getObject("DEPID");
                    if (v == null) continue;
                    String rowKey = normalizeDepIdKey(String.valueOf(v));
                    if (!rowKey.isEmpty() && normalizedRights.contains(rowKey)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private void applyIncomingCompleteToProcessed(HttpServletResponse response, Connection conn, long dpaid,
                                                  int processingStatusId, Integer userId) throws IOException, SQLException {
        Integer processedId = findIncomingPpvStatusIdByCode(conn, "PROCESSED");
        if (processedId == null) {
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "В справочнике PPVSTATUS не найден статус PROCESSED для входящих сведений (DATASOURCEKINDCODE=1)");
            return;
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE PPV SET PPVSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE WHERE PPVID = ? AND PPVSTATUSID = ?")) {
            ps.setInt(1, processedId);
            ps.setLong(2, dpaid);
            ps.setInt(3, processingStatusId);
            int updated = ps.executeUpdate();
            if (updated == 0) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Карта не в статусе «В обработке» или уже обновлена другим запросом");
                return;
            }
        }
        String displayName = resolvePpvStatusDisplayName(conn, processedId, "Обработано");
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
            ps.setLong(1, dpaid);
            ps.setInt(2, processedId);
            if (userId != null) {
                ps.setInt(3, userId);
            } else {
                ps.setNull(3, Types.INTEGER);
            }
            ps.executeUpdate();
        }
        conn.commit();
        response.getWriter().print("{\"ok\":true,\"newStatus\":\"" + escapeJson(displayName) + "\",\"newStatusId\":" + processedId + "}");
    }

    private static boolean isIncomingReceivedStatusName(String currentStatusName) {
        if (currentStatusName == null || currentStatusName.trim().isEmpty()) return false;
        String n = currentStatusName.toLowerCase();
        return n.contains("получено") && !n.contains("обработ");
    }

    private static String buildDpaFirstOpenJson(boolean changed, String statusName, int statusId) {
        String name = statusName != null ? statusName : "";
        return "{\"ok\":true,\"changed\":" + changed
                + ",\"newStatus\":\"" + escapeJson(name) + "\""
                + ",\"newStatusId\":" + statusId + "}";
    }

    private void handleOutgoing(HttpServletResponse response, Connection conn,
                                long dpaid, String action, String depKindCode,
                                int currentStatusId, String currentStatusName, Integer userId, String guid, String rightsJson) throws IOException, SQLException {
        if ("mark_ready".equals(action)) {
            if (!AccessRightService.hasViolationDetectedOutStatus(rightsJson)) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права управления статусом исходящих сведений (violationDetectedOut:status)");
                return;
            }
            if (depKindCode == null || depKindCode.trim().isEmpty()) {
                log("[PpvStatusChange] mark_ready: depKindCode not in body, resolving from rights (guid=" + guid + ")");
                depKindCode = resolveDepKindCodeFromRights(conn, guid);
            }
            if (depKindCode == null || depKindCode.trim().isEmpty()) {
                log("[PpvStatusChange] mark_ready: depKindCode still null; guid=" + guid + ", mapSize=" + RightsRegistryProvider.get().size() + ", mapContainsGuid=" + (guid != null && RightsRegistryProvider.get().containsGuid(guid)));
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Для действия «Отметка готовности» укажите depKindCode в теле запроса или guid (в карте прав должен быть department.depkindid)");
                return;
            }
            depKindCode = depKindCode.trim();
            int depKindId = resolveDepKindId(conn, depKindCode);
            if (depKindId <= 0) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Неизвестный код подразделения (depKindCode): " + depKindCode);
                return;
            }
            if (currentStatusId == OUTGOING_DRAFT) {
                try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE)) {
                    ps.setInt(1, OUTGOING_NEW);
                    ps.setLong(2, dpaid);
                    ps.executeUpdate();
                }
                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                    ps.setLong(1, dpaid);
                    ps.setInt(2, OUTGOING_NEW);
                    ps.setInt(3, userId);
                    ps.executeUpdate();
                }
                // При отметке готовности из черновика: добавить в PPVDEPPERMIS вышестоящее ЦГЭ по уровню
                insertDpaDepPermisOnDraftMarkReady(conn, dpaid, depKindCode, guid);
            }
            // При статусе «Новое» и резолюции районного уровня (dep0601), если отметку ставит областной уровень
            // (dep0602), статус не меняется, но в доступ для просмотра добавляется республиканский ЦГЭ (DEPCODE=006).
            if (currentStatusId == OUTGOING_NEW && "DEP0602".equalsIgnoreCase(depKindCode)) {
                insertRepublicanDepPermisOnRegionalReadyForNew(conn, dpaid);
            }
            Savepoint spResolution = conn.setSavepoint("dpa_resolution");
            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_RESOLUTION)) {
                ps.setLong(1, dpaid);
                ps.setInt(2, OUTGOING_NEW);
                ps.setInt(3, depKindId);
                ps.setInt(4, userId);
                ps.executeUpdate();
            } catch (SQLException e) {
                String msg = e.getMessage();
                if (msg != null && (msg.contains("ORA-00001") || msg.contains("unique") || msg.contains("Unique"))) {
                    conn.rollback(spResolution);
                    conn.commit();
                    response.getWriter().print("{\"ok\":true,\"newStatus\":\"Новое\"}");
                    return;
                }
                throw e;
            }
            conn.commit();
            response.getWriter().print("{\"ok\":true,\"newStatus\":\"Новое\"}");
            return;
        }
        if ("to_new".equals(action)) {
            if (!AccessRightService.hasViolationDetectedOutStatus(rightsJson)) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права управления статусом исходящих сведений (violationDetectedOut:status)");
                return;
            }
            if (currentStatusId != OUTGOING_FAILED && currentStatusId != OUTGOING_ERROR) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Действие «Перевести в Новое» возможно только при статусе «Отправка не удалась» или «Ошибка обработки»");
                return;
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE)) {
                ps.setInt(1, OUTGOING_NEW);
                ps.setLong(2, dpaid);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                ps.setLong(1, dpaid);
                ps.setInt(2, OUTGOING_NEW);
                ps.setInt(3, userId);
                ps.executeUpdate();
            }
            conn.commit();
            response.getWriter().print("{\"ok\":true,\"newStatus\":\"Новое\"}");
            return;
        }
        if ("send".equals(action)) {
            if (!AccessRightService.hasViolationDetectedOutSend(rightsJson)) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права на направление исходящих сведений (violationDetectedOut:send)");
                return;
            }
            if (currentStatusId != OUTGOING_NEW) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Действие «Направление сведений» возможно только при статусе «Новое» (при наличии резолюции областного или республиканского ЦГЭ)");
                return;
            }
            {
                try (PreparedStatement ps = conn.prepareStatement(SQL_HAS_REGIONAL_OR_REPUBLICAN_RESOLUTION)) {
                    ps.setLong(1, dpaid);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (!rs.next()) {
                            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                                "Действие «Направление сведений» возможно только при наличии резолюции областного или республиканского ЦГЭ.");
                            return;
                        }
                    }
                }
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE)) {
                ps.setInt(1, OUTGOING_PENDING);
                ps.setLong(2, dpaid);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                ps.setLong(1, dpaid);
                ps.setInt(2, OUTGOING_PENDING);
                ps.setInt(3, userId);
                ps.executeUpdate();
            }
            conn.commit();
            response.getWriter().print("{\"ok\":true,\"newStatus\":\"Ожидает отправки\"}");
            return;
        }
        if ("close".equals(action)) {
            if (!AccessRightService.hasViolationDetectedOutStatus(rightsJson)) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права управления статусом исходящих сведений (violationDetectedOut:status)");
                return;
            }
            if (currentStatusId != OUTGOING_NEW && currentStatusId != OUTGOING_FAILED && currentStatusId != OUTGOING_ERROR && currentStatusId != OUTGOING_DELIVERED) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Действие «Закрытие карты» возможно только при статусе «Новое», «Отправка не удалась», «Ошибка обработки» или «Доставлено»");
                return;
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE)) {
                ps.setInt(1, OUTGOING_COMPLETED);
                ps.setLong(2, dpaid);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                ps.setLong(1, dpaid);
                ps.setInt(2, OUTGOING_COMPLETED);
                ps.setInt(3, userId);
                ps.executeUpdate();
            }
            conn.commit();
            response.getWriter().print("{\"ok\":true,\"newStatus\":\"Завершено\"}");
            return;
        }
        sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Неизвестное действие для исходящих: " + action);
    }

    private static int resolveDepKindId(Connection conn, String depKindCode) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_DEPKIND_ID)) {
            ps.setString(1, depKindCode);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                return rs.getInt(1);
            }
        }
        return -1;
    }

    /** DEPKINDCODE из БД по DEPKINDID; DEPKINDID берётся из карты прав (department.depkindid). */
    private static String resolveDepKindCodeFromRights(Connection conn, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty()) {
            System.out.println("[PpvStatusChange] resolveDepKindCodeFromRights: guid null or empty");
            return null;
        }
        String g = guid.trim();
        String rightsJson = RightsRegistryProvider.get().getRightsJson(g);
        if (rightsJson == null || rightsJson.isEmpty()) {
            System.out.println("[PpvStatusChange] resolveDepKindCodeFromRights: no rights for guid=" + g + ", mapSize=" + RightsRegistryProvider.get().size() + ", keys=" + RightsRegistryProvider.get().guidKeySet());
            return null;
        }
        Integer depkindid = extractDepKindIdFromRights(rightsJson);
        if (depkindid == null) {
            System.out.println("[PpvStatusChange] resolveDepKindCodeFromRights: depkindid not found in rights JSON (guid=" + g + ")");
            return null;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_DEPKINDCODE_BY_DEPKINDID)) {
            ps.setInt(1, depkindid);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                String code = rs.getString(1);
                System.out.println("[PpvStatusChange] resolveDepKindCodeFromRights: guid=" + g + ", depkindid=" + depkindid + " -> depKindCode=" + code);
                return code;
            }
        }
        System.out.println("[PpvStatusChange] resolveDepKindCodeFromRights: no DEPKINDCODE in DB for depkindid=" + depkindid);
        return null;
    }

    /**
     * При статусе «Черновик» и действии «Отметка готовности»: включить в состав ЦГЭ с доступом к карте
     * — вышестоящее по иерархии OS при отметке районным ЦГЭ (DEP0601);
     * — республиканский ЦГЭ (DEPCODE=006) при отметке областным ЦГЭ (DEP0602).
     */
    private static void insertDpaDepPermisOnDraftMarkReady(Connection conn, long dpaid, String depKindCode, String guid) throws SQLException {
        String code = depKindCode == null ? null : depKindCode.trim().toUpperCase();
        Integer userDepId = getDepartmentDepIdFromRights(guid);
        if (code == null) return;
        if ("DEP0601".equals(code)) {
            // Районный уровень: добавить родительское подразделение по иерархии OS (областной ЦГЭ)
            if (userDepId == null) {
                System.out.println("[PpvStatusChange] mark_ready draft+DEP0601: no department.depid in rights, skip PPVDEPPERMIS for parent");
                return;
            }
            Integer parentDepId = getParentDepIdOs(conn, userDepId);
            if (parentDepId != null && existsDepIdInTbDep(conn, parentDepId)) {
                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_PPVDEPPERMIS)) {
                    ps.setLong(1, dpaid);
                    ps.setInt(2, parentDepId);
                    ps.executeUpdate();
                    System.out.println("[PpvStatusChange] mark_ready draft+DEP0601: inserted PPVDEPPERMIS PPVID=" + dpaid + " DEPID=" + parentDepId + " (parent OS)");
                }
            } else {
                System.out.println("[PpvStatusChange] mark_ready draft+DEP0601: no parent in TB_DEPLINK(OS) or DEPID not in TB_DEP, skip");
            }
            return;
        }
        if ("DEP0602".equals(code)) {
            // Областной уровень: добавить республиканский ЦГЭ (006)
            Integer depId006 = getDepIdByDepCode006(conn);
            if (depId006 != null && existsDepIdInTbDep(conn, depId006)) {
                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_PPVDEPPERMIS)) {
                    ps.setLong(1, dpaid);
                    ps.setInt(2, depId006);
                    ps.executeUpdate();
                    System.out.println("[PpvStatusChange] mark_ready draft+DEP0602: inserted PPVDEPPERMIS PPVID=" + dpaid + " DEPID=" + depId006 + " (006)");
                }
            } else {
                System.out.println("[PpvStatusChange] mark_ready draft+DEP0602: DEPCODE 006 not found or not in TB_DEP, skip");
            }
        }
    }

    private static void insertRepublicanDepPermisOnRegionalReadyForNew(Connection conn, long dpaid) throws SQLException {
        if (!hasDistrictResolution(conn, dpaid)) {
            return;
        }
        Integer depId006 = getDepIdByDepCode006(conn);
        if (depId006 == null || !existsDepIdInTbDep(conn, depId006)) {
            return;
        }
        if (hasActiveDpaDepPermis(conn, dpaid, depId006)) {
            return;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_PPVDEPPERMIS)) {
            ps.setLong(1, dpaid);
            ps.setInt(2, depId006);
            ps.executeUpdate();
            System.out.println("[PpvStatusChange] mark_ready new+DEP0602(+DEP0601 resolution): inserted PPVDEPPERMIS PPVID=" + dpaid + " DEPID=" + depId006 + " (006)");
        }
    }

    private static Integer getDepartmentDepIdFromRights(String guid) {
        if (guid == null || guid.trim().isEmpty()) return null;
        String json = RightsRegistryProvider.get().getRightsJson(guid.trim());
        if (json == null || json.isEmpty()) return null;
        Matcher m = Pattern.compile("\"depid\"\\s*:\\s*(\\d+)").matcher(json);
        if (m.find()) return parseIntOrNull(m.group(1));
        m = Pattern.compile("\"depId\"\\s*:\\s*(\\d+)").matcher(json);
        if (m.find()) return parseIntOrNull(m.group(1));
        return null;
    }

    private static Integer getParentDepIdOs(Connection conn, int depId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_PARENT_DEPID_OS)) {
            ps.setInt(1, depId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                Object v = rs.getObject(1);
                return (v != null && v instanceof Number) ? ((Number) v).intValue() : null;
            }
        }
    }

    private static Integer getDepIdByDepCode006(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_DEPID_BY_DEPCODE_006)) {
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                Object v = rs.getObject(1);
                return (v != null && v instanceof Number) ? ((Number) v).intValue() : null;
            }
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

    private static boolean hasDistrictResolution(Connection conn, long dpaid) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_HAS_DISTRICT_RESOLUTION)) {
            ps.setLong(1, dpaid);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static boolean hasActiveDpaDepPermis(Connection conn, long dpaid, int depId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_EXISTS_PPVDEPPERMIS_ACTIVE)) {
            ps.setLong(1, dpaid);
            ps.setInt(2, depId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    /** Извлекает department.depkindid из JSON прав: "depkindid": 73 или "depKindId": 73 или "depkindid": "73". */
    private static Integer extractDepKindIdFromRights(String json) {
        if (json == null) return null;
        Matcher m = Pattern.compile("\"depkindid\"\\s*:\\s*(\\d+)").matcher(json);
        if (m.find()) return parseIntOrNull(m.group(1));
        m = Pattern.compile("\"depKindId\"\\s*:\\s*(\\d+)").matcher(json);
        if (m.find()) return parseIntOrNull(m.group(1));
        m = Pattern.compile("\"depkindid\"\\s*:\\s*\"(\\d+)\"").matcher(json);
        if (m.find()) return parseIntOrNull(m.group(1));
        m = Pattern.compile("\"depKindId\"\\s*:\\s*\"(\\d+)\"").matcher(json);
        if (m.find()) return parseIntOrNull(m.group(1));
        return null;
    }

    private static Integer parseIntOrNull(String s) {
        if (s == null) return null;
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private void applyNewStatus(HttpServletResponse response, Connection conn, long dpaid, String newStatusName, Integer userId,
                                boolean firstOpenResponse) throws IOException, SQLException {
        PreparedStatement ps = conn.prepareStatement(SQL_STATUS_ID);
        ps.setString(1, newStatusName);
        ResultSet rs = ps.executeQuery();
        if (!rs.next()) {
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Статус «" + newStatusName + "» не найден в PPVSTATUS");
            return;
        }
        int newStatusId = rs.getInt("PPVSTATUSID");
        rs.close();
        ps.close();
        ps = conn.prepareStatement(SQL_UPDATE);
        ps.setInt(1, newStatusId);
        ps.setLong(2, dpaid);
        int updated = ps.executeUpdate();
        ps.close();
        if (updated == 0) {
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Не удалось обновить статус карты");
            return;
        }
        ps = conn.prepareStatement(SQL_INSERT_HIST);
        ps.setLong(1, dpaid);
        ps.setInt(2, newStatusId);
        if (userId != null) {
            ps.setInt(3, userId);
        } else {
            ps.setNull(3, Types.INTEGER);
        }
        ps.executeUpdate();
        ps.close();
        conn.commit();
        if (firstOpenResponse) {
            response.getWriter().print("{\"ok\":true,\"changed\":true,\"newStatus\":\"" + escapeJson(newStatusName)
                    + "\",\"newStatusId\":" + newStatusId + "}");
        } else {
            response.getWriter().print("{\"ok\":true,\"newStatus\":\"" + escapeJson(newStatusName) + "\""
                    + ",\"newStatusId\":" + newStatusId + "}");
        }
    }

    private static String readBody(HttpServletRequest request) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = request.getReader()) {
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
        }
        return sb.toString();
    }

    private static String extractJsonString(String json, String key) {
        Pattern p = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher m = p.matcher(json);
        return m.find() ? m.group(1) : null;
    }

    /** Извлекает значение по ключу как строку: "key": "value" или "key": number (для guid: 1 → "1"). */
    private static String extractJsonStringOrNumber(String json, String key) {
        if (json == null) return null;
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(\\d+)").matcher(json);
        if (m.find()) return m.group(1);
        return null;
    }

    /** USERID из карты прав (атрибут userId) по guid. */
    private static Integer resolveUserId(String guid) {
        if (guid == null || guid.isEmpty()) return null;
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) return null;
        return extractUserIdFromRights(rightsJson);
    }

    /** Извлекает userId из JSON прав: "userId": 1 или "userId": "1". */
    private static Integer extractUserIdFromRights(String json) {
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

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        String escaped = message != null ? message.replace("\\", "\\\\").replace("\"", "\\\"") : "Unknown error";
        response.getWriter().print("{\"error\":\"" + escaped + "\"}");
    }
}
