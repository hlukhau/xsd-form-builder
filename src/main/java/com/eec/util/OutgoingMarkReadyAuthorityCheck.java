package com.eec.util;

import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.sql.Clob;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Проверка заполнения уполномоченного органа (csdo:AuthorityName в UnifiedAuthorityDetails)
 * перед отметкой готовности исходящих DPA/PPV/DPR.
 */
public final class OutgoingMarkReadyAuthorityCheck {

    public static final String ERROR_MESSAGE =
            "Отметка о готовности запрещена, необходимо указать уполномоченный орган";

    private static final Pattern AUTHORITY_NAME_IN_XML = Pattern.compile(
            "<(?:\\w+:)?AuthorityName[^>]*>([^<]*)</(?:\\w+:)?AuthorityName>",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern DPR_UNIFIED_AUTHORITY_BLOCK = Pattern.compile(
            "<(?:\\w+:)?UnifiedAuthorityDetails\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?UnifiedAuthorityDetails>",
            Pattern.CASE_INSENSITIVE);

    private OutgoingMarkReadyAuthorityCheck() {
    }

    /**
     * @param cardTable   DPA или PPV
     * @param cardIdColumn DPAID или PPVID
     * @param xmlTable    DPAXML или PPVXML
     * @param xmlIdColumn DPAID или PPVID
     * @param xmlBodyColumn DPAXMLBODY или PPVXMLBODY
     * @return true если проверка пройдена; иначе ответ 400 уже отправлен
     */
    public static boolean ensureAuthorityNamePresent(Connection conn, HttpServletResponse response,
                                                     long cardId, String cardTable, String cardIdColumn,
                                                     String xmlTable, String xmlIdColumn, String xmlBodyColumn)
            throws IOException, SQLException {
        String nameFromAuthority = loadAuthorityNameFromDb(conn, cardId, cardTable, cardIdColumn);
        if (isNonBlank(nameFromAuthority)) {
            return true;
        }
        String nameFromXml = loadAuthorityNameFromXml(conn, cardId, xmlTable, xmlIdColumn, xmlBodyColumn);
        if (isNonBlank(nameFromXml)) {
            return true;
        }
        sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, ERROR_MESSAGE);
        return false;
    }

    /**
     * DPR: AuthorityName в первом блоке UnifiedAuthorityDetails (DPRXML.DPRXMLBODY).
     */
    public static boolean ensureDprAuthorityNamePresent(Connection conn, HttpServletResponse response, long dprId)
            throws IOException, SQLException {
        String nameFromXml = loadDprNotifyingAuthorityNameFromXml(conn, dprId);
        if (isNonBlank(nameFromXml)) {
            return true;
        }
        sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, ERROR_MESSAGE);
        return false;
    }

    private static String loadDprNotifyingAuthorityNameFromXml(Connection conn, long dprId) throws SQLException {
        String sql = "SELECT DPRXMLBODY FROM DPRXML WHERE DPRID = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, dprId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                Clob clob = rs.getClob(1);
                if (clob == null) {
                    return null;
                }
                String xml = clob.getSubString(1, (int) clob.length());
                if (xml == null || xml.isEmpty()) {
                    return null;
                }
                Matcher block = DPR_UNIFIED_AUTHORITY_BLOCK.matcher(xml);
                if (!block.find()) {
                    return null;
                }
                Matcher nameM = AUTHORITY_NAME_IN_XML.matcher(block.group(1));
                if (nameM.find()) {
                    String val = nameM.group(1);
                    if (isNonBlank(val)) {
                        return val.trim();
                    }
                }
            }
        }
        return null;
    }

    private static String loadAuthorityNameFromDb(Connection conn, long cardId,
                                                  String cardTable, String cardIdColumn) throws SQLException {
        String sql = "SELECT TRIM(a.AUTHORITYNAME) AS NM FROM " + cardTable + " c "
                + "LEFT JOIN AUTHORITY a ON a.AUTHORITYID = c.AUTHORITYID "
                + "WHERE c." + cardIdColumn + " = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, cardId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getString("NM");
                }
            }
        }
        return null;
    }

    private static String loadAuthorityNameFromXml(Connection conn, long cardId,
                                                   String xmlTable, String xmlIdColumn, String xmlBodyColumn)
            throws SQLException {
        String sql = "SELECT " + xmlBodyColumn + " FROM " + xmlTable + " WHERE " + xmlIdColumn + " = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, cardId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                Clob clob = rs.getClob(1);
                if (clob == null) {
                    return null;
                }
                String xml = clob.getSubString(1, (int) clob.length());
                if (xml == null || xml.isEmpty()) {
                    return null;
                }
                Matcher m = AUTHORITY_NAME_IN_XML.matcher(xml);
                while (m.find()) {
                    String val = m.group(1);
                    if (val != null && !val.trim().isEmpty()) {
                        return val.trim();
                    }
                }
            }
        }
        return null;
    }

    private static boolean isNonBlank(String s) {
        return s != null && !s.trim().isEmpty();
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        String esc = message != null ? message.replace("\\", "\\\\").replace("\"", "\\\"") : "";
        response.getWriter().print("{\"error\":\"" + esc + "\"}");
    }
}
