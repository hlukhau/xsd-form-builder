package com.eec.servlet.dpr;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.DatabaseUtil;
import com.eec.util.DprCreateSupport;

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
 * Смена статуса исходящей DPR (резолюции в DPRRESOLUTION по аналогии с DPA).
 * POST /api/dpr/status — тело: {@code dprid}, {@code action}, {@code guid}; для mark_ready — {@code depKindCode} (опционально).
 * Действия: mark_ready (черновик→новое + резолюция), send (новое→ожидает отправки при резолюции обл./респ. ЦГЭ), to_new (failed/error→новое).
 */
public class DprStatusChangeServlet extends HttpServlet {

    private static final int DPR_DRAFT = 4;
    private static final int DPR_NEW = 5;
    private static final int DPR_PENDING = 6;
    private static final int DPR_FAILED = 8;
    private static final int DPR_ERROR = 9;

    private static final String SQL_CURRENT = ""
            + "SELECT d.DPRID, d.DPRSTATUSID, TRIM(st.DPRSTATUSNAME) AS STNAME, TRIM(TO_CHAR(d.DATASOURCEKINDCODE)) AS DSC "
            + "FROM DPR d "
            + "LEFT JOIN DPRSTATUS st ON st.DPRSTATUSID = d.DPRSTATUSID "
            + "WHERE d.DPRID = ?";

    private static final String SQL_UPDATE = "UPDATE DPR SET DPRSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE WHERE DPRID = ?";
    private static final String SQL_INSERT_HIST = ""
            + "INSERT INTO DPRSTATUSHIST (DPRID, DPRSTATUSID, DPRSTATUSDATETIME, USERID) VALUES (?, ?, SYSDATE, ?)";
    private static final String SQL_DEPKIND_ID = "SELECT DEPKINDID FROM TB_DEPKIND WHERE TRIM(UPPER(DEPKINDCODE)) = TRIM(UPPER(?))";
    private static final String SQL_DEPKINDCODE_BY_DEPKINDID = "SELECT DEPKINDCODE FROM TB_DEPKIND WHERE DEPKINDID = ?";
    private static final String SQL_INSERT_RESOLUTION = ""
            + "INSERT INTO DPRRESOLUTION (DPRID, DPRSTATUSID, DEPKINDID, RESOLUTIONDATETIME, USERID) VALUES (?, ?, ?, SYSDATE, ?)";
    private static final String SQL_HAS_REGIONAL_OR_REPUBLICAN_RESOLUTION = ""
            + "SELECT 1 FROM DPRRESOLUTION r "
            + "JOIN TB_DEPKIND dk ON r.DEPKINDID = dk.DEPKINDID "
            + "WHERE r.DPRID = ? AND UPPER(TRIM(dk.DEPKINDCODE)) IN ('DEP0602','DEP0603') AND ROWNUM = 1";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String body = readBody(request);
        String dpridStr = extractJsonString(body, "dprid");
        String action = extractJsonString(body, "action");
        String depKindCode = extractJsonString(body, "depKindCode");
        String guid = extractJsonString(body, "guid");
        if (guid == null) guid = extractJsonStringOrNumber(body, "guid");

