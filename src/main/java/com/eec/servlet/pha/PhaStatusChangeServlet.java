package com.eec.servlet.pha;

import com.eec.servlet.RightsJsonStore;
import com.eec.util.AccessRightService;
import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.Reader;
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
 * Смена статуса карты PHA (входящие и исходящие сведения о болезни).
 * POST /api/pha/status
 * Тело JSON: { "phaid", "action", "guid" }.
 * <p>Входящие:</p>
 * <ul>
 *   <li>{@code first_open} — Получено → В обработке при первичном открытии (только DATASOURCEKINDCODE=1); PHASTATUSHIST с USERID из guid.</li>
 *   <li>{@code complete_processing} — В обработке → Обработано; publicHealthIn:status.</li>
 *   <li>{@code close} — Обработано (3) → Завершено; publicHealthIn:status; DATASOURCEKINDCODE=1.</li>
 * </ul>
 * <p>Исходящие:</p>
 * <ul>
 *   <li>{@code send} — Новое (5) / Отправка не удалась (8) / Ошибка обработки (9) → Ожидает отправки (6); publicHealthOut:send ∩ PHADEPPERMIS; валидация XML; DOCCREATIONDATE.</li>
 *   <li>{@code close} — статусы NEW(5), FAILED(8), ERROR(9), DELIVERED(10); при DELIVERED — обязательна PHA.ENDDATE; publicHealthOut:status ∩ PHADEPPERMIS.</li>
 *   <li>{@code to_new} — Отправка не удалась/Ошибка обработки → Новое; publicHealthOut:status.</li>
 * </ul>
 */
public class PhaStatusChangeServlet extends HttpServlet {

    private static final String SQL_CURRENT_VW = ""
            + "SELECT vw.PHAID, vw.PHASTATUSID, vw.DATASOURCEKINDCODE, t.DATASOURCEKINDNAME, ps.PHASTATUSNAME "
            + "FROM VW_PHA vw "
            + "LEFT JOIN DATASOURCEKIND t ON vw.DATASOURCEKINDCODE = t.DATASOURCEKINDCODE "
            + "LEFT JOIN PHASTATUS ps ON vw.PHASTATUSID = ps.PHASTATUSID "
            + "WHERE vw.PHAID = ?";
    private static final String SQL_CURRENT_PHA = ""
            + "SELECT p.PHAID, p.PHASTATUSID, p.DATASOURCEKINDCODE, t1.DATASOURCEKINDNAME, ps.PHASTATUSNAME "
            + "FROM PHA p "
            + "LEFT JOIN DATASOURCEKIND t1 ON p.DATASOURCEKINDCODE = t1.DATASOURCEKINDCODE "
            + "LEFT JOIN PHASTATUS ps ON p.PHASTATUSID = ps.PHASTATUSID "
            + "WHERE p.PHAID = ?";
    private static final String SQL_PHA_DEPS = "SELECT DEPID FROM PHADEPPERMIS WHERE PHAID = ?";
    private static final String SQL_PHA_ENDDATE = "SELECT ENDDATE FROM PHA WHERE PHAID = ?";
    private static final String SQL_STATUS_ID = "SELECT PHASTATUSID FROM PHASTATUS WHERE TRIM(PHASTATUSNAME) = ?";
    private static final String SQL_UPDATE_PHA = "UPDATE PHA SET PHASTATUSID = ?, MODIFICATIONDATETIME = SYSDATE WHERE PHAID = ?";
    /** При направлении сведений ОП 57: обновить дату формирования документа и время изменения. */
    private static final String SQL_UPDATE_PHA_SEND = ""
            + "UPDATE PHA SET PHASTATUSID = ?, MODIFICATIONDATETIME = SYSDATE, DOCCREATIONDATE = TRUNC(SYSDATE) WHERE PHAID = ?";
    private static final String SQL_PHAXML_BODY = "SELECT PHAXMLBODY FROM PHAXML WHERE PHAID = ?";
    private static final String SQL_INSERT_HIST = ""
            + "INSERT INTO PHASTATUSHIST (PHAID, PHASTATUSID, PHASTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, ?)";

    private static final String STATUS_PROCESSING = "В обработке";
    private static final String STATUS_PROCESSED = "Обработано";
    private static final String STATUS_COMPLETED = "Завершено";
    private static final String STATUS_NEW = "Новое";
    private static final String STATUS_PENDING = "Ожидает отправки";

