package com.eec.servlet.dpa;

import com.eec.servlet.RightsJsonStore;
import com.eec.util.AccessRightService;
import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.BufferedReader;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Смена статуса карты DPA.
 * Входящие: action complete_processing | close, право dangerousProductIn:status.
 * Исходящие: action mark_ready | send | close; mark_ready/close — dangerousProductOut:status, send — dangerousProductOut:send.
 * mark_ready: тело { "dpaid", "action": "mark_ready", "depKindCode": "dep0601"|"dep0602"|"dep0603" }.
 * Обновляется DPA.DPASTATUSID, DPASTATUSHIST (и при mark_ready — DPARESOLUTION).
 */
public class DpaStatusChangeServlet extends HttpServlet {

    private static final int INCOMING_COMPLETED = 4;
    private static final int OUTGOING_DRAFT = 5;
    private static final int OUTGOING_NEW = 6;
    private static final int OUTGOING_PENDING = 7;
    private static final int OUTGOING_FAILED = 9;
    private static final int OUTGOING_ERROR = 10;
    private static final int OUTGOING_DELIVERED = 11;
    private static final int OUTGOING_EDITED = 12;
    private static final int OUTGOING_COMPLETED = 13;

    /** Текущее состояние: DPAID, DPASTATUSID, DPASTATUSNAME, источник */
    private static final String SQL_CURRENT = ""
            + "SELECT vw.DPAID, vw.DPASTATUSID, vw.DPASTATUSNAME, t.DATASOURCEKINDNAME "
            + "FROM VW_DPA vw "
            + "LEFT JOIN DATASOURCEKIND t ON vw.DATASOURCEKINDCODE = t.DATASOURCEKINDCODE "
            + "WHERE vw.DPAID = ?";
    /** DPASTATUSID по названию статуса */
    private static final String SQL_STATUS_ID = "SELECT DPASTATUSID FROM DPASTATUS WHERE TRIM(DPASTATUSNAME) = ?";
    private static final String SQL_UPDATE = "UPDATE DPA SET DPASTATUSID = ?, MODIFICATIONDATETIME = SYSDATE WHERE DPAID = ?";
    private static final String SQL_INSERT_HIST = ""
            + "INSERT INTO DPASTATUSHIST (DPAID, DPASTATUSID, DPASTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, ?)";
    /** DEPKINDID по DEPKINDCODE (TB_DEPKIND) */
    private static final String SQL_DEPKIND_ID = "SELECT DEPKINDID FROM TB_DEPKIND WHERE TRIM(UPPER(DEPKINDCODE)) = TRIM(UPPER(?))";
    /** DEPKINDCODE по DEPKINDID (DEPKINDID из карты прав: department.depkindid) */
    private static final String SQL_DEPKINDCODE_BY_DEPKINDID = "SELECT DEPKINDCODE FROM TB_DEPKIND WHERE DEPKINDID = ?";
    /** Вставка резолюции (для mark_ready). DPASTATUSID — статус карты после наложения резолюции (Новое). При дубликате (DPAID,DEPKINDID) — игнорируем. */
    private static final String SQL_INSERT_RESOLUTION = ""
            + "INSERT INTO DPARESOLUTION (DPAID, DPASTATUSID, DEPKINDID, RESOLUTIONDATETIME, USERID) VALUES (?, ?, ?, SYSDATE, ?)";
    /** Есть ли резолюция областного или республиканского ЦГЭ (для разрешения «Направление сведений» при статусе Новое). */
    private static final String SQL_HAS_REGIONAL_OR_REPUBLICAN_RESOLUTION = ""
            + "SELECT 1 FROM DPARESOLUTION r "
            + "JOIN TB_DEPKIND dk ON r.DEPKINDID = dk.DEPKINDID "
            + "WHERE r.DPAID = ? AND UPPER(TRIM(dk.DEPKINDCODE)) IN ('DEP0602','DEP0603') AND ROWNUM = 1";
    /** PARENTDEPID по иерархии OS (Организационная структура) для подразделения — для отметки готовности районным ЦГЭ. */
    private static final String SQL_PARENT_DEPID_OS = ""
            + "SELECT dp.PARENTDEPID FROM TB_DEPLINK dp "
            + "JOIN (SELECT CLASVALID FROM TB_CLASVAL WHERE CLASCODE = 'DEPLINKTYPE' AND CLASVALCODE = 'OS') dpl ON dpl.CLASVALID = dp.DEPLINKTYPEID "
            + "WHERE dp.DEPID = ? AND dp.DEPLINKACTFL = 1 AND ROWNUM = 1";
    /** DEPID республиканского ЦГЭ (006) — для отметки готовности областным ЦГЭ. */
    private static final String SQL_DEPID_BY_DEPCODE_006 = "SELECT DEPID FROM TB_DEP WHERE TRIM(DEPCODE) = '006' AND ROWNUM = 1";
    private static final String SQL_INSERT_DPADEPPERMIS = "INSERT INTO DPADEPPERMIS (DPAID, DEPID, GRANTDATETIME) VALUES (?, ?, SYSDATE)";
    private static final String SQL_EXISTS_DEP = "SELECT 1 FROM TB_DEP WHERE DEPID = ?";

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
        log("[DpaStatusChange] request: dpaid=" + dpaid + ", action=" + action + ", guid=" + (guid != null ? guid : "null") + ", depKindCode=" + (depKindCode != null ? depKindCode : "null"));
        if (dpaid == null || dpaid.trim().isEmpty() || action == null || action.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Нужны dpaid и action");
            return;
        }
        dpaid = dpaid.trim();
        action = action.trim();
        if (depKindCode != null) depKindCode = depKindCode.trim();
        if (guid != null) guid = guid.trim();

