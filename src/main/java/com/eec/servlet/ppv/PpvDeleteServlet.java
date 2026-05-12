package com.eec.servlet.ppv;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.AccessRightService;
import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Удаление черновика карты исходящих сведений о выявленных нарушениях (PPV).
 * POST /api/ppv/delete — тело JSON { "dpaid": <number>, "guid": "<GUID>" }.
 * Условия: DATASOURCEKINDCODE=2, статус DRAFT в PPVSTATUS для исходящих, violationDetectedOut:edit
 * с пересечением ключей edit с активными PPVDEPPERMIS (REVOKEDATETIME IS NULL).
 */
public class PpvDeleteServlet extends HttpServlet {

    private static final String DATASOURCEKINDCODE_OUTGOING = "2";

    private static final String SQL_RESOLVE_DRAFT_STATUS = ""
            + "SELECT PPVSTATUSID FROM PPVSTATUS "
            + "WHERE TRIM(UPPER(PPVSTATUSCODE)) = 'DRAFT' "
            + "AND (DATASOURCEKINDCODE = 2 OR TRIM(TO_CHAR(DATASOURCEKINDCODE)) = '2') "
            + "AND PPVSTATUSACTFL = 1 AND ROWNUM = 1";

    private static final String SQL_CHECK = ""
            + "SELECT p.INCIDENTID FROM PPV p "
            + "WHERE p.PPVID = ? AND TRIM(TO_CHAR(p.DATASOURCEKINDCODE)) = ? AND p.PPVSTATUSID = ?";

    private static final String SQL_DEPS = ""
            + "SELECT DEPID FROM PPVDEPPERMIS WHERE PPVID = ? AND REVOKEDATETIME IS NULL";

    private static final String SQL_DELETE_STATUSHIST = "DELETE FROM PPVSTATUSHIST WHERE PPVID = ?";
    private static final String SQL_DELETE_DEPPERMIS = "DELETE FROM PPVDEPPERMIS WHERE PPVID = ?";
    private static final String SQL_DELETE_RESOLUTION = "DELETE FROM PPVRESOLUTION WHERE PPVID = ?";
    private static final String SQL_DELETE_PPVACTOR = "DELETE FROM PPVACTOR WHERE PPVID = ?";
    private static final String SQL_DELETE_PPVXML = "DELETE FROM PPVXML WHERE PPVID = ?";
    private static final String SQL_DELETE_PPV = "DELETE FROM PPV WHERE PPVID = ?";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");

        String body = readBody(request);
        if (body == null || body.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Тело запроса пусто");
            return;
        }
        Long dpaidLong = extractJsonLong(body, "dpaid");
        String guid = extractJsonString(body, "guid");
        if (dpaidLong == null || dpaidLong <= 0) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите dpaid в теле запроса");
            return;
        }
        if (guid == null || guid.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid для проверки права на удаление");
            return;
        }
        long dpaid = dpaidLong;
        guid = guid.trim();

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            conn.setAutoCommit(false);

            Integer draftStatusId;
            try (PreparedStatement ps = conn.prepareStatement(SQL_RESOLVE_DRAFT_STATUS);
                 ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    safeRollback(conn);
                    sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                            "В справочнике PPVSTATUS не найден активный статус DRAFT для исходящих сведений (DATASOURCEKINDCODE=2).");
                    return;
                }
                draftStatusId = rs.getInt(1);
            }

            String incidentId;
            try (PreparedStatement ps = conn.prepareStatement(SQL_CHECK)) {
                ps.setLong(1, dpaid);
                ps.setString(2, DATASOURCEKINDCODE_OUTGOING);
                ps.setInt(3, draftStatusId);
                ResultSet rs = ps.executeQuery();
                if (!rs.next()) {
                    safeRollback(conn);
                    sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                            "Удаление возможно только для исходящей карты в статусе «Черновик» (PPV не найдена или условия не выполнены).");
                    return;
                }
                incidentId = rs.getString(1);
                if (incidentId == null) incidentId = "";
            }

            boolean commandInvoke = Boolean.TRUE.equals(request.getAttribute("com.eec.command.invoke"));
            if (!commandInvoke) {
                Set<String> cardDepIds = new HashSet<>();
                try (PreparedStatement ps = conn.prepareStatement(SQL_DEPS)) {
                    ps.setLong(1, dpaid);
                    ResultSet rs = ps.executeQuery();
                    while (rs.next()) {
                        String depId = rs.getString(1);
                        if (depId != null && !depId.trim().isEmpty()) {
                            cardDepIds.add(depId.trim());
                        }
                    }
                }
                if (cardDepIds.isEmpty()) {
                    safeRollback(conn);
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                            "Нет доступа к карте: нет активных подразделений в PPVDEPPERMIS.");
                    return;
                }
                String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
                if (rightsJson == null || rightsJson.isEmpty()) {
                    safeRollback(conn);
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Права по GUID не найдены.");
                    return;
                }
                if (!AccessRightService.hasViolationDetectedOutEdit(rightsJson)) {
                    safeRollback(conn);
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                            "Нет права violationDetectedOut:edit.");
                    return;
                }
                Set<String> userEditDepIds = AccessRightService.violationDetectedOutEditDepKeys(rightsJson);
                boolean hasEditInCardDeps = false;
                for (String depId : userEditDepIds) {
                    if (cardDepIds.contains(depId)) {
                        hasEditInCardDeps = true;
                        break;
                    }
                }
                if (!hasEditInCardDeps) {
                    safeRollback(conn);
                    sendJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                            "Право violationDetectedOut:edit не распространяется ни на одно подразделение из активного доступа к карте (PPVDEPPERMIS).");
                    return;
                }
            }

            try (PreparedStatement ps = conn.prepareStatement(SQL_DELETE_STATUSHIST)) {
                ps.setLong(1, dpaid);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_DELETE_DEPPERMIS)) {
                ps.setLong(1, dpaid);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_DELETE_RESOLUTION)) {
                ps.setLong(1, dpaid);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_DELETE_PPVACTOR)) {
                ps.setLong(1, dpaid);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_DELETE_PPVXML)) {
                ps.setLong(1, dpaid);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement(SQL_DELETE_PPV)) {
                ps.setLong(1, dpaid);
                int n = ps.executeUpdate();
                if (n == 0) {
                    safeRollback(conn);
                    sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Запись PPV не удалена.");
                    return;
                }
            }

            conn.commit();
            response.setStatus(HttpServletResponse.SC_OK);
            String regNumber = incidentId.isEmpty() ? String.valueOf(dpaid) : incidentId;
            response.getWriter().print("{\"success\":true,\"registrationNumber\":\"" + escapeJson(regNumber) + "\"}");
        } catch (SQLException e) {
            safeRollback(conn);
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static void safeRollback(Connection conn) {
        if (conn == null) return;
        try {
            if (!conn.getAutoCommit()) {
                conn.rollback();
            }
        } catch (SQLException ignored) {
        }
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

    private static Long extractJsonLong(String json, String key) {
        Pattern p = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(-?\\d+)");
        Matcher m = p.matcher(json);
        return m.find() ? Long.parseLong(m.group(1)) : null;
    }

    private static String extractJsonString(String json, String key) {
        Pattern p = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher m = p.matcher(json);
        return m.find() ? m.group(1) : null;
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ");
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.getWriter().print("{\"error\":\"" + escapeJson(message) + "\"}");
    }
}
