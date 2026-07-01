package com.eec.servlet.smr;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.DatabaseUtil;
import com.eec.util.SmrCreateSupport;
import com.eec.util.SmrIncomingStatusHelper;

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
 * Метаданные карты SMR (шапка) из VW_SMR.
 * GET /api/smr/metadata/{SMRID}?guid=...
 * <p>
 * Входящие (DATASOURCEKINDCODE=1): при первом открытии, если статус RECEIVED, в той же транзакции
 * выполняется переход в PROCESSING и запись в SMRSTATUSHIST (USERID из JSON прав по guid).
 */
public class SmrMetadataServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите SMRID: /api/smr/metadata/{SMRID}");
            return;
        }

        String idStr = pathInfo.startsWith("/") ? pathInfo.substring(1).trim() : pathInfo.trim();
        if (idStr.isEmpty()) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "SMRID не задан");
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

        long smrId;
        try {
            smrId = Long.parseLong(idStr);
        } catch (NumberFormatException e) {
            sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный SMRID");
            return;
        }

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            if (!SmrAccessHelper.canViewSmr(conn, smrId, guid)) {
                sendError(response, HttpServletResponse.SC_FORBIDDEN,
                        "Нет доступа к просмотру карты SMR (требуется доступ к связанной карте SMD).");
                return;
            }

            conn.setAutoCommit(false);
            Savepoint beforeTransition = conn.setSavepoint("smr_meta_before_incoming_open");
            try {
                if (SmrIncomingStatusHelper.applyReceivedToProcessingOnFirstOpen(
                        conn, smrId, resolveUserIdFromGuid(guid))) {
                    System.out.println("[SmrMetadataServlet] Incoming first open: SMRID=" + smrId + " RECEIVED→PROCESSING");
                }
            } catch (SQLException e) {
                System.err.println("[SmrMetadataServlet] Incoming RECEIVED→PROCESSING skipped: " + e.getMessage());
                try {
                    conn.rollback(beforeTransition);
                } catch (SQLException rb) {
                    DatabaseUtil.rollbackQuietly(conn);
                }
            }

            try (PreparedStatement ps = prepareMetadataQuery(conn, smrId)) {
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        sendError(response, HttpServletResponse.SC_NOT_FOUND,
                                "Карта SMR с указанным идентификатором не найдена.");
                        return;
                    }

                    long smdid = rs.getLong("SMDID");
                    if (rs.wasNull()) smdid = 0;
                    long smrSmdid = rs.getLong("SMR_SMDID");
                    if (!rs.wasNull() && smrSmdid > 0) smdid = smrSmdid;

                    String docId = rs.getString("DOCID");
                    String docCountryCode = rs.getString("DOCCOUNTRYCODE");
                    Timestamp docCreationDate = rs.getTimestamp("DOCCREATIONDATE");
                    String responseCountry = rs.getString("RESPONSECOUNTRYNAME");
                    String dscCode = rs.getString("DATASOURCEKINDCODE");
                    String dscName = rs.getString("DATASOURCEKINDNAME");
                    String statusName = rs.getString("SMRSTATUSNAME");
                    Timestamp created = rs.getTimestamp("CREATIONDATETIME");
                    Timestamp modified = rs.getTimestamp("MODIFICATIONDATETIME");
                    int smrStatusId = rs.getInt("SMRSTATUSID");
                    if (rs.wasNull()) smrStatusId = 0;
                    long smrVersion = rs.getLong("SMRVERSION");
                    if (rs.wasNull()) smrVersion = 0;
                    String smrStatusCode = rs.getString("SMRSTATUSCODE");
                    if (smrStatusCode == null) smrStatusCode = "";

                    boolean canEdit = false;
                    try {
                        SmrCreateSupport.GateResult eg = SmrCreateSupport.evaluateEditGate(conn, smrId, guid);
                        canEdit = eg.allowed;
                    } catch (SQLException ignored) {
                        canEdit = false;
                    }

                    boolean canDeleteDraft = false;
                    try {
                        SmrCreateSupport.GateResult dg = SmrCreateSupport.evaluateDeleteDraftGate(conn, smrId, guid);
                        canDeleteDraft = dg.allowed;
                    } catch (SQLException ignored) {
                        canDeleteDraft = false;
                    }

                    boolean canValidateOutgoingCard = false;
                    try {
                        SmrCreateSupport.GateResult vg = SmrCreateSupport.evaluateOutgoingSmrValidateCardGate(conn, smrId, guid);
                        canValidateOutgoingCard = vg.allowed;
                    } catch (SQLException ignored) {
                        canValidateOutgoingCard = false;
                    }

                    boolean canChangeOutgoingStatus = false;
                    try {
                        SmrCreateSupport.GateResult sg = SmrCreateSupport.evaluateOutgoingSmrStatusGate(conn, smrId, guid);
                        canChangeOutgoingStatus = sg.allowed;
                    } catch (SQLException ignored) {
                        canChangeOutgoingStatus = false;
                    }

                    boolean canSendOutgoing = false;
                    try {
                        SmrCreateSupport.GateResult sendG = SmrCreateSupport.evaluateOutgoingSmrSendGate(conn, smrId, guid);
                        canSendOutgoing = sendG.allowed;
                    } catch (SQLException ignored) {
                        canSendOutgoing = false;
                    }

                    boolean canCompleteIncomingProcessing = false;
                    try {
                        SmrCreateSupport.GateResult cg = SmrCreateSupport.evaluateIncomingSmrCompleteProcessingGate(conn, smrId, guid);
                        canCompleteIncomingProcessing = cg.allowed;
                    } catch (SQLException ignored) {
                        canCompleteIncomingProcessing = false;
                    }

                    PrintWriter out = response.getWriter();
                    out.print("{");
                    out.print("\"linkedSmdid\":" + smdid);
                    out.print(",\"docId\":" + quote(docId));
                    out.print(",\"docCountryCode\":" + quote(docCountryCode));
                    out.print(",\"docCreationDate\":" + quote(tsToIso(docCreationDate)));
                    out.print(",\"responseCountryName\":" + quote(responseCountry));
                    out.print(",\"datasourceKindCode\":" + quote(dscCode));
                    out.print(",\"datasourceKindName\":" + quote(dscName));
                    out.print(",\"smrStatusName\":" + quote(statusName));
                    out.print(",\"creationDateTime\":" + quote(tsToIso(created)));
                    out.print(",\"modificationDateTime\":" + quote(tsToIso(modified)));
                    out.print(",\"smrStatusId\":" + smrStatusId);
                    out.print(",\"smrStatusCode\":" + quote(smrStatusCode.isEmpty() ? null : smrStatusCode));
                    out.print(",\"smrVersion\":" + smrVersion);
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

    private static PreparedStatement prepareMetadataQuery(Connection conn, long smrId) throws SQLException {
        String[] queries = {
                SmrDbSupport.SQL_METADATA_VW,
                SmrDbSupport.SQL_METADATA_VW_SESINT,
                SmrDbSupport.SQL_METADATA_FALLBACK,
                SmrDbSupport.SQL_METADATA_FALLBACK_SESINT
        };
        SQLException last = null;
        for (String sql : queries) {
            try {
                PreparedStatement ps = conn.prepareStatement(sql);
                ps.setLong(1, smrId);
                return ps;
            } catch (SQLException e) {
                last = e;
                if (!isMissingObject(e)) throw e;
            }
        }
        if (last != null) throw last;
        throw new SQLException("Не удалось подготовить запрос метаданных SMR");
    }

    private static boolean isMissingObject(SQLException e) {
        String msg = e.getMessage();
        return msg != null && (msg.contains("ORA-00942") || msg.contains("ORA-00904"));
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