    /** Входящие сведения PHA (как в PHA.DATASOURCEKINDCODE). */
    private static final String DATASOURCEKIND_INCOMING = "1";
    private static final String DATASOURCEKIND_OUTGOING = "2";
    /** PHASTATUSID: В обработке → Обработано. */
    private static final int PHASTATUS_PROCESSING = 2;
    private static final int PHASTATUS_PROCESSED = 3;
    /** Исходящие: закрытие карты допускается в этих статусах (по ТЗ). */
    private static final int PHA_OUT_NEW = 5;
    private static final int PHA_OUT_FAILED = 8;
    private static final int PHA_OUT_ERROR = 9;
    private static final int PHA_OUT_DELIVERED = 10;

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        request.setCharacterEncoding("UTF-8");

        String body = readBody(request);
        String phaid = extractJsonString(body, "phaid");
        String action = extractJsonString(body, "action");
        String guid = extractJsonString(body, "guid");
        if (guid == null) guid = extractJsonStringOrNumber(body, "guid");
        if (guid == null) guid = extractJsonString(body, "GUID");
        if (guid == null) guid = extractJsonStringOrNumber(body, "GUID");
        if (guid != null) guid = guid.trim();
        if (phaid == null || phaid.trim().isEmpty() || action == null || action.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Нужны phaid и action");
            return;
        }
        phaid = phaid.trim();
        action = action.trim();

