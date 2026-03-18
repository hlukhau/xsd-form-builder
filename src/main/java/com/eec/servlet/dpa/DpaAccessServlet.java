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
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/**
 * API доступа к карте по DPAID: подразделения (SESDEV.TB_DEP + TB_DEPKIND DEPKINDCODE), связь SESINT.DPADEPPERMIS(DPAID, DEPID).
 * GET /api/dpa/access?dpaid=...&source=incoming|outgoing|eec&creatorDepId=... — список { id, name, depKindCode }; при пустом списке и source=outgoing и creatorDepId — по умолчанию ЦГЭ создателя карты (из JSON прав department.depid).
 * POST /api/dpa/access — тело JSON { "dpaid": "...", "depId": "..." } — добавить подразделение (проверка права по источнику карты).
 * DELETE /api/dpa/access?dpaid=...&depId=... — удалить (проверка права по источнику карты).
 */
public class DpaAccessServlet extends HttpServlet {

    private static final String SQL_LIST = ""
            + "SELECT d.DEPID, d.DEPNAME, dk.DEPKINDCODE "
            + "FROM SESINT.DPADEPPERMIS dp "
            + "JOIN SESDEV.TB_DEP d ON d.DEPID = dp.DEPID "
            + "LEFT JOIN SESDEV.TB_DEPKIND dk ON d.DEPKINDID = dk.DEPKINDID "
            + "WHERE dp.DPAID = ? "
            + "ORDER BY d.DEPNAME";
    /** ЦГЭ по умолчанию для входящих и ЕЭК: 006, 101, 201, 301, 401, 501, 601, 700 */
    private static final String[] DEFAULT_DEP_IDS = { "006", "101", "201", "301", "401", "501", "601", "700" };
    private static final String SQL_DEFAULT_LIST = ""
            + "SELECT d.DEPID, d.DEPNAME, dk.DEPKINDCODE "
            + "FROM SESDEV.TB_DEP d "
            + "LEFT JOIN SESDEV.TB_DEPKIND dk ON d.DEPKINDID = dk.DEPKINDID "
            + "WHERE d.DEPID IN (?,?,?,?,?,?,?,?) ORDER BY d.DEPID";
    private static final String SQL_SOURCE = "SELECT t.DATASOURCEKINDNAME FROM VW_DPA vw LEFT JOIN DATASOURCEKIND t ON vw.DATASOURCEKINDCODE = t.DATASOURCEKINDCODE WHERE vw.DPAID = ?";
    /** Один ЦГЭ по DEPID — для списка по умолчанию (исходящие: ЦГЭ создателя) */
    private static final String SQL_ONE_DEP = "SELECT d.DEPID, d.DEPNAME, dk.DEPKINDCODE FROM SESDEV.TB_DEP d LEFT JOIN SESDEV.TB_DEPKIND dk ON d.DEPKINDID = dk.DEPKINDID WHERE d.DEPID = ?";
    private static final String SQL_ADD = "INSERT INTO SESINT.DPADEPPERMIS (DPAID, DEPID, GRANTDATETIME) VALUES (?, ?, SYSDATE)";
    private static final String SQL_DELETE = "DELETE FROM SESINT.DPADEPPERMIS WHERE DPAID = ? AND DEPID = ?";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String dpaid = request.getParameter("dpaid");
        String guid = request.getParameter("guid");
        if (dpaid == null || dpaid.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Параметр dpaid обязателен");
            return;
        }
        String source = request.getParameter("source");
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            ps = conn.prepareStatement(SQL_LIST);
            bindDpaid(ps, 1, dpaid);
            rs = ps.executeQuery();
            List<String[]> rows = new ArrayList<>();
            while (rs.next()) {
                String uid = rs.getString(1);
                String name = rs.getString(2);
                String depKindCode = rs.getString(3);
                if (uid == null) uid = "";
                if (name == null) name = "";
                if (depKindCode == null) depKindCode = "";
                rows.add(new String[]{uid, name, depKindCode});
            }
            if (rs != null) { rs.close(); rs = null; }
            if (ps != null) { ps.close(); ps = null; }

            if (rows.isEmpty() && source != null) {
                String src = source.trim().toLowerCase();
                if ("incoming".equals(src) || "eec".equals(src)) {
                    ps = conn.prepareStatement(SQL_DEFAULT_LIST);
                    for (int i = 0; i < DEFAULT_DEP_IDS.length; i++) {
                        ps.setString(i + 1, DEFAULT_DEP_IDS[i]);
                    }
                    rs = ps.executeQuery();
                    while (rs.next()) {
                        rows.add(new String[]{
                                nullToEmpty(rs.getString(1)),
                                nullToEmpty(rs.getString(2)),
                                nullToEmpty(rs.getString(3))
                        });
                    }
                    if (rs != null) { rs.close(); rs = null; }
                    if (ps != null) { ps.close(); ps = null; }
                } else if ("outgoing".equals(src)) {
                    String creatorDepId = request.getParameter("creatorDepId");
                    if (creatorDepId != null && !creatorDepId.trim().isEmpty()) {
                        creatorDepId = creatorDepId.trim();
                        ps = conn.prepareStatement(SQL_ONE_DEP);
                        ps.setString(1, creatorDepId);
                        rs = ps.executeQuery();
                        if (rs.next()) {
                            rows.add(new String[]{
                                    nullToEmpty(rs.getString(1)),
                                    nullToEmpty(rs.getString(2)),
                                    nullToEmpty(rs.getString(3))
                            });
                        }
                        if (rs != null) { rs.close(); rs = null; }
                        if (ps != null) { ps.close(); ps = null; }
                    }
                }
            }