        Integer userId = resolveUserId(guid);
        log("[DpaStatusChange] userId from rights: " + (userId != null ? userId : "null") + (guid != null ? " (guid=" + guid + ")" : ""));

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
            int currentStatusId = -1;
            String currentStatusName = null;
            String sourceName = null;
            PreparedStatement ps = conn.prepareStatement(SQL_CURRENT);
            ps.setLong(1, dpaidNum);
            ResultSet rs = ps.executeQuery();
            if (!rs.next()) {
                sendJsonError(response, HttpServletResponse.SC_NOT_FOUND, "Карта с DPAID " + dpaid + " не найдена");
                return;
            }
            currentStatusId = rs.getInt("DPASTATUSID");
            currentStatusName = rs.getString("DPASTATUSNAME");
            sourceName = rs.getString("DATASOURCEKINDNAME");
            rs.close();
            ps.close();

            boolean incoming = sourceName != null && sourceName.toLowerCase().contains("входящ");
            boolean outgoing = sourceName != null && sourceName.toLowerCase().contains("исходящ");

            if (incoming) {
                if (userId == null) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid в теле запроса (в карте прав должен быть атрибут userId)");
                    return;
                }
                handleIncoming(response, conn, dpaidNum, action, currentStatusId, currentStatusName, userId);
                return;
            }
            if (outgoing) {
                if (userId == null) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid в теле запроса (в карте прав должен быть атрибут userId)");
                    return;
                }
                handleOutgoing(response, conn, dpaidNum, action, depKindCode, currentStatusId, currentStatusName, userId, guid);
                return;
            }
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Смена статуса по действию доступна только для входящих или исходящих сведений");
        } catch (SQLException e) {
            log("DpaStatusChange: " + e.getMessage());
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private void handleIncoming(HttpServletResponse response, Connection conn, long dpaid, String action,
                                int currentStatusId, String currentStatusName, Integer userId) throws IOException, SQLException {
        if (!AccessRightService.hasDangerousProductInStatus(String.valueOf(dpaid))) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права управления статусом входящих сведений");
            return;
        }
        String newStatusName = null;
        if ("complete_processing".equals(action)) {
            if (currentStatusName == null || !currentStatusName.toLowerCase().contains("обработке")) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Действие «Завершение обработки» возможно только при статусе «В обработке»");
                return;
            }
            newStatusName = "Обработано";
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
            response.getWriter().print("{\"ok\":true,\"newStatus\":\"Завершено\"}");
            return;
        } else {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Неизвестное действие: " + action);
            return;
        }
        applyNewStatus(response, conn, dpaid, newStatusName, userId);
    }

    private void handleOutgoing(HttpServletResponse response, Connection conn,
                                long dpaid, String action, String depKindCode,
                                int currentStatusId, String currentStatusName, Integer userId, String guid) throws IOException, SQLException {
        if ("mark_ready".equals(action)) {
            if (!AccessRightService.hasDangerousProductOutStatus(String.valueOf(dpaid))) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права управления статусом исходящих сведений (dangerousProductOut:status)");
                return;
            }
            if (depKindCode == null || depKindCode.trim().isEmpty()) {
                log("[DpaStatusChange] mark_ready: depKindCode not in body, resolving from rights (guid=" + guid + ")");
                depKindCode = resolveDepKindCodeFromRights(conn, guid);
            }
            if (depKindCode == null || depKindCode.trim().isEmpty()) {
                log("[DpaStatusChange] mark_ready: depKindCode still null; guid=" + guid + ", mapSize=" + RightsJsonStore.guidMap.size() + ", mapContainsGuid=" + (guid != null && RightsJsonStore.guidMap.containsKey(guid)));
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
                // При отметке готовности из черновика: добавить в DPADEPPERMIS вышестоящее ЦГЭ по уровню
                insertDpaDepPermisOnDraftMarkReady(conn, dpaid, depKindCode, guid);
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_RESOLUTION)) {
                ps.setLong(1, dpaid);
                ps.setInt(2, OUTGOING_NEW);
                ps.setInt(3, depKindId);
                ps.setInt(4, userId);
                ps.executeUpdate();
            } catch (SQLException e) {
                String msg = e.getMessage();
                if (msg != null && (msg.contains("ORA-00001") || msg.contains("unique") || msg.contains("Unique"))) {
                    response.getWriter().print("{\"ok\":true,\"newStatus\":\"Новое\"}");
                    return;
                }
                throw e;
            }
            response.getWriter().print("{\"ok\":true,\"newStatus\":\"Новое\"}");
            return;
        }
        if ("to_new".equals(action)) {
            if (!AccessRightService.hasDangerousProductOutStatus(String.valueOf(dpaid))) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права управления статусом исходящих сведений (dangerousProductOut:status)");
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
            response.getWriter().print("{\"ok\":true,\"newStatus\":\"Новое\"}");
            return;
        }
        if ("send".equals(action)) {
            if (!AccessRightService.hasDangerousProductOutSend(String.valueOf(dpaid))) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права на направление исходящих сведений (dangerousProductOut:send)");
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
            response.getWriter().print("{\"ok\":true,\"newStatus\":\"Ожидает отправки\"}");
            return;
        }
        if ("close".equals(action)) {
            if (!AccessRightService.hasDangerousProductOutStatus(String.valueOf(dpaid))) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права управления статусом исходящих сведений (dangerousProductOut:status)");
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
            System.out.println("[DpaStatusChange] resolveDepKindCodeFromRights: guid null or empty");
            return null;
        }
        String g = guid.trim();
        String rightsJson = RightsJsonStore.guidMap.get(g);
        if (rightsJson == null || rightsJson.isEmpty()) {
            System.out.println("[DpaStatusChange] resolveDepKindCodeFromRights: no rights for guid=" + g + ", mapSize=" + RightsJsonStore.guidMap.size() + ", keys=" + RightsJsonStore.guidMap.keySet());
            return null;
        }
        Integer depkindid = extractDepKindIdFromRights(rightsJson);
        if (depkindid == null) {
            System.out.println("[DpaStatusChange] resolveDepKindCodeFromRights: depkindid not found in rights JSON (guid=" + g + ")");
            return null;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_DEPKINDCODE_BY_DEPKINDID)) {
            ps.setInt(1, depkindid);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                String code = rs.getString(1);
                System.out.println("[DpaStatusChange] resolveDepKindCodeFromRights: guid=" + g + ", depkindid=" + depkindid + " -> depKindCode=" + code);
                return code;
            }
        }
        System.out.println("[DpaStatusChange] resolveDepKindCodeFromRights: no DEPKINDCODE in DB for depkindid=" + depkindid);
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
                System.out.println("[DpaStatusChange] mark_ready draft+DEP0601: no department.depid in rights, skip DPADEPPERMIS for parent");
                return;
            }
            Integer parentDepId = getParentDepIdOs(conn, userDepId);
            if (parentDepId != null && existsDepIdInTbDep(conn, parentDepId)) {
                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_DPADEPPERMIS)) {
                    ps.setLong(1, dpaid);
                    ps.setInt(2, parentDepId);
                    ps.executeUpdate();
                    System.out.println("[DpaStatusChange] mark_ready draft+DEP0601: inserted DPADEPPERMIS DPAID=" + dpaid + " DEPID=" + parentDepId + " (parent OS)");
                }
            } else {
                System.out.println("[DpaStatusChange] mark_ready draft+DEP0601: no parent in TB_DEPLINK(OS) or DEPID not in TB_DEP, skip");
            }
            return;
        }
        if ("DEP0602".equals(code)) {
            // Областной уровень: добавить республиканский ЦГЭ (006)
            Integer depId006 = getDepIdByDepCode006(conn);
            if (depId006 != null && existsDepIdInTbDep(conn, depId006)) {
                try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_DPADEPPERMIS)) {
                    ps.setLong(1, dpaid);
                    ps.setInt(2, depId006);
                    ps.executeUpdate();
                    System.out.println("[DpaStatusChange] mark_ready draft+DEP0602: inserted DPADEPPERMIS DPAID=" + dpaid + " DEPID=" + depId006 + " (006)");
                }
            } else {
                System.out.println("[DpaStatusChange] mark_ready draft+DEP0602: DEPCODE 006 not found or not in TB_DEP, skip");
            }
        }
    }

    private static Integer getDepartmentDepIdFromRights(String guid) {
        if (guid == null || guid.trim().isEmpty()) return null;
        String json = RightsJsonStore.guidMap.get(guid.trim());
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

    private void applyNewStatus(HttpServletResponse response, Connection conn, long dpaid, String newStatusName, Integer userId) throws IOException, SQLException {
        PreparedStatement ps = conn.prepareStatement(SQL_STATUS_ID);
        ps.setString(1, newStatusName);
        ResultSet rs = ps.executeQuery();
        if (!rs.next()) {
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Статус «" + newStatusName + "» не найден в DPASTATUS");
            return;
        }
        int newStatusId = rs.getInt("DPASTATUSID");
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
        ps.setInt(3, userId);
        ps.executeUpdate();
        ps.close();
        response.getWriter().print("{\"ok\":true,\"newStatus\":\"" + escapeJson(newStatusName) + "\"}");
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
        String rightsJson = RightsJsonStore.guidMap.get(guid);
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