        long phaIdNum;
        try {
            phaIdNum = Long.parseLong(phaid);
            if (phaIdNum <= 0) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "phaid должен быть положительным числом");
                return;
            }
        } catch (NumberFormatException e) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный phaid");
            return;
        }

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            conn.setAutoCommit(false);
            CurrentPhaRow row = loadCurrentRow(conn, phaIdNum);
            if (row == null) {
                sendJsonError(response, HttpServletResponse.SC_NOT_FOUND, "Карта с PHAID " + phaid + " не найдена");
                return;
            }

            boolean incoming = row.sourceName != null && row.sourceName.toLowerCase().contains("входящ");
            boolean outgoing = row.sourceName != null && row.sourceName.toLowerCase().contains("исходящ");

            String rightsJson = (guid != null && !guid.isEmpty()) ? RightsJsonStore.guidMap.get(guid) : null;

            if (outgoing) {
                Integer userId = resolveUserId(guid);
                if (userId == null) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                            "Укажите guid в теле запроса (в карте прав должен быть атрибут userId)");
                    return;
                }
                handleOutgoing(request, response, conn, phaIdNum, row, action, userId, rightsJson);
                return;
            }

            if (!incoming) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Смена статуса по данному API доступна только для входящих или исходящих сведений PHA");
                return;
            }

            if ("first_open".equals(action)) {
                if (!AccessRightService.hasPublicHealthInView(rightsJson)) {
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                            "Нет права просмотра входящих сведений PHA (publicHealthIn:view)");
                    return;
                }
                Integer openUserId = resolveUserId(guid);
                if (openUserId == null) {
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                            "Укажите guid в теле запроса (в карте прав должен быть атрибут userId)");
                    return;
                }
                handleFirstOpen(response, conn, phaIdNum, row, openUserId);
                return;
            }

            Integer userId = resolveUserId(guid);
            if (userId == null) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Укажите guid в теле запроса (в карте прав должен быть атрибут userId)");
                return;
            }
            if (!AccessRightService.hasPublicHealthInStatus(rightsJson)) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                        "Нет права управления статусом входящих сведений о болезни (publicHealthIn:status)");
                return;
            }

            if ("complete_processing".equals(action)) {
                if (!verifyIncomingStatusDepIntersect(request, response, conn, phaIdNum, guid, rightsJson)) {
                    return;
                }
                handleCompleteProcessing(response, conn, phaIdNum, row, userId);
            } else if ("close".equals(action)) {
                if (!verifyIncomingStatusDepIntersect(request, response, conn, phaIdNum, guid, rightsJson)) {
                    return;
                }
                handleClose(response, conn, phaIdNum, row, userId);
            } else {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Неизвестное действие: " + action);
            }
        } catch (SQLException e) {
            DatabaseUtil.rollbackQuietly(conn);
            System.err.println("[PhaStatusChangeServlet] " + e.getMessage());
            e.printStackTrace();
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.rollbackQuietly(conn);
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static class CurrentPhaRow {
        final int statusId;
        final String statusName;
        final String sourceName;
        /** PHA.DATASOURCEKINDCODE */
        final String dataSourceKindCode;

        CurrentPhaRow(int statusId, String statusName, String sourceName, String dataSourceKindCode) {
            this.statusId = statusId;
            this.statusName = statusName;
            this.sourceName = sourceName;
            this.dataSourceKindCode = dataSourceKindCode;
        }
    }

    /** Сначала таблица PHA (источник истины по статусу), при отсутствии строки — VW_PHA. */
    private static CurrentPhaRow loadCurrentRow(Connection conn, long phaId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_CURRENT_PHA)) {
            ps.setLong(1, phaId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rowFromRs(rs);
                }
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_CURRENT_VW)) {
            ps.setLong(1, phaId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rowFromRs(rs);
                }
            }
        } catch (SQLException e) {
            if (e.getMessage() != null && (e.getMessage().contains("ORA-00942")
                    || e.getMessage().contains("invalid object name")
                    || e.getMessage().contains("VW_PHA"))) {
                return null;
            }
            throw e;
        }
        return null;
    }

    private static CurrentPhaRow rowFromRs(ResultSet rs) throws SQLException {
        int sid = rs.getInt("PHASTATUSID");
        if (rs.wasNull()) {
            sid = -1;
        }
        String name = rs.getString("PHASTATUSNAME");
        String src = rs.getString("DATASOURCEKINDNAME");
        String dsc = rs.getString("DATASOURCEKINDCODE");
        if (dsc != null) dsc = dsc.trim();
        return new CurrentPhaRow(sid, name, src, dsc);
    }

    private void handleFirstOpen(HttpServletResponse response, Connection conn, long phaId, CurrentPhaRow row, int userId)
            throws IOException, SQLException {
        String dsc = row.dataSourceKindCode != null ? row.dataSourceKindCode.trim() : "";
        if (!DATASOURCEKIND_INCOMING.equals(dsc)) {
            response.getWriter().print(buildOkJson(false, row.statusName, row.statusId));
            return;
        }
        String cur = row.statusName;
        if (!isReceivedStatus(cur)) {
            response.getWriter().print(buildOkJson(false, cur, row.statusId));
            return;
        }
        int newId = resolveStatusId(conn, STATUS_PROCESSING);
        if (newId < 0) {
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "Статус «" + STATUS_PROCESSING + "» не найден в PHASTATUS");
            return;
        }
        applyStatusAndHistory(conn, phaId, newId, userId);
        conn.commit();
        response.getWriter().print(buildOkJson(true, STATUS_PROCESSING, newId));
    }

    private void handleCompleteProcessing(HttpServletResponse response, Connection conn, long phaId, CurrentPhaRow row, int userId)
            throws IOException, SQLException {
        String dsc = row.dataSourceKindCode != null ? row.dataSourceKindCode.trim() : "";
        if (!DATASOURCEKIND_INCOMING.equals(dsc)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Завершение обработки доступно только для входящей карты (DATASOURCEKINDCODE=1)");
            return;
        }
        if (row.statusId != PHASTATUS_PROCESSING) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Действие «Завершение обработки» возможно только при статусе «В обработке» (PHASTATUSID=2)");
            return;
        }
        int newId = resolveStatusId(conn, STATUS_PROCESSED);
        if (newId < 0) {
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "Статус «" + STATUS_PROCESSED + "» не найден в PHASTATUS");
            return;
        }
        applyStatusAndHistory(conn, phaId, newId, userId);
        conn.commit();
        response.getWriter().print(buildOkJson(true, STATUS_PROCESSED, newId));
    }

    private void handleClose(HttpServletResponse response, Connection conn, long phaId, CurrentPhaRow row, int userId)
            throws IOException, SQLException {
        /* Входящие: только из handleCompleteProcessing / статус «Обработано» (3). */
        String dsc = row.dataSourceKindCode != null ? row.dataSourceKindCode.trim() : "";
        if (!DATASOURCEKIND_INCOMING.equals(dsc)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Закрытие карты по данному API доступно только для входящей карты (DATASOURCEKINDCODE=1)");
            return;
        }
        if (row.statusId != PHASTATUS_PROCESSED) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Действие «Закрытие карты» возможно только при статусе «Обработано» (PHASTATUSID=3)");
            return;
        }
        int newId = resolveFinalClosingStatusId(conn);
        if (newId < 0) {
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "Статус «" + STATUS_COMPLETED + "» (PHASTATUSID=4) не найден в PHASTATUS");
            return;
        }
        applyStatusAndHistory(conn, phaId, newId, userId);
        conn.commit();
        response.getWriter().print(buildOkJson(true, STATUS_COMPLETED, newId));
    }

    private void handleOutgoing(HttpServletRequest request, HttpServletResponse response, Connection conn, long phaId,
                               CurrentPhaRow row, String action, int userId, String rightsJson) throws IOException, SQLException {
        String n = row.statusName == null ? "" : row.statusName.toLowerCase();

        if ("send".equals(action)) {
            if (!AccessRightService.hasPublicHealthOutSend(rightsJson)) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                        "Нет права на направление исходящих сведений (publicHealthOut:send)");
                return;
            }
            if (!verifyOutgoingSendDepIntersect(request, response, conn, phaId, rightsJson)) {
                return;
            }
            String dscSend = row.dataSourceKindCode != null ? row.dataSourceKindCode.trim() : "";
            if (!DATASOURCEKIND_OUTGOING.equals(dscSend)) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Направление сведений доступно только для исходящей карты (DATASOURCEKINDCODE=2)");
                return;
            }
            if (!canSendOutgoingToOp57(row.statusId, n)) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Действие «Направить сведения» возможно только при статусе «Новое» (5), «Отправка не удалась» (8) или «Ошибка обработки» (9)");
                return;
            }
            String xmlBody = loadPhaXmlBody(conn, phaId);
            if (xmlBody == null) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Не найден XML карты в PHAXML; доработайте и сохраните карту перед направлением");
                return;
            }
            /*
             * Логический контроль карты выполняется в UI перед показом подтверждения «Направить сведения»
             * (validatePhaOutgoingCardFull), затем карта сохраняется в PHAXML. Повторный разбор XML здесь
             * не выполняется, чтобы не дублировать проверки и не расходиться с фактической структурой выгрузки.
             */
            int newId = resolveStatusId(conn, STATUS_PENDING);
            if (newId < 0) {
                sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Статус «" + STATUS_PENDING + "» не найден в PHASTATUS");
                return;
            }
            applySendStatusAndHistory(conn, phaId, newId, userId);
            conn.commit();
            response.getWriter().print(buildOkJson(true, STATUS_PENDING, newId));
            return;
        }

        if ("close".equals(action)) {
            if (!AccessRightService.hasPublicHealthOutStatus(rightsJson)) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                        "Нет права управления статусом исходящих сведений (publicHealthOut:status)");
                return;
            }
            if (!verifyOutgoingStatusDepIntersect(request, response, conn, phaId, rightsJson)) {
                return;
            }
            String dsc = row.dataSourceKindCode != null ? row.dataSourceKindCode.trim() : "";
            if (!DATASOURCEKIND_OUTGOING.equals(dsc)) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Закрытие исходящей карты доступно только при DATASOURCEKINDCODE=2");
                return;
            }
            if (!canCloseOutgoingPha(row.statusId, n)) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Действие «Закрытие карты» возможно только при статусе «Новое» (5), «Отправка не удалась» (8), «Ошибка обработки» (9) или «Доставлено» (10)");
                return;
            }
            if (outgoingCloseRequiresEndDate(row.statusId, n) && !hasPhaSituationEndDate(conn, phaId)) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "При статусе «Доставлено» для закрытия карты укажите дату закрытия (архивации) нежелательной ситуации (PHA.ENDDATE / csdo:EndDate)");
                return;
            }
            int newId = resolveFinalClosingStatusId(conn);
            if (newId < 0) {
                sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Статус «" + STATUS_COMPLETED + "» не найден в PHASTATUS");
                return;
            }
            applyStatusAndHistory(conn, phaId, newId, userId);
            conn.commit();
            response.getWriter().print(buildOkJson(true, STATUS_COMPLETED, newId));
            return;
        }

        if ("to_new".equals(action)) {
            if (!AccessRightService.hasPublicHealthOutStatus(rightsJson)) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                        "Нет права управления статусом исходящих сведений (publicHealthOut:status)");
                return;
            }
            if (!canTransitionToNew(n)) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Действие «Перевести в Новое» возможно только при статусе «Отправка не удалась» или «Ошибка обработки»");
                return;
            }
            int newId = resolveStatusId(conn, STATUS_NEW);
            if (newId < 0) {
                sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Статус «" + STATUS_NEW + "» не найден в PHASTATUS");
                return;
            }
            applyStatusAndHistory(conn, phaId, newId, userId);
            conn.commit();
            response.getWriter().print(buildOkJson(true, STATUS_NEW, newId));
            return;
        }

        sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Неизвестное действие для исходящих: " + action);
    }

    /** Участники ОП 57: только NEW(5), FAILED(8), ERROR(9). */
    private static boolean canSendOutgoingToOp57(int statusId, String statusLower) {
        if (statusId == PHA_OUT_NEW || statusId == PHA_OUT_FAILED || statusId == PHA_OUT_ERROR) {
            return true;
        }
        return (statusLower.contains("новое") && !statusLower.contains("ожидает"))
                || statusLower.contains("не удалась")
                || statusLower.contains("ошибка обработки");
    }

    /** Новое, Отправка не удалась, Ошибка обработки, Доставлено → Завершено */
    private static boolean canTransitionToCompleted(String statusLower) {
        return (statusLower.contains("новое") && !statusLower.contains("ожидает"))
                || statusLower.contains("не удалась")
                || statusLower.contains("ошибка обработки")
                || statusLower.contains("доставлено");
    }

    /** Отправка не удалась, Ошибка обработки → Новое */
    private static boolean canTransitionToNew(String statusLower) {
        return statusLower.contains("не удалась") || statusLower.contains("ошибка обработки");
    }

    /** Статус «Получено» (и близкие формулировки без «обработ» в названии). */
    private static boolean isReceivedStatus(String name) {
        if (name == null) return false;
        String n = name.trim().toLowerCase();
        if (n.isEmpty()) return false;
        if (n.contains("обработ")) return false;
        return n.contains("получен");
    }

    private static int resolveStatusId(Connection conn, String statusName) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_STATUS_ID)) {
            ps.setString(1, statusName);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1);
                }
            }
        }
        return -1;
    }

    /** Статус «Завершено» по наименованию или PHASTATUSID=4 (COMPLETED). */
    private static int resolveFinalClosingStatusId(Connection conn) throws SQLException {
        int byName = resolveStatusId(conn, STATUS_COMPLETED);
        if (byName > 0) {
            return byName;
        }
        try (PreparedStatement ps = conn.prepareStatement("SELECT PHASTATUSID FROM PHASTATUS WHERE PHASTATUSID = 4")) {
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1);
                }
            }
        }
        return -1;
    }

    /** Дата закрытия нежелательной ситуации в PHA.ENDDATE. */
    private static boolean hasPhaSituationEndDate(Connection conn, long phaId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_PHA_ENDDATE)) {
            ps.setLong(1, phaId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return false;
                }
                Object o = rs.getObject(1);
                return o != null;
            }
        }
    }

    private static boolean canCloseOutgoingPha(int statusId, String statusLower) {
        if (statusId == PHA_OUT_NEW || statusId == PHA_OUT_FAILED || statusId == PHA_OUT_ERROR
                || statusId == PHA_OUT_DELIVERED) {
            return true;
        }
        return canTransitionToCompleted(statusLower);
    }

    private static boolean outgoingCloseRequiresEndDate(int statusId, String statusLower) {
        if (statusId == PHA_OUT_DELIVERED) {
            return true;
        }
        return statusLower.contains("доставлено") && !statusLower.contains("заверш");
    }

    private boolean verifyOutgoingStatusDepIntersect(HttpServletRequest request, HttpServletResponse response,
                                                    Connection conn, long phaId, String rightsJson)
            throws SQLException, IOException {
        boolean commandInvoke = Boolean.TRUE.equals(request.getAttribute("com.eec.command.invoke"));
        if (commandInvoke) {
            return true;
        }
        Set<String> cardDepIds = loadCardDepIds(conn, phaId);
        if (cardDepIds.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                    "Нет доступа к карте: в доступе к карте нет подразделений (PHADEPPERMIS).");
            return false;
        }
        if (rightsJson == null || rightsJson.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Права по GUID не найдены.");
            return false;
        }
        Set<String> userDepIds = parsePublicHealthOutStatusDepIds(rightsJson);
        boolean ok = false;
        for (String d : userDepIds) {
            if (cardDepIds.contains(d)) {
                ok = true;
                break;
            }
        }
        if (!ok) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                    "Нет права на управление статусом исходящих сведений в пределах ни одного подразделения, имеющего доступ к данной карте.");
            return false;
        }
        return true;
    }

    /**
     * publicHealthOut:send — пересечение DEPID из JSON с PHADEPPERMIS карты.
     */
    private boolean verifyOutgoingSendDepIntersect(HttpServletRequest request, HttpServletResponse response,
                                                   Connection conn, long phaId, String rightsJson)
            throws SQLException, IOException {
        boolean commandInvoke = Boolean.TRUE.equals(request.getAttribute("com.eec.command.invoke"));
        if (commandInvoke) {
            return true;
        }
        Set<String> cardDepIds = loadCardDepIds(conn, phaId);
        if (cardDepIds.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                    "Нет доступа к карте: в доступе к карте нет подразделений (PHADEPPERMIS).");
            return false;
        }
        if (rightsJson == null || rightsJson.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Права по GUID не найдены.");
            return false;
        }
        Set<String> userDepIds = parsePublicHealthOutSendDepIds(rightsJson);
        boolean ok = false;
        for (String d : userDepIds) {
            if (cardDepIds.contains(d)) {
                ok = true;
                break;
            }
        }
        if (!ok) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                    "Нет права на направление исходящих сведений в пределах ни одного подразделения, имеющего доступ к данной карте (publicHealthOut:send).");
            return false;
        }
        return true;
    }

    private static Set<String> parsePublicHealthOutSendDepIds(String json) {
        Set<String> out = new HashSet<>();
        int outStart = json.indexOf("\"publicHealthOut\"");
        if (outStart < 0) {
            return out;
        }
        int stStart = json.indexOf("\"send\"", outStart);
        if (stStart < 0) {
            return out;
        }
        int braceStart = json.indexOf('{', stStart);
        if (braceStart < 0) {
            return out;
        }
        int depth = 1;
        int i = braceStart + 1;
        while (i < json.length() && depth > 0) {
            char c = json.charAt(i);
            if (c == '{') {
                depth++;
            } else if (c == '}') {
                depth--;
            }
            i++;
        }
        String sendBlock = depth == 0 ? json.substring(braceStart, i) : "";
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(sendBlock);
        while (keyM.find()) {
            out.add(keyM.group(1).trim());
        }
        return out;
    }

    private static Set<String> parsePublicHealthOutStatusDepIds(String json) {
        Set<String> out = new HashSet<>();
        int outStart = json.indexOf("\"publicHealthOut\"");
        if (outStart < 0) {
            return out;
        }
        int stStart = json.indexOf("\"status\"", outStart);
        if (stStart < 0) {
            return out;
        }
        int braceStart = json.indexOf('{', stStart);
        if (braceStart < 0) {
            return out;
        }
        int depth = 1;
        int i = braceStart + 1;
        while (i < json.length() && depth > 0) {
            char c = json.charAt(i);
            if (c == '{') {
                depth++;
            } else if (c == '}') {
                depth--;
            }
            i++;
        }
        String statusBlock = depth == 0 ? json.substring(braceStart, i) : "";
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(statusBlock);
        while (keyM.find()) {
            out.add(keyM.group(1).trim());
        }
        return out;
    }

    /**
     * Требование: publicHealthIn:status в пределах хотя бы одного DEPID из PHADEPPERMIS по данной карте.
     */
    private boolean verifyIncomingStatusDepIntersect(HttpServletRequest request, HttpServletResponse response,
                                                    Connection conn, long phaId, String guid, String rightsJson)
            throws SQLException, IOException {
        boolean commandInvoke = Boolean.TRUE.equals(request.getAttribute("com.eec.command.invoke"));
        if (commandInvoke) {
            return true;
        }
        Set<String> cardDepIds = loadCardDepIds(conn, phaId);
        if (cardDepIds.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                    "Нет доступа к карте: в доступе к карте нет подразделений (PHADEPPERMIS).");
            return false;
        }
        if (rightsJson == null || rightsJson.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Права по GUID не найдены.");
            return false;
        }
        Set<String> userDepIds = parsePublicHealthInStatusDepIds(rightsJson);
        boolean ok = false;
        for (String d : userDepIds) {
            if (cardDepIds.contains(d)) {
                ok = true;
                break;
            }
        }
        if (!ok) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                    "Нет права на управление статусом входящих сведений в пределах ни одного подразделения, имеющего доступ к данной карте.");
            return false;
        }
        return true;
    }

    private static Set<String> loadCardDepIds(Connection conn, long phaId) throws SQLException {
        Set<String> out = new HashSet<>();
        try (PreparedStatement ps = conn.prepareStatement(SQL_PHA_DEPS)) {
            ps.setLong(1, phaId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String d = rs.getString(1);
                    if (d != null && !d.trim().isEmpty()) {
                        out.add(d.trim());
                    }
                }
            }
        }
        return out;
    }

    private static Set<String> parsePublicHealthInStatusDepIds(String json) {
        Set<String> out = new HashSet<>();
        int inStart = json.indexOf("\"publicHealthIn\"");
        if (inStart < 0) return out;
        int stStart = json.indexOf("\"status\"", inStart);
        if (stStart < 0) return out;
        int braceStart = json.indexOf('{', stStart);
        if (braceStart < 0) return out;
        int depth = 1;
        int i = braceStart + 1;
        while (i < json.length() && depth > 0) {
            char c = json.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') depth--;
            i++;
        }
        String statusBlock = depth == 0 ? json.substring(braceStart, i) : "";
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(statusBlock);
        while (keyM.find()) {
            out.add(keyM.group(1).trim());
        }
        return out;
    }

    private static void applyStatusAndHistory(Connection conn, long phaId, int newStatusId, Integer userId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_PHA)) {
            ps.setInt(1, newStatusId);
            ps.setLong(2, phaId);
            int u = ps.executeUpdate();
            if (u == 0) {
                throw new SQLException("Не удалось обновить PHA (PHASTATUSID) для PHAID=" + phaId);
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
            ps.setLong(1, phaId);
            ps.setInt(2, newStatusId);
            if (userId != null) {
                ps.setInt(3, userId);
            } else {
                ps.setNull(3, Types.INTEGER);
            }
            ps.executeUpdate();
        }
    }

    /** Направление ОП 57: статус «Ожидает отправки», дата формирования, история. */
    private static void applySendStatusAndHistory(Connection conn, long phaId, int newStatusId, Integer userId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_PHA_SEND)) {
            ps.setInt(1, newStatusId);
            ps.setLong(2, phaId);
            int u = ps.executeUpdate();
            if (u == 0) {
                throw new SQLException("Не удалось обновить PHA при направлении сведений для PHAID=" + phaId);
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
            ps.setLong(1, phaId);
            ps.setInt(2, newStatusId);
            if (userId != null) {
                ps.setInt(3, userId);
            } else {
                ps.setNull(3, Types.INTEGER);
            }
            ps.executeUpdate();
        }
    }

    /** XML карты из PHAXML; {@code null} если строки нет. */
    private static String loadPhaXmlBody(Connection conn, long phaId) throws SQLException, IOException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_PHAXML_BODY)) {
            ps.setLong(1, phaId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                Clob clob = rs.getClob(1);
                if (clob == null) {
                    return "";
                }
                StringBuilder sb = new StringBuilder();
                try (Reader r = clob.getCharacterStream()) {
                    char[] buf = new char[4096];
                    int n;
                    while ((n = r.read(buf)) >= 0) {
                        sb.append(buf, 0, n);
                    }
                }
                return sb.toString();
            }
        }
    }

    private static String buildOkJson(boolean changed, String newStatus, int newStatusId) {
        return "{\"ok\":true,\"changed\":" + changed
                + ",\"newStatus\":\"" + escapeJson(newStatus) + "\""
                + ",\"newStatusId\":" + newStatusId + "}";
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

    private static String extractJsonStringOrNumber(String json, String key) {
        if (json == null) return null;
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(\\d+)").matcher(json);
        if (m.find()) return m.group(1);
        return null;
    }

    private static Integer resolveUserId(String guid) {
        if (guid == null || guid.isEmpty()) return null;
        String rightsJson = RightsJsonStore.guidMap.get(guid);
        if (rightsJson == null || rightsJson.isEmpty()) return null;
        return extractUserIdFromRights(rightsJson);
    }

    private static Integer extractUserIdFromRights(String json) {
        if (json == null) return null;
        Matcher m = Pattern.compile("\"userId\"\\s*:\\s*(-?\\d+)").matcher(json);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        m = Pattern.compile("\"userId\"\\s*:\\s*\"(-?\\d+)\"").matcher(json);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
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