            StringBuilder json = new StringBuilder("[");
            boolean first = true;
            for (String[] row : rows) {
                if (!first) json.append(",");
                first = false;
                json.append("{\"id\":").append(quote(row[0])).append(",\"name\":").append(quote(row[1])).append(",\"depKindCode\":").append(quote(row[2])).append("}");
            }
            json.append("]");
            response.getWriter().print(json.toString());
        } catch (SQLException e) {
            log("DpaAccess GET: " + e.getMessage());
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            if (rs != null) try { rs.close(); } catch (SQLException ignored) { }
            if (ps != null) try { ps.close(); } catch (SQLException ignored) { }
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String dpaid;
        String depId;
        String contentType = request.getContentType();
        if (contentType != null && contentType.contains("application/json")) {
            StringBuilder sb = new StringBuilder();
            try (BufferedReader r = request.getReader()) {
                String line;
                while ((line = r.readLine()) != null) sb.append(line);
            }
            String body = sb.toString();
            dpaid = extractJsonString(body, "dpaid");
            depId = extractJsonString(body, "depId");
            request.setAttribute("guid", extractJsonString(body, "guid"));
        } else {
            dpaid = request.getParameter("dpaid");
            depId = request.getParameter("depId");
        }
        if (dpaid == null || dpaid.trim().isEmpty() || depId == null || depId.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Нужны dpaid и depId");
            return;
        }
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String guid = request.getAttribute("guid") instanceof String
                ? (String) request.getAttribute("guid")
                : request.getParameter("guid");
        if (guid == null || guid.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Для управления доступом необходим guid (карта прав)");
            return;
        }
        String rightsJson = RightsJsonStore.guidMap.get(guid.trim());
        String accessRight = resolveAccessRightByDpaid(request, dpaid, guid);
        if (accessRight != null && !checkAccessRight(accessRight, rightsJson)) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права на управление доступом");
            return;
        }

        Connection conn = null;
        PreparedStatement ps = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            ps = conn.prepareStatement(SQL_ADD);
            bindDpaid(ps, 1, dpaid);
            ps.setString(2, depId.trim());
            ps.executeUpdate();
            response.getWriter().print("{\"ok\":true}");
        } catch (SQLException e) {
            log("DpaAccess POST: " + e.getMessage());
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            if (ps != null) try { ps.close(); } catch (SQLException ignored) { }
            DatabaseUtil.closeConnection(conn);
        }
    }

    @Override
    protected void doDelete(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String dpaid = request.getParameter("dpaid");
        String depId = request.getParameter("depId");
        String guid = request.getParameter("guid");
        if (dpaid == null || dpaid.trim().isEmpty() || depId == null || depId.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Нужны dpaid и depId");
            return;
        }
        if (guid == null || guid.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Для управления доступом необходим guid (карта прав)");
            return;
        }
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String rightsJson = RightsJsonStore.guidMap.get(guid.trim());
        String accessRight = resolveAccessRightByDpaid(request, dpaid, guid);
        if (accessRight != null && !checkAccessRight(accessRight, rightsJson)) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права на управление доступом");
            return;
        }

        Connection conn = null;
        PreparedStatement ps = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            ps = conn.prepareStatement(SQL_DELETE);
            bindDpaid(ps, 1, dpaid);
            ps.setString(2, depId.trim());
            int n = ps.executeUpdate();
            response.getWriter().print("{\"ok\":true,\"deleted\":" + n + "}");
        } catch (SQLException e) {
            log("DpaAccess DELETE: " + e.getMessage());
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            if (ps != null) try { ps.close(); } catch (SQLException ignored) { }
            DatabaseUtil.closeConnection(conn);
        }
    }

    /** Определяет право по источнику карты (VW_DPA + DATASOURCEKIND). */
    private String resolveAccessRightByDpaid(HttpServletRequest request, String dpaid, String guid) {
        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            ps = conn.prepareStatement(SQL_SOURCE);
            bindDpaid(ps, 1, dpaid);
            rs = ps.executeQuery();
            if (!rs.next()) return null;
            String name = rs.getString(1);
            if (name == null) return null;
            String n = name.trim().toLowerCase();
            if (n.contains("входящ")) return "dangerousProductIn:access";
            if (n.contains("исходящ")) return "dangerousProductOut:access";
            if (n.contains("еэк") || n.contains("данные еэк")) return "dangerousProductDB:access";
            return null;
        } catch (SQLException e) {
            log("DpaAccess resolveAccessRight: " + e.getMessage());
            return null;
        } finally {
            if (rs != null) try { rs.close(); } catch (SQLException ignored) { }
            if (ps != null) try { ps.close(); } catch (SQLException ignored) { }
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static boolean checkAccessRight(String right, String rightsJson) {
        if ("dangerousProductIn:access".equals(right)) return AccessRightService.hasDangerousProductInAccess(rightsJson);
        if ("dangerousProductOut:access".equals(right)) return AccessRightService.hasDangerousProductOutAccess(rightsJson);
        if ("dangerousProductDB:access".equals(right)) return AccessRightService.hasDangerousProductDBAccess(rightsJson);
        return true;
    }

    /** Простой извлечение значения строки из JSON вида "key":"value" */
    private static String extractJsonString(String json, String key) {
        Pattern p = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher m = p.matcher(json);
        return m.find() ? m.group(1) : null;
    }

    private static void bindDpaid(PreparedStatement ps, int index, String dpaid) throws SQLException {
        try {
            ps.setLong(index, Long.parseLong(dpaid.trim()));
        } catch (NumberFormatException e) {
            ps.setString(index, dpaid.trim());
        }
    }

    private static String quote(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        String escaped = message != null ? message.replace("\\", "\\\\").replace("\"", "\\\"") : "Unknown error";
        response.getWriter().print("{\"error\":\"" + escaped + "\"}");
    }
}
