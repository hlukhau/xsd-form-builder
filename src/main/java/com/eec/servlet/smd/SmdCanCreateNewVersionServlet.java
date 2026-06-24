package com.eec.servlet.smd;

import com.eec.rights.RightsRegistryProvider;
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
 * Проверка возможности создания новой версии карты SMD.
 * GET /api/smd/can-create-new-version?smdid=...&guid=...
 */
public class SmdCanCreateNewVersionServlet extends HttpServlet {

    private static final String DATASOURCE_OUTGOING = "2";
    private static final String STATUS_DELIVERED = "DELIVERED";
    private static final String MESSAGE_CANCEL = "P.SS.09.MSG.003";

    private static final String SQL_SOURCE = ""
            + "SELECT s.SMDID, s.SMDVERSION, s.SMDSTATUSID, s.DATASOURCEKINDCODE, s.DOCID, s.DOCCOUNTRYID, "
            + "       s.DOCCREATIONDATE, TRIM(s.MESSAGECODE) AS MESSAGECODE "
            + "FROM SMD s WHERE s.SMDID = ?";

    private static final String SQL_MAX_VERSION = ""
            + "SELECT NVL(MAX(SMDVERSION), 0) FROM SMD "
            + "WHERE TRIM(DOCID) = TRIM(?) AND DOCCOUNTRYID = ? AND TRUNC(DOCCREATIONDATE) = TRUNC(?) "
            + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ?";

    private static final String SQL_DEPS = "SELECT DEPID FROM SMDDEPPERMIS WHERE SMDID = ?";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String smdid = request.getParameter("smdid");
        String guid = request.getParameter("guid");
        if (smdid == null || smdid.trim().isEmpty()) {
            sendJson(response, false, "Укажите smdid");
            return;
        }
        if (guid == null || guid.trim().isEmpty()) {
            sendJson(response, false, "Укажите guid");
            return;
        }
        smdid = smdid.trim();
        guid = guid.trim();

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);

            long sourceSmdid;
            try {
                sourceSmdid = Long.parseLong(smdid);
            } catch (NumberFormatException e) {
                sendJson(response, false, "Некорректный smdid");
                return;
            }

            int statusId;
            String datasourceKindCode;
            Integer version;
            String docId;
            Integer docCountryId;
            java.sql.Date docCreationDate;
            String messageCode;

            try (PreparedStatement ps = conn.prepareStatement(SQL_SOURCE)) {
                ps.setLong(1, sourceSmdid);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        sendJson(response, false, "Карта с указанным SMDID не найдена");
                        return;
                    }
                    statusId = rs.getInt("SMDSTATUSID");
                    datasourceKindCode = rs.getString("DATASOURCEKINDCODE");
                    version = toNullableInt(rs.getObject("SMDVERSION"));
                    docId = rs.getString("DOCID");
                    docCountryId = toNullableInt(rs.getObject("DOCCOUNTRYID"));
                    docCreationDate = rs.getDate("DOCCREATIONDATE");
                    messageCode = rs.getString("MESSAGECODE");
                }
            }

            if (datasourceKindCode == null || !DATASOURCE_OUTGOING.equals(datasourceKindCode.trim())) {
                sendJson(response, false, "Создание новой версии доступно только для исходящих карт");
                return;
            }

            int deliveredStatusId = resolveStatusIdByCode(conn, STATUS_DELIVERED);
            if (deliveredStatusId <= 0) {
                sendJson(response, false, "Не найден статус DELIVERED в справочнике SMDSTATUS");
                return;
            }
            if (statusId != deliveredStatusId) {
                sendJson(response, false, "Создание новой версии доступно только для карт в статусе «Доставлено»");
                return;
            }

            if (messageCode != null && MESSAGE_CANCEL.equalsIgnoreCase(messageCode.trim())) {
                sendJson(response, false,
                        "Создание новой версии недоступно для карты с видом сообщения об отмене меры (P.SS.09.MSG.003)");
                return;
            }

            int maxVersion = 0;
            try (PreparedStatement ps = conn.prepareStatement(SQL_MAX_VERSION)) {
                ps.setString(1, docId != null ? docId : "");
                ps.setObject(2, docCountryId);
                ps.setDate(3, docCreationDate);
                ps.setString(4, DATASOURCE_OUTGOING);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) maxVersion = rs.getInt(1);
                }
            }
            if (version == null || version < maxVersion) {
                sendJson(response, false,
                        "Создание новой версии доступно только для карты с максимальной версией по данному номеру и дате документа");
                return;
            }

            Set<String> cardDepIds = new HashSet<>();
            try (PreparedStatement ps = conn.prepareStatement(SQL_DEPS)) {
                ps.setLong(1, sourceSmdid);
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

            String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
            if (rightsJson == null || rightsJson.isEmpty()) {
                sendJson(response, false, "Права по GUID не найдены");
                return;
            }
            Set<String> userEditDepIds = parseSanitaryMeasureOutEditDepIds(rightsJson);
            boolean hasEdit = false;
            for (String depId : userEditDepIds) {
                if (cardDepIds.contains(depId)) {
                    hasEdit = true;
                    break;
                }
            }
            if (!hasEdit) {
                sendJson(response, false,
                        "Нет права sanitaryMeasureOut:edit в пределах ни одного подразделения, имеющего доступ к данной карте");
                return;
            }

            sendJson(response, true, null);
        } catch (SQLException e) {
            sendJson(response, false, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static int resolveStatusIdByCode(Connection conn, String statusCode) throws SQLException {
        String sql = ""
                + "SELECT SMDSTATUSID FROM SMDSTATUS "
                + "WHERE TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
                + "AND UPPER(TRIM(SMDSTATUSCODE)) = ? AND SMDSTATUSACTFL = 1 AND ROWNUM = 1";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, DATASOURCE_OUTGOING);
            ps.setString(2, statusCode.trim().toUpperCase());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt(1);
            }
        }
        return -1;
    }

    private static Integer toNullableInt(Object v) {
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).intValue();
        try {
            return Integer.valueOf(String.valueOf(v).trim());
        } catch (Exception e) {
            return null;
        }
    }

    private static Set<String> parseSanitaryMeasureOutEditDepIds(String json) {
        Set<String> out = new HashSet<>();
        int outStart = json.indexOf("\"sanitaryMeasureOut\"");
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
