package com.eec.servlet;

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
 * Проверка возможности создания новой версии карты (кнопка «Сделать копию»).
 * GET /api/dpa/can-create-new-version?dpaid=...&guid=...
 * Ответ: { "allowed": true } или { "allowed": false, "reason": "..." }.
 * Условия: исходящая (DATASOURCEKINDCODE=2), статус Доставлено (11), макс. версия по INCIDENTID,
 * DPA.ENDDATE не указан, право dangerousProductOut:edit в пределах хотя бы одного подразделения из DPADEPPERMIS.
 */
public class DpaCanCreateNewVersionServlet extends HttpServlet {

    private static final String DATASOURCEKINDCODE_OUTGOING = "2";
    private static final int DPASTATUSID_DELIVERED = 11;

    private static final String SQL_SOURCE = ""
            + "SELECT p.DPAID, p.INCIDENTID, p.DPAVERSION, p.DPASTATUSID, p.DATASOURCEKINDCODE, p.ENDDATE, p.ALERTCOUNTRYID "
            + "FROM SESINT.DPA p WHERE p.DPAID = ?";
    private static final String SQL_MAX_VERSION = ""
            + "SELECT NVL(MAX(DPAVERSION), 0) FROM SESINT.DPA WHERE INCIDENTID = ? AND ALERTCOUNTRYID = ?";
    private static final String SQL_DEPS = "SELECT DEPID FROM SESINT.DPADEPPERMIS WHERE DPAID = ?";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String dpaid = request.getParameter("dpaid");
        String guid = request.getParameter("guid");
        if (dpaid == null || dpaid.trim().isEmpty()) {
            sendJson(response, false, "Укажите dpaid");
            return;
        }
        if (guid == null || guid.trim().isEmpty()) {
            sendJson(response, false, "Укажите guid");
            return;
        }
        dpaid = dpaid.trim();
        guid = guid.trim();

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnection();

            long sourceDpaid;
            try {
                sourceDpaid = Long.parseLong(dpaid);
            } catch (NumberFormatException e) {
                sendJson(response, false, "Некорректный dpaid");
                return;
            }

            int statusId = -1;
            String datasourceKindCode = null;
            String incidentId = null;
            Integer version = null;
            Integer alertCountryId = null;
            java.sql.Date endDate = null;

            try (PreparedStatement ps = conn.prepareStatement(SQL_SOURCE)) {
                ps.setLong(1, sourceDpaid);
                ResultSet rs = ps.executeQuery();
                if (!rs.next()) {
                    sendJson(response, false, "Карта с указанным DPAID не найдена");
                    return;
                }
                statusId = rs.getInt("DPASTATUSID");
                datasourceKindCode = rs.getString("DATASOURCEKINDCODE");
                incidentId = rs.getString("INCIDENTID");
                version = rs.getInt("DPAVERSION");
                alertCountryId = (Integer) rs.getObject("ALERTCOUNTRYID");
                endDate = rs.getDate("ENDDATE");
            }

            if (datasourceKindCode == null || !datasourceKindCode.trim().equals(DATASOURCEKINDCODE_OUTGOING)) {
                sendJson(response, false, "Создание новой версии доступно только для исходящих карт");
                return;
            }
            if (statusId != DPASTATUSID_DELIVERED) {
                sendJson(response, false, "Создание новой версии доступно только для карт в статусе «Доставлено»");
                return;
            }
            if (endDate != null) {
                sendJson(response, false, "Создание новой версии недоступно: указана дата закрытия (архивации) нежелательной ситуации");
                return;
            }

            int maxVersion = 0;
            try (PreparedStatement ps = conn.prepareStatement(SQL_MAX_VERSION)) {
                ps.setString(1, incidentId != null ? incidentId : "");
                ps.setObject(2, alertCountryId);
                ResultSet rs = ps.executeQuery();
                if (rs.next()) maxVersion = rs.getInt(1);
            }
            if (version == null || version.intValue() < maxVersion) {
                sendJson(response, false, "Создание новой версии доступно только для карты с максимальной версией по данному регистрационному номеру");
                return;
            }

            Set<String> cardDepIds = new HashSet<>();
            try (PreparedStatement ps = conn.prepareStatement(SQL_DEPS)) {
                ps.setLong(1, sourceDpaid);
                ResultSet rs = ps.executeQuery();
                while (rs.next()) {
                    String depId = rs.getString(1);
                    if (depId != null && !depId.trim().isEmpty()) cardDepIds.add(depId.trim());
                }
            }
            if (cardDepIds.isEmpty()) {
                sendJson(response, false, "Нет доступа к карте: в доступе к карте нет подразделений");
                return;
            }

            String rightsJson = RightsJsonStore.guidMap.get(guid);
            if (rightsJson == null || rightsJson.isEmpty()) {
                sendJson(response, false, "Права по GUID не найдены");
                return;
            }
            Set<String> userEditDepIds = parseEditDepIdsFromRights(rightsJson);
            boolean hasEdit = false;
            for (String depId : userEditDepIds) {
                if (cardDepIds.contains(depId)) { hasEdit = true; break; }
            }
            if (!hasEdit) {
                sendJson(response, false, "Нет права на редактирование исходящих сведений в пределах ни одного подразделения, имеющего доступ к данной карте");
                return;
            }

            sendJson(response, true, null);
        } catch (SQLException e) {
            sendJson(response, false, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static Set<String> parseEditDepIdsFromRights(String json) {
        Set<String> out = new HashSet<>();
        int outStart = json.indexOf("\"dangerousProductOut\"");
        if (outStart < 0) return out;
        int editStart = json.indexOf("\"edit\"", outStart);
        if (editStart < 0) return out;
        int braceStart = json.indexOf('{', editStart);
        if (braceStart < 0) return out;
        int depth = 1;
        int i = braceStart + 1;
        while (i < json.length() && depth > 0) {
            char c = json.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') depth--;
            i++;
        }
        String editBlock = depth == 0 ? json.substring(braceStart, i) : "";
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(editBlock);
        while (keyM.find()) out.add(keyM.group(1).trim());
        return out;
    }

    private static void sendJson(HttpServletResponse response, boolean allowed, String reason) throws IOException {
        response.setStatus(HttpServletResponse.SC_OK);
        StringBuilder sb = new StringBuilder();
        sb.append("{\"allowed\":").append(allowed);
        if (reason != null) sb.append(",\"reason\":").append(quote(reason));
        sb.append("}");
        response.getWriter().print(sb.toString());
    }

    private static String quote(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }
}
