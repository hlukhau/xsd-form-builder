package com.eec.servlet.dpr;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.DatabaseUtil;
import com.eec.util.DprAccessHelper;
import com.eec.util.DprCreateSupport;
import com.eec.util.DprIncomingStatusHelper;

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
 * Метаданные карты DPR (шапка) из VW_DPR.
 * GET /api/dpr/metadata/{DPRID}?guid=...
 * <p>
 * Входящие (DATASOURCEKINDCODE=1): при первом открытии, если статус RECEIVED, в той же транзакции
 * выполняется переход в PROCESSING и запись в DPRSTATUSHIST (USERID из JSON прав по guid).
 */
public class DprMetadataServlet extends HttpServlet {

    private static final String SQL = ""
            + "SELECT vw.INCIDENTID, vw.RESPONSECOUNTRYNAME, "
            + "       TRIM(TO_CHAR(vw.DATASOURCEKINDCODE)) AS DATASOURCEKINDCODE, t1.DATASOURCEKINDNAME, "
            + "       vw.DPRSTATUSNAME, vw.CREATIONDATETIME, vw.MODIFICATIONDATETIME, "
            + "       (SELECT MIN(p.PPVID) FROM PPV p WHERE TRIM(p.INCIDENTID) = TRIM(vw.INCIDENTID)) AS LINKED_PPVID, "
            + "       d.DPRSTATUSID, d.DPRVERSION, d.PPVID AS DPR_PPVID, "
            + "       TRIM(UPPER(NVL(dst.DPRSTATUSCODE, ''))) AS DPRSTATUSCODE "
            + "FROM VW_DPR vw "
            + "LEFT JOIN DATASOURCEKIND t1 ON TRIM(TO_CHAR(vw.DATASOURCEKINDCODE)) = TRIM(TO_CHAR(t1.DATASOURCEKINDCODE)) "
            + "LEFT JOIN DPR d ON d.DPRID = vw.DPRID "
            + "LEFT JOIN DPRSTATUS dst ON dst.DPRSTATUSID = d.DPRSTATUSID "
            + "WHERE vw.DPRID = ?";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите DPRID: /api/dpr/metadata/{DPRID}");
            return;
        }

        String idStr = pathInfo.startsWith("/") ? pathInfo.substring(1).trim() : pathInfo.trim();
        if (idStr.isEmpty()) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "DPRID не задан");
            return;
        }

        String guid = request.getParameter("guid");
        if (guid != null) guid = guid.trim();
        if (guid == null || guid.isEmpty()) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid");
            return;
        }

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        long dprId;
        try {
            dprId = Long.parseLong(idStr);
        } catch (NumberFormatException e) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный DPRID");
            return;
        }

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            if (!DprAccessHelper.canViewDpr(conn, dprId, guid)) {
                sendError(response, HttpServletResponse.SC_FORBIDDEN, "Нет доступа к просмотру карты DPR (требуется доступ к связанной карте PPV).");
                return;
            }

            conn.setAutoCommit(false);
            Savepoint beforeTransition = conn.setSavepoint("dpr_meta_before_incoming_open");
            try {
                if (DprIncomingStatusHelper.applyReceivedToProcessingOnFirstOpen(
                        conn, dprId, resolveUserIdFromGuid(guid))) {
                    System.out.println("[DprMetadataServlet] Incoming first open: DPRID=" + dprId + " RECEIVED→PROCESSING");
                }
            } catch (SQLException e) {
                System.err.println("[DprMetadataServlet] Incoming RECEIVED→PROCESSING skipped: " + e.getMessage());
                try {
                    conn.rollback(beforeTransition);
                } catch (SQLException rb) {
                    DatabaseUtil.rollbackQuietly(conn);
                }
            }

            try (PreparedStatement ps = conn.prepareStatement(SQL)) {
                ps.setLong(1, dprId);
                ResultSet rs = ps.executeQuery();
                if (!rs.next()) {
                    sendError(response, HttpServletResponse.SC_NOT_FOUND, "Карта DPR с указанным идентификатором не найдена.");
                    return;
                }

                String incidentId = rs.getString("INCIDENTID");
                String responseCountry = rs.getString("RESPONSECOUNTRYNAME");
                String dscCode = rs.getString("DATASOURCEKINDCODE");
                String dscName = rs.getString("DATASOURCEKINDNAME");
                String statusName = rs.getString("DPRSTATUSNAME");
                Timestamp created = rs.getTimestamp("CREATIONDATETIME");
                Timestamp modified = rs.getTimestamp("MODIFICATIONDATETIME");
                long linkedPpvid = rs.getLong("LINKED_PPVID");
                if (rs.wasNull()) {
                    linkedPpvid = 0;
                }
                long dprPpvid = rs.getLong("DPR_PPVID");
                if (!rs.wasNull() && dprPpvid > 0) {
                    linkedPpvid = dprPpvid;
                }
                int dprStatusId = rs.getInt("DPRSTATUSID");
                if (rs.wasNull()) {
                    dprStatusId = 0;
                }
                long dprVersion = rs.getLong("DPRVERSION");
                if (rs.wasNull()) {
                    dprVersion = 0;
                }
                String dprStatusCode = rs.getString("DPRSTATUSCODE");
                if (dprStatusCode == null) {
                    dprStatusCode = "";
                }

                boolean canEdit = false;
                try {
                    DprCreateSupport.GateResult eg = DprCreateSupport.evaluateEditGate(conn, dprId, guid);
                    canEdit = eg.allowed;
                } catch (SQLException ignored) {
                    canEdit = false;
                }

                boolean canDeleteDraft = false;
                try {
                    DprCreateSupport.GateResult dg = DprCreateSupport.evaluateDeleteDraftGate(conn, dprId, guid);
                    canDeleteDraft = dg.allowed;
                } catch (SQLException ignored) {
                    canDeleteDraft = false;
                }

                boolean canValidateOutgoingCard = false;
                try {
                    DprCreateSupport.GateResult vg = DprCreateSupport.evaluateOutgoingDprValidateCardGate(conn, dprId, guid);
                    canValidateOutgoingCard = vg.allowed;
                } catch (SQLException ignored) {
                    canValidateOutgoingCard = false;
                }

                boolean canChangeOutgoingStatus = false;
                try {
                    DprCreateSupport.GateResult sg = DprCreateSupport.evaluateOutgoingDprStatusGate(conn, dprId, guid);
                    canChangeOutgoingStatus = sg.allowed;
                } catch (SQLException ignored) {
                    canChangeOutgoingStatus = false;
                }

                boolean canSendOutgoing = false;
                try {
                    DprCreateSupport.GateResult sendG = DprCreateSupport.evaluateOutgoingDprSendGate(conn, dprId, guid);
                    canSendOutgoing = sendG.allowed;
                } catch (SQLException ignored) {
                    canSendOutgoing = false;
                }

                boolean canCompleteIncomingProcessing = false;
                try {
                    DprCreateSupport.GateResult cg = DprCreateSupport.evaluateIncomingDprCompleteProcessingGate(conn, dprId, guid);
                    canCompleteIncomingProcessing = cg.allowed;
                } catch (SQLException ignored) {
                    canCompleteIncomingProcessing = false;
                }

                PrintWriter out = response.getWriter();
                out.print("{");
                out.print("\"incidentId\":" + quote(incidentId));
                out.print(",\"responseCountryName\":" + quote(responseCountry));
                out.print(",\"datasourceKindCode\":" + quote(dscCode));
                out.print(",\"datasourceKindName\":" + quote(dscName));
                out.print(",\"dprStatusName\":" + quote(statusName));
                out.print(",\"creationDateTime\":" + quote(tsToIso(created)));
                out.print(",\"modificationDateTime\":" + quote(tsToIso(modified)));
                out.print(",\"linkedPpvid\":" + linkedPpvid);
                out.print(",\"dprStatusId\":" + dprStatusId);
                out.print(",\"dprStatusCode\":" + quote(dprStatusCode.isEmpty() ? null : dprStatusCode));
                out.print(",\"dprVersion\":" + dprVersion);
                out.print(",\"canEdit\":" + (canEdit ? "true" : "false"));
                out.print(",\"canDeleteDraft\":" + (canDeleteDraft ? "true" : "false"));
                out.print(",\"canValidateOutgoingCard\":" + (canValidateOutgoingCard ? "true" : "false"));
                out.print(",\"canChangeOutgoingStatus\":" + (canChangeOutgoingStatus ? "true" : "false"));
                out.print(",\"canSendOutgoing\":" + (canSendOutgoing ? "true" : "false"));
                out.print(",\"canCompleteIncomingProcessing\":" + (canCompleteIncomingProcessing ? "true" : "false"));
                out.print("}");
                out.flush();
                conn.commit();
                response.setStatus(HttpServletResponse.SC_OK);
            }
        } catch (SQLException e) {
            DatabaseUtil.rollbackQuietly(conn);
            sendError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
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

    private static String tsToIso(Timestamp ts) {
        if (ts == null) return null;
        return ts.toInstant().toString();
    }

    private static String quote(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }

    private static void sendError(HttpServletResponse response, int status, String msg) throws IOException {
        response.setStatus(status);
        PrintWriter out = response.getWriter();
        out.print("{\"error\":" + quote(msg) + "}");
        out.flush();
    }
}
