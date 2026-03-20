package com.eec.servlet.pha;

import com.eec.servlet.RightsJsonStore;
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
 * Проверка возможности создания новой версии карты PHA.
 * GET /api/pha/can-create-new-version?phaid=...&guid=...
 * Условия: DATASOURCEKINDCODE=2, PHASTATUSID=10 (Доставлено), максимальная версия по INCIDENTID+ALERTCOUNTRYID,
 * PHA.ENDDATE не указан, право publicHealthOut:edit с пересечением DEPID в PHADEPPERMIS.
 */
public class PhaCanCreateNewVersionServlet extends HttpServlet {

    private static final String DATASOURCEKINDCODE_OUTGOING = "2";
    private static final int PHASTATUSID_DELIVERED = 10;

    private static final String SQL_SOURCE = ""
            + "SELECT p.PHAID, p.INCIDENTID, p.PHAVERSION, p.PHASTATUSID, p.DATASOURCEKINDCODE, p.ENDDATE, p.ALERTCOUNTRYID "
            + "FROM PHA p WHERE p.PHAID = ?";
    private static final String SQL_MAX_VERSION = ""
            + "SELECT NVL(MAX(PHAVERSION), 0) FROM PHA WHERE INCIDENTID = ? AND ALERTCOUNTRYID = ?";
    private static final String SQL_DEPS = "SELECT DEPID FROM PHADEPPERMIS WHERE PHAID = ?";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String phaid = request.getParameter("phaid");
        String guid = request.getParameter("guid");
        if (phaid == null || phaid.trim().isEmpty()) {
            sendJson(response, false, "Укажите phaid");
            return;
        }
        if (guid == null || guid.trim().isEmpty()) {
            sendJson(response, false, "Укажите guid");
            return;
        }
        phaid = phaid.trim();
        guid = guid.trim();

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);

            long sourcePhaid;
            try {
                sourcePhaid = Long.parseLong(phaid);
            } catch (NumberFormatException e) {
                sendJson(response, false, "Некорректный phaid");
                return;
            }

            int statusId;
            String datasourceKindCode;
            String incidentId;
            Integer version;
            Integer alertCountryId;
            java.sql.Date endDate;

            try (PreparedStatement ps = conn.prepareStatement(SQL_SOURCE)) {
                ps.setLong(1, sourcePhaid);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        sendJson(response, false, "Карта с указанным PHAID не найдена");
                        return;
                    }
                    statusId = rs.getInt("PHASTATUSID");
                    datasourceKindCode = rs.getString("DATASOURCEKINDCODE");
                    incidentId = rs.getString("INCIDENTID");
                    version = rs.getInt("PHAVERSION");
                    alertCountryId = (Integer) rs.getObject("ALERTCOUNTRYID");
                    endDate = rs.getDate("ENDDATE");
                }
            }

            if (datasourceKindCode == null || !DATASOURCEKINDCODE_OUTGOING.equals(datasourceKindCode.trim())) {
                sendJson(response, false, "Создание новой версии доступно только для исходящих карт");
                return;
            }
            if (statusId != PHASTATUSID_DELIVERED) {
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
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) maxVersion = rs.getInt(1);
                }
            }
            if (version == null || version.intValue() < maxVersion) {
                sendJson(response, false, "Создание новой версии доступно только для карты с максимальной версией по данному регистрационному номеру");
                return;
            }

            Set<String> cardDepIds = new HashSet<>();
            try (PreparedStatement ps = conn.prepareStatement(SQL_DEPS)) {
                ps.setLong(1, sourcePhaid);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        String depId = rs.getString(1);
                        if (depId != null && !depId.trim().isEmpty()) {
                            cardDepIds.add(depId.trim());
                        }
                    }
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
                if (cardDepIds.contains(depId)) {
                    hasEdit = true;
                    break;
                }
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
        int outStart = json.indexOf("\"publicHealthOut\"");
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
