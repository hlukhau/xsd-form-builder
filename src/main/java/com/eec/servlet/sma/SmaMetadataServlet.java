package com.eec.servlet.sma;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.DatabaseUtil;
import com.eec.util.SmaCreateSupport;
import com.eec.util.SmaIncomingStatusHelper;

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
import java.sql.Savepoint;
import java.sql.Timestamp;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Метаданные карты SMAQ/SMAR.
 * GET /api/sma/metadata/{kind}/{id}?guid=...
 */
public class SmaMetadataServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        SmaPathIds ids = SmaServletUtil.parseKindAndId(request.getPathInfo());
        if (ids == null) {
            SmaServletUtil.sendError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Укажите вид и идентификатор: /api/sma/metadata/{smaq|smar}/{id}");
            return;
        }
        String guid = request.getParameter("guid");
        if (guid != null) {
            guid = guid.trim();
        }
        if (guid == null || guid.isEmpty()) {
            SmaServletUtil.sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid");
            return;
        }

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            if (!canView(conn, ids.kind, ids.id, guid)) {
                SmaServletUtil.sendError(response, HttpServletResponse.SC_FORBIDDEN,
                        "Нет доступа к просмотру карты (требуется доступ к связанной карте SMD).");
                return;
            }

            conn.setAutoCommit(false);
            Savepoint beforeTransition = conn.setSavepoint("sma_meta_before_incoming_open");
            try {
                if (SmaIncomingStatusHelper.applyReceivedToProcessingOnFirstOpen(
                        conn, ids.kind, ids.id, resolveUserIdFromGuid(guid))) {
                    System.out.println("[SmaMetadataServlet] Incoming first open: " + ids.kind + " ID="
                            + ids.id + " RECEIVED→PROCESSING");
                }
            } catch (SQLException e) {
                System.err.println("[SmaMetadataServlet] Incoming RECEIVED→PROCESSING skipped: " + e.getMessage());
                try {
                    conn.rollback(beforeTransition);
                } catch (SQLException rb) {
                    DatabaseUtil.rollbackQuietly(conn);
                }
            }

            try (PreparedStatement ps = prepareMetadataQuery(conn, ids.kind, ids.id)) {
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        SmaServletUtil.sendError(response, HttpServletResponse.SC_NOT_FOUND,
                                "Карта с указанным идентификатором не найдена.");
                        return;
                    }
                    writeMetadataJson(response, conn, ids.kind, ids.id, guid, rs);
                    conn.commit();
                    response.setStatus(HttpServletResponse.SC_OK);
                }
            }
        } catch (SQLException e) {
            DatabaseUtil.rollbackQuietly(conn);
            SmaServletUtil.sendError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "Ошибка БД: " + e.getMessage());
        } finally {
            if (conn != null) {
                try {
                    conn.setAutoCommit(true);
                } catch (SQLException ignored) {
                }
            }
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static void writeMetadataJson(HttpServletResponse response, Connection conn, SmaCardKind kind,
                                          long id, String guid, ResultSet rs) throws SQLException, IOException {
        long smdid = rs.getLong("SMDID");
        if (rs.wasNull()) {
            smdid = 0;
        }
        long linkedSmdid = rs.getLong(kind == SmaCardKind.SMAQ ? "SMAQ_SMDID" : "SMDID");
        if (!rs.wasNull() && linkedSmdid > 0) {
            smdid = linkedSmdid;
        }

        long linkedSmaqid = 0L;
        Long linkedSmaqVersion = null;
        if (kind == SmaCardKind.SMAR) {
            linkedSmaqid = rs.getLong("SMAR_SMAQID");
            if (rs.wasNull()) {
                linkedSmaqid = rs.getLong("SMAQID");
            }
            try {
                long v = rs.getLong("LINKED_SMAQVERSION");
                if (!rs.wasNull()) {
                    linkedSmaqVersion = v;
                }
            } catch (SQLException ignored) {
                linkedSmaqVersion = null;
            }
        } else {
            linkedSmaqid = rs.getLong("SMAQID");
        }

        String docId = rs.getString("DOCID");
        String docCountryCode = rs.getString("DOCCOUNTRYCODE");
        Timestamp docCreationDate = rs.getTimestamp("DOCCREATIONDATE");
        String requestCountry = rs.getString("REQUESTCOUNTRYNAME");
        String requestCountryCode = null;
        String authorityUid = null;
        if (kind == SmaCardKind.SMAQ) {
            try {
                requestCountryCode = rs.getString("REQUESTCOUNTRYCODE");
            } catch (SQLException ignored) {
                requestCountryCode = null;
            }
            try {
                authorityUid = rs.getString("AUTHORITYUID");
            } catch (SQLException ignored) {
                authorityUid = null;
            }
        }
        String dscCode = rs.getString("DATASOURCEKINDCODE");
        String dscName = rs.getString("DATASOURCEKINDNAME");
        String statusName = kind == SmaCardKind.SMAQ ? rs.getString("SMAQSTATUSNAME") : rs.getString("SMARSTATUSNAME");
        Timestamp created = rs.getTimestamp("CREATIONDATETIME");
        Timestamp modified = rs.getTimestamp("MODIFICATIONDATETIME");
        int statusId = kind == SmaCardKind.SMAQ ? rs.getInt("SMAQSTATUSID") : rs.getInt("SMARSTATUSID");
        if (rs.wasNull()) {
            statusId = 0;
        }
        long version = kind == SmaCardKind.SMAQ ? rs.getLong("SMAQVERSION") : rs.getLong("SMARVERSION");
        if (rs.wasNull()) {
            version = 0;
        }
        String statusCode = rs.getString("SMASTATUSCODE");
        if (statusCode == null) {
            statusCode = "";
        }
        String edocCode = null;
        if (kind == SmaCardKind.SMAR) {
            edocCode = rs.getString("EDOCCODE");
        }

        boolean canEdit = gateAllowed(kind == SmaCardKind.SMAQ
                ? SmaCreateSupport.evaluateSmaqEditGate(conn, id, guid)
                : SmaCreateSupport.evaluateSmarEditGate(conn, id, guid));
        boolean canDeleteDraft = gateAllowed(kind == SmaCardKind.SMAQ
                ? SmaCreateSupport.evaluateSmaqDeleteGate(conn, id, guid)
                : SmaCreateSupport.evaluateSmarDeleteGate(conn, id, guid));
        boolean canSend = gateAllowed(kind == SmaCardKind.SMAQ
                ? SmaCreateSupport.evaluateSmaqSendGate(conn, id, guid)
                : SmaCreateSupport.evaluateSmarSendGate(conn, id, guid));
        boolean canCompleteIncomingProcessing = gateAllowed(
                SmaCreateSupport.evaluateIncomingCompleteProcessingGate(conn, kind, id, guid));

        PrintWriter out = response.getWriter();
        out.print("{");
        out.print("\"cardKind\":" + SmaServletUtil.quote(kind.apiName()));
        out.print(",\"linkedSmdid\":" + smdid);
        if (kind == SmaCardKind.SMAR) {
            out.print(",\"linkedSmaqid\":" + linkedSmaqid);
            if (linkedSmaqVersion != null) {
                out.print(",\"linkedSmaqVersion\":" + linkedSmaqVersion);
            } else {
                out.print(",\"linkedSmaqVersion\":null");
            }
        }
        out.print(",\"docId\":" + SmaServletUtil.quote(docId));
        out.print(",\"docCountryCode\":" + SmaServletUtil.quote(docCountryCode));
        out.print(",\"docCreationDate\":" + SmaServletUtil.quote(SmaServletUtil.tsToIso(docCreationDate)));
        out.print(",\"requestCountryName\":" + SmaServletUtil.quote(requestCountry));
        if (kind == SmaCardKind.SMAQ) {
            out.print(",\"requestCountryCode\":" + SmaServletUtil.quote(requestCountryCode));
            out.print(",\"authorityUid\":" + SmaServletUtil.quote(authorityUid));
        }
        out.print(",\"datasourceKindCode\":" + SmaServletUtil.quote(dscCode));
        out.print(",\"datasourceKindName\":" + SmaServletUtil.quote(dscName));
        out.print(",\"statusName\":" + SmaServletUtil.quote(statusName));
        out.print(",\"creationDateTime\":" + SmaServletUtil.quote(SmaServletUtil.tsToIso(created)));
        out.print(",\"modificationDateTime\":" + SmaServletUtil.quote(SmaServletUtil.tsToIso(modified)));
        out.print(",\"statusId\":" + statusId);
        out.print(",\"statusCode\":" + SmaServletUtil.quote(statusCode.isEmpty() ? null : statusCode));
        out.print(",\"version\":" + version);
        if (kind == SmaCardKind.SMAR) {
            out.print(",\"edocCode\":" + SmaServletUtil.quote(edocCode));
        }
        out.print(",\"canEdit\":" + (canEdit ? "true" : "false"));
        out.print(",\"canDeleteDraft\":" + (canDeleteDraft ? "true" : "false"));
        out.print(",\"canSend\":" + (canSend ? "true" : "false"));
        out.print(",\"canCompleteIncomingProcessing\":" + (canCompleteIncomingProcessing ? "true" : "false"));
        out.print("}");
        out.flush();
    }

    private static boolean gateAllowed(SmaCreateSupport.GateResult gate) {
        return gate != null && gate.allowed;
    }

    private static boolean canView(Connection conn, SmaCardKind kind, long id, String guid) throws SQLException {
        return kind == SmaCardKind.SMAQ
                ? SmaAccessHelper.canViewSmaq(conn, id, guid)
                : SmaAccessHelper.canViewSmar(conn, id, guid);
    }

    static PreparedStatement prepareMetadataQuery(Connection conn, SmaCardKind kind, long id) throws SQLException {
        String[] queries;
        if (kind == SmaCardKind.SMAQ) {
            queries = new String[]{
                    SmaDbSupport.SQL_METADATA_SMAQ_VW,
                    SmaDbSupport.SQL_METADATA_SMAQ_VW_SESINT,
                    SmaDbSupport.SQL_METADATA_SMAQ_FALLBACK,
                    SmaDbSupport.SQL_METADATA_SMAQ_FALLBACK_SESINT
            };
        } else {
            queries = new String[]{
                    SmaDbSupport.SQL_METADATA_SMAR_VW,
                    SmaDbSupport.SQL_METADATA_SMAR_VW_SESINT,
                    SmaDbSupport.SQL_METADATA_SMAR_FALLBACK,
                    SmaDbSupport.SQL_METADATA_SMAR_FALLBACK_SESINT
            };
        }
        SQLException last = null;
        for (String sql : queries) {
            try {
                PreparedStatement ps = conn.prepareStatement(sql);
                ps.setLong(1, id);
                return ps;
            } catch (SQLException e) {
                last = e;
                if (!SmaDbSupport.isMissingObject(e)) {
                    throw e;
                }
            }
        }
        if (last != null) {
            throw last;
        }
        throw new SQLException("Не удалось подготовить запрос метаданных SMA");
    }

    private static Integer resolveUserIdFromGuid(String guid) {
        if (guid == null || guid.isEmpty()) {
            return null;
        }
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
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
}