        if (dpridStr == null || dpridStr.trim().isEmpty() || action == null || action.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Нужны dprid и action");
            return;
        }
        long dprId;
        try {
            dprId = Long.parseLong(dpridStr.trim());
        } catch (NumberFormatException e) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "dprid должен быть числом");
            return;
        }
        action = action.trim();
        if (depKindCode != null) depKindCode = depKindCode.trim();
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
            DprCreateSupport.GateResult gate = DprCreateSupport.evaluateOutgoingDprStatusGate(conn, dprId, guid);
            if (!gate.allowed) {
                sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                        gate.reason != null ? gate.reason : "Смена статуса недоступна");
                return;
            }

            int currentStatusId;
            try (PreparedStatement ps = conn.prepareStatement(SQL_CURRENT)) {
                ps.setLong(1, dprId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        sendJsonError(response, HttpServletResponse.SC_NOT_FOUND, "Карта DPR не найдена");
                        return;
                    }
                    currentStatusId = rs.getInt("DPRSTATUSID");
                }
            }

            conn.setAutoCommit(false);
            try {
                if ("mark_ready".equals(action)) {
                    handleMarkReady(response, conn, dprId, depKindCode, currentStatusId, userId, guid);
                } else if ("send".equals(action)) {
                    handleSend(response, conn, dprId, currentStatusId, userId);
                } else if ("to_new".equals(action)) {
                    handleToNew(response, conn, dprId, currentStatusId, userId);
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

    private void handleMarkReady(HttpServletResponse response, Connection conn, long dprId, String depKindCode,
                                 int currentStatusId, Integer userId, String guid) throws IOException, SQLException {
        if (currentStatusId != DPR_DRAFT && currentStatusId != DPR_NEW) {
            fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                    "Отметка готовности возможна при статусе «Черновик» или «Новое»");
            return;
        }
        if (depKindCode == null || depKindCode.isEmpty()) {
            depKindCode = resolveDepKindCodeFromRights(conn, guid);
        }
        if (depKindCode == null || depKindCode.isEmpty()) {
            fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                    "Для отметки готовности укажите depKindCode или department.depkindid в карте прав");
            return;
        }
        int depKindId = resolveDepKindId(conn, depKindCode);
        if (depKindId <= 0) {
            fail(conn, response, HttpServletResponse.SC_BAD_REQUEST, "Неизвестный depKindCode: " + depKindCode);
            return;
        }

        if (currentStatusId == DPR_DRAFT) {
            try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE)) {
                ps.setInt(1, DPR_NEW);
                ps.setLong(2, dprId);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
                ps.setLong(1, dprId);
                ps.setInt(2, DPR_NEW);
                ps.setInt(3, userId);
                ps.executeUpdate();
            }
        }

        Savepoint sp = conn.setSavepoint("dpr_resolution");
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_RESOLUTION)) {
            ps.setLong(1, dprId);
            ps.setInt(2, DPR_NEW);
            ps.setInt(3, depKindId);
            ps.setInt(4, userId);
            ps.executeUpdate();
        } catch (SQLException e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("ORA-00001") || msg.contains("unique") || msg.contains("Unique")) {
                conn.rollback(sp);
                conn.commit();
                response.getWriter().print("{\"ok\":true,\"newStatus\":\"Новое\",\"newStatusId\":" + DPR_NEW + "}");
                return;
            }
            if (msg.contains("ORA-00942") || msg.toLowerCase().contains("does not exist")) {
                conn.rollback(sp);
                conn.rollback();
                sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Таблица DPRRESOLUTION не найдена в БД. Создайте её по образцу DPARESOLUTION (DPRID, DPRSTATUSID, DEPKINDID, RESOLUTIONDATETIME, USERID).");
                return;
            }
            throw e;
        }
        conn.commit();
        response.getWriter().print("{\"ok\":true,\"newStatus\":\"Новое\",\"newStatusId\":" + DPR_NEW + "}");
    }

    private void handleSend(HttpServletResponse response, Connection conn, long dprId, int currentStatusId, Integer userId)
            throws IOException, SQLException {
        if (currentStatusId != DPR_NEW) {
            fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                    "Направление возможно только при статусе «Новое» и наличии резолюции областного или республиканского ЦГЭ");
            return;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_HAS_REGIONAL_OR_REPUBLICAN_RESOLUTION)) {
            ps.setLong(1, dprId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                            "Направление возможно только при наличии резолюции областного или республиканского ЦГЭ.");
                    return;
                }
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE)) {
            ps.setInt(1, DPR_PENDING);
            ps.setLong(2, dprId);
            ps.executeUpdate();
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
            ps.setLong(1, dprId);
            ps.setInt(2, DPR_PENDING);
            ps.setInt(3, userId);
            ps.executeUpdate();
        }
        conn.commit();
        response.getWriter().print("{\"ok\":true,\"newStatus\":\"Ожидает отправки\",\"newStatusId\":" + DPR_PENDING + "}");
    }

    private void handleToNew(HttpServletResponse response, Connection conn, long dprId, int currentStatusId, Integer userId)
            throws IOException, SQLException {
        if (currentStatusId != DPR_FAILED && currentStatusId != DPR_ERROR) {
            fail(conn, response, HttpServletResponse.SC_BAD_REQUEST,
                    "Перевод в «Новое» возможен только из «Отправка не удалась» или «Ошибка обработки»");
            return;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE)) {
            ps.setInt(1, DPR_NEW);
            ps.setLong(2, dprId);
            ps.executeUpdate();
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
            ps.setLong(1, dprId);
            ps.setInt(2, DPR_NEW);
            ps.setInt(3, userId);
            ps.executeUpdate();
        }
        conn.commit();
        response.getWriter().print("{\"ok\":true,\"newStatus\":\"Новое\",\"newStatusId\":" + DPR_NEW + "}");
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

    private static String resolveDepKindCodeFromRights(Connection conn, String guid) throws SQLException {
        if (guid == null || guid.isEmpty()) {
            return null;
        }
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid.trim());
        if (rightsJson == null || rightsJson.isEmpty()) {
            return null;
        }
        Integer depkindid = extractDepKindIdFromRights(rightsJson);
        if (depkindid == null) {
            return null;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_DEPKINDCODE_BY_DEPKINDID)) {
            ps.setInt(1, depkindid);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getString(1);
                }
            }
        }
        return null;
    }

    private static Integer extractDepKindIdFromRights(String rightsJson) {
        Matcher m = Pattern.compile("\"depkindid\"\\s*:\\s*(-?\\d+)", Pattern.CASE_INSENSITIVE).matcher(rightsJson);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        m = Pattern.compile("\"depkindid\"\\s*:\\s*\"(-?\\d+)\"", Pattern.CASE_INSENSITIVE).matcher(rightsJson);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
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
