package com.eec.servlet.smd;

import com.eec.util.DatabaseUtil;
import com.eec.util.ServletRequestGuid;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

/**
 * Метаданные карты SMD (шапка) из VW_SMD / SESINT.VW_SMD / таблицы SMD.
 * GET /api/smd/metadata/{SMDID}?guid=...
 */
public class SmdMetadataServlet extends HttpServlet {

    private static final String SQL_DEP = "SELECT DEPID FROM SMDDEPPERMIS WHERE SMDID = ? ORDER BY DEPID";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите SMDID: /api/smd/metadata/{SMDID}");
            return;
        }

        String smdidStr = pathInfo.startsWith("/") ? pathInfo.substring(1).trim() : pathInfo.trim();
        if (smdidStr.isEmpty()) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "SMDID не задан");
            return;
        }

        String guid = ServletRequestGuid.resolve(request);
        if (guid == null) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Укажите guid в query (?guid=...) или заголовок X-GUID");
            return;
        }

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        try (Connection conn = DatabaseUtil.getConnectionForRequest(request, guid)) {
            long smdid = parseSmdid(smdidStr, response);
            if (smdid < 0) {
                return;
            }

            MetadataRow row = loadMetadataRow(conn, smdid);
            if (row == null) {
                sendJsonError(response, HttpServletResponse.SC_NOT_FOUND,
                        "Запись с SMDID " + smdidStr + " не найдена (VW_SMD / SMD)");
                return;
            }

            enrichOptionalFields(conn, row);
            List<String> depIds = loadAccessibleDepIds(conn, smdid);
            writeJson(response, row, depIds);
            System.out.println("[SmdMetadataServlet] Served metadata for SMDID: " + smdid);

        } catch (SQLException e) {
            System.err.println("[SmdMetadataServlet] DB error for SMDID " + smdidStr + ": " + e.getMessage());
            e.printStackTrace();
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        }
    }

    private static MetadataRow loadMetadataRow(Connection conn, long smdid) throws SQLException {
        SQLException last = null;
        for (String sql : new String[] {
                SmdDbSupport.SQL_METADATA_VW,
                SmdDbSupport.SQL_METADATA_VW_SESINT,
                SmdDbSupport.SQL_METADATA_SMD
        }) {
            try {
                MetadataRow row = queryMetadataRow(conn, smdid, sql);
                if (row != null) {
                    return row;
                }
            } catch (SQLException e) {
                last = e;
                if (!SmdDbSupport.isMissingObject(e)) {
                    throw e;
                }
            }
        }
        if (last != null) {
            throw last;
        }
        return null;
    }

    private static MetadataRow queryMetadataRow(Connection conn, long smdid, String sql) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                MetadataRow row = new MetadataRow();
                row.docCountryName = getString(rs, "DOCCOUNTRYNAME");
                row.docCountryId = getInt(rs, "DOCCOUNTRYID");
                row.docCountryCode = getString(rs, "DOCCOUNTRYCODE");
                row.docId = getString(rs, "DOCID");
                row.docCreationDate = formatDate(rs, "DOCCREATIONDATE");
                row.smdVersion = getInt(rs, "SMDVERSION");
                row.dataSourceKindCode = getString(rs, "DATASOURCEKINDCODE");
                row.dataSourceKindName = getString(rs, "DATASOURCEKINDNAME");
                row.creationDateTime = formatTimestamp(rs, "CREATIONDATETIME");
                row.modificationDateTime = formatTimestamp(rs, "MODIFICATIONDATETIME");
                row.smdStatusName = getString(rs, "SMDSTATUSNAME");
                row.smdStatusCode = getString(rs, "SMDSTATUSCODE");
                row.smdStatusDesc = getString(rs, "SMASTATUSDESC");
                row.smrStatusDesc = getString(rs, "SMRSTATUSDESC");
                row.messageName = getString(rs, "MESSAGENAME");
                row.messageCode = getString(rs, "MESSAGECODE");
                return row;
            }
        }
    }

    private static void enrichOptionalFields(Connection conn, MetadataRow row) {
        if (row.docCountryCode == null && row.docCountryId != null) {
            try (PreparedStatement ps = conn.prepareStatement(SmdDbSupport.SQL_COUNTRY_CODE)) {
                ps.setInt(1, row.docCountryId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        row.docCountryCode = getString(rs, "COUNTRYCODE");
                    }
                }
            } catch (SQLException e) {
                if (!SmdDbSupport.isMissingObject(e)) {
                    System.err.println("[SmdMetadataServlet] COUNTRY lookup: " + e.getMessage());
                }
            }
        }
        if (row.dataSourceKindName == null && row.dataSourceKindCode != null && !row.dataSourceKindCode.isEmpty()) {
            try (PreparedStatement ps = conn.prepareStatement(SmdDbSupport.SQL_DATASOURCE_NAME)) {
                ps.setString(1, row.dataSourceKindCode);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        row.dataSourceKindName = getString(rs, "DATASOURCEKINDNAME");
                    }
                }
            } catch (SQLException e) {
                if (!SmdDbSupport.isMissingObject(e)) {
                    System.err.println("[SmdMetadataServlet] DATASOURCEKIND lookup: " + e.getMessage());
                }
            }
        }
    }

    private static List<String> loadAccessibleDepIds(Connection conn, long smdid) {
        List<String> ids = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(SQL_DEP)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String id = rs.getString(1);
                    if (id != null && !id.trim().isEmpty()) {
                        ids.add(id.trim());
                    }
                }
            }
        } catch (SQLException e) {
            if (!SmdDbSupport.isMissingObject(e)) {
                System.err.println("[SmdMetadataServlet] SMDDEPPERMIS: " + e.getMessage());
            }
        }
        return ids;
    }

    private static void writeJson(HttpServletResponse response, MetadataRow row, List<String> depIds) throws IOException {
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"docCountryName\":").append(quote(row.docCountryName));
        json.append(",\"docCountryCode\":").append(quote(row.docCountryCode));
        json.append(",\"docId\":").append(quote(row.docId));
        json.append(",\"docCreationDate\":").append(quote(row.docCreationDate));
        json.append(",\"smdVersion\":").append(row.smdVersion != null ? row.smdVersion : "null");
        json.append(",\"dataSourceKindCode\":").append(quote(row.dataSourceKindCode));
        json.append(",\"dataSourceKindName\":").append(quote(row.dataSourceKindName));
        json.append(",\"creationDateTime\":").append(quote(row.creationDateTime));
        json.append(",\"modificationDateTime\":").append(quote(row.modificationDateTime));
        json.append(",\"smdStatusName\":").append(quote(row.smdStatusName));
        json.append(",\"smdStatusCode\":").append(quote(row.smdStatusCode));
        json.append(",\"smdStatusDesc\":").append(quote(row.smdStatusDesc));
        json.append(",\"smrStatusDesc\":").append(quote(row.smrStatusDesc));
        json.append(",\"messageName\":").append(quote(row.messageName));
        json.append(",\"messageCode\":").append(quote(row.messageCode));
        json.append(",\"smdAccessibleDepIds\":[");
        for (int i = 0; i < depIds.size(); i++) {
            if (i > 0) json.append(',');
            json.append(quote(depIds.get(i)));
        }
        json.append("]}");
        response.setStatus(HttpServletResponse.SC_OK);
        PrintWriter out = response.getWriter();
        out.write(json.toString());
        out.flush();
    }

    private static long parseSmdid(String smdidStr, HttpServletResponse response) throws IOException {
        try {
            return Long.parseLong(smdidStr);
        } catch (NumberFormatException e) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный SMDID");
            return -1;
        }
    }

    private static String getString(ResultSet rs, String column) throws SQLException {
        try {
            return rs.getString(column);
        } catch (SQLException e) {
            return null;
        }
    }

    private static Integer getInt(ResultSet rs, String column) throws SQLException {
        try {
            int v = rs.getInt(column);
            return rs.wasNull() ? null : v;
        } catch (SQLException e) {
            return null;
        }
    }

    private static String formatTimestamp(ResultSet rs, String column) throws SQLException {
        try {
            Timestamp ts = rs.getTimestamp(column);
            if (ts == null) return null;
            return ts.toInstant().toString();
        } catch (SQLException e) {
            return null;
        }
    }

    private static String formatDate(ResultSet rs, String column) throws SQLException {
        try {
            java.sql.Date d = rs.getDate(column);
            if (d == null) return null;
            return d.toLocalDate().toString();
        } catch (SQLException e) {
            return null;
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

    private static final class MetadataRow {
        String docCountryName;
        Integer docCountryId;
        String docCountryCode;
        String docId;
        String docCreationDate;
        Integer smdVersion;
        String dataSourceKindCode;
        String dataSourceKindName;
        String creationDateTime;
        String modificationDateTime;
        String smdStatusName;
        String smdStatusCode;
        String smdStatusDesc;
        String smrStatusDesc;
        String messageName;
        String messageCode;
    }
}
