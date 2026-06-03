package com.eec.servlet.smd;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.AccessRightService;
import com.eec.util.DatabaseUtil;
import com.eec.util.ServletRequestGuid;

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
 * API доступа к карте по SMDID: подразделения (TB_DEP + TB_DEPKIND DEPKINDCODE), связь SMDDEPPERMIS(SMDID, DEPID).
 * GET /api/smd/access?smdid=...&guid=...&source=incoming|outgoing|eec&creatorDepId=...
 * POST /api/smd/access — тело JSON { "smdid": "...", "depId": "...", "guid": "..." }
 * DELETE /api/smd/access?smdid=...&depId=...&guid=...
 * Подключение к БД — по кредам из JSON прав (реестр GUID).
 */
public class SmdAccessServlet extends HttpServlet {

    private static final String SQL_LIST = ""
            + "SELECT d.DEPID, d.DEPNAME, dk.DEPKINDCODE "
            + "FROM SMDDEPPERMIS dp "
            + "JOIN TB_DEP d ON d.DEPID = dp.DEPID "
            + "LEFT JOIN TB_DEPKIND dk ON d.DEPKINDID = dk.DEPKINDID "
            + "WHERE dp.SMDID = ? "
            + "ORDER BY d.DEPNAME";
    /** ЦГЭ по умолчанию для входящих и ЕЭК: 006, 101, 201, 301, 401, 501, 601, 700 */
    private static final String[] DEFAULT_DEP_IDS = { "006", "101", "201", "301", "401", "501", "601", "700" };
    private static final String SQL_DEFAULT_LIST = ""
            + "SELECT d.DEPID, d.DEPNAME, dk.DEPKINDCODE "
            + "FROM TB_DEP d "
            + "LEFT JOIN TB_DEPKIND dk ON d.DEPKINDID = dk.DEPKINDID "
            + "WHERE d.DEPID IN (?,?,?,?,?,?,?,?) ORDER BY d.DEPID";
    private static final String SQL_SOURCE = "SELECT t.DATASOURCEKINDNAME FROM VW_SMD vw LEFT JOIN DATASOURCEKIND t ON vw.DATASOURCEKINDCODE = t.DATASOURCEKINDCODE WHERE vw.SMDID = ?";
    /** Один ЦГЭ по DEPID — для списка по умолчанию (исходящие: ЦГЭ создателя) */
    private static final String SQL_ONE_DEP = "SELECT d.DEPID, d.DEPNAME, dk.DEPKINDCODE FROM TB_DEP d LEFT JOIN TB_DEPKIND dk ON d.DEPKINDID = dk.DEPKINDID WHERE d.DEPID = ?";
    private static final String SQL_ADD = "INSERT INTO SMDDEPPERMIS (SMDID, DEPID, GRANTDATETIME) VALUES (?, ?, SYSDATE)";
    private static final String SQL_DELETE = "DELETE FROM SMDDEPPERMIS WHERE SMDID = ? AND DEPID = ?";
    /** Ручное управление доступом: только районный / областной ЦГЭ (не республиканский dep0603). */
    private static final String SQL_DEP_KIND_FOR_DEP = ""
            + "SELECT UPPER(TRIM(dk.DEPKINDCODE)) FROM TB_DEP d "
            + "LEFT JOIN TB_DEPKIND dk ON d.DEPKINDID = dk.DEPKINDID WHERE d.DEPID = ?";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String smdid = request.getParameter("smdid");
        if (smdid == null || smdid.trim().isEmpty()) {
            smdid = request.getParameter("dpaid");
        }
        String guid = ServletRequestGuid.resolve(request);
        if (smdid == null || smdid.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Параметр smdid обязателен");
            return;
        }
        if (guid == null) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Укажите guid в query (?guid=...) или заголовок X-GUID");
            return;
        }
        smdid = smdid.trim();
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
            bindSmdid(ps, 1, smdid);
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
            log("SmdAccess GET: " + e.getMessage());
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
        String smdid;
        String depId;
        String contentType = request.getContentType();
        if (contentType != null && contentType.contains("application/json")) {
            StringBuilder sb = new StringBuilder();
            try (BufferedReader r = request.getReader()) {
                String line;
                while ((line = r.readLine()) != null) sb.append(line);
            }
            String body = sb.toString();
            smdid = extractJsonString(body, "smdid");
            if (smdid == null) smdid = extractJsonString(body, "dpaid");
            depId = extractJsonString(body, "depId");
            request.setAttribute("guid", extractJsonString(body, "guid"));
        } else {
            smdid = request.getParameter("smdid");
            if (smdid == null) smdid = request.getParameter("dpaid");
            depId = request.getParameter("depId");
        }
        if (smdid == null || smdid.trim().isEmpty() || depId == null || depId.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Нужны smdid и depId");
            return;
        }
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String guid = request.getAttribute("guid") instanceof String
                ? (String) request.getAttribute("guid")
                : ServletRequestGuid.resolve(request);
        if (guid == null || guid.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Для управления доступом необходим guid (карта прав)");
            return;
        }
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid.trim());
        String accessRight = resolveAccessRightBySmdid(request, smdid, guid);
        if (accessRight != null && !checkAccessRight(accessRight, rightsJson)) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права на управление доступом");
            return;
        }

        Connection conn = null;
        PreparedStatement ps = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            if (!isSmdAccessAllowedDepKind(conn, depId.trim())) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Добавление доступа разрешено только для подразделений с видом dep0601 или dep0602 (районный / областной ЦГЭ). "
                                + "Республиканский уровень (dep0603) подключается системой автоматически.");
                return;
            }
            ps = conn.prepareStatement(SQL_ADD);
            bindSmdid(ps, 1, smdid);
            ps.setString(2, depId.trim());
            ps.executeUpdate();
            response.getWriter().print("{\"ok\":true}");
        } catch (SQLException e) {
            log("SmdAccess POST: " + e.getMessage());
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            if (ps != null) try { ps.close(); } catch (SQLException ignored) { }
            DatabaseUtil.closeConnection(conn);
        }
    }

    @Override
    protected void doDelete(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String smdid = request.getParameter("smdid");
        if (smdid == null || smdid.trim().isEmpty()) {
            smdid = request.getParameter("dpaid");
        }
        String depId = request.getParameter("depId");
        String guid = ServletRequestGuid.resolve(request);
        if (smdid == null || smdid.trim().isEmpty() || depId == null || depId.trim().isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Нужны smdid и depId");
            return;
        }
        if (guid == null) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Для управления доступом необходим guid (карта прав)");
            return;
        }
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid.trim());
        String accessRight = resolveAccessRightBySmdid(request, smdid, guid);
        if (accessRight != null && !checkAccessRight(accessRight, rightsJson)) {
            sendJsonError(response, HttpServletResponse.SC_FORBIDDEN, "Нет права на управление доступом");
            return;
        }

        Connection conn = null;
        PreparedStatement ps = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            if (!isSmdAccessAllowedDepKind(conn, depId.trim())) {
                sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                        "Исключение из доступа разрешено только для подразделений с видом dep0601 или dep0602. "
                                + "Республиканский уровень (dep0603) исключается системой, вручную удалить его нельзя.");
                return;
            }
            ps = conn.prepareStatement(SQL_DELETE);
            bindSmdid(ps, 1, smdid);
            ps.setString(2, depId.trim());
            int n = ps.executeUpdate();
            response.getWriter().print("{\"ok\":true,\"deleted\":" + n + "}");
        } catch (SQLException e) {
            log("SmdAccess DELETE: " + e.getMessage());
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            if (ps != null) try { ps.close(); } catch (SQLException ignored) { }
            DatabaseUtil.closeConnection(conn);
        }
    }

    /** Определяет право по источнику карты (VW_SMD + DATASOURCEKIND). */
    private String resolveAccessRightBySmdid(HttpServletRequest request, String smdid, String guid) {
        Connection conn = null;
        PreparedStatement ps = null;
        ResultSet rs = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            ps = conn.prepareStatement(SQL_SOURCE);
            bindSmdid(ps, 1, smdid);
            rs = ps.executeQuery();
            if (!rs.next()) return null;
            String name = rs.getString(1);
            if (name == null) return null;
            String n = name.trim().toLowerCase();
            if (n.contains("входящ")) return "sanitaryMeasureIn:access";
            if (n.contains("исходящ")) return "sanitaryMeasureOut:access";
            if (n.contains("еэк") || n.contains("данные еэк")) return "sanitaryMeasureDB:access";
            return null;
        } catch (SQLException e) {
            log("SmdAccess resolveAccessRight: " + e.getMessage());
            return null;
        } finally {
            if (rs != null) try { rs.close(); } catch (SQLException ignored) { }
            if (ps != null) try { ps.close(); } catch (SQLException ignored) { }
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static boolean checkAccessRight(String right, String rightsJson) {
        if ("sanitaryMeasureIn:access".equals(right)) return AccessRightService.hasSanitaryMeasureInAccess(rightsJson);
        if ("sanitaryMeasureOut:access".equals(right)) return AccessRightService.hasSanitaryMeasureOutAccess(rightsJson);
        if ("sanitaryMeasureDB:access".equals(right)) return AccessRightService.hasSanitaryMeasureDBAccess(rightsJson);
        return true;
    }

    /** Простой извлечение значения строки из JSON вида "key":"value" */
    private static String extractJsonString(String json, String key) {
        Pattern p = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher m = p.matcher(json);
        return m.find() ? m.group(1) : null;
    }

    private static void bindSmdid(PreparedStatement ps, int index, String smaid) throws SQLException {
        try {
            ps.setLong(index, Long.parseLong(smaid.trim()));
        } catch (NumberFormatException e) {
            ps.setString(index, smaid.trim());
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

    /** dep0601 / dep0602 — ручное управление перечнем SMDDEPPERMIS; dep0603 (РЦГЭ) только системой. */
    private static boolean isSmdAccessAllowedDepKind(Connection conn, String depId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_DEP_KIND_FOR_DEP)) {
            bindDepIdForKindQuery(ps, 1, depId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return false;
                }
                String k = rs.getString(1);
                if (k == null) {
                    return false;
                }
                String u = k.trim();
                return "DEP0601".equalsIgnoreCase(u) || "DEP0602".equalsIgnoreCase(u);
            }
        }
    }

    private static void bindDepIdForKindQuery(PreparedStatement ps, int index, String depId) throws SQLException {
        try {
            ps.setLong(index, Long.parseLong(depId.trim()));
        } catch (NumberFormatException e) {
            ps.setString(index, depId.trim());
        }
    }
}
