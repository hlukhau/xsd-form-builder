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
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Доступность действий на вкладках «Запрос сведений» и «Результаты рассмотрения».
 * GET /api/smd/related-actions/{SMDID}?guid=...
 */
public class SmdRelatedActionsServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Укажите SMDID: /api/smd/related-actions/{SMDID}");
            return;
        }

        String smdidStr = pathInfo.startsWith("/") ? pathInfo.substring(1).trim() : pathInfo.trim();
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
            long smdid = Long.parseLong(smdidStr);
            String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
            if (rightsJson == null) {
                rightsJson = "";
            }
            String dsc = loadDatasourceKind(conn, smdid);
            boolean incoming = "1".equals(dsc);
            boolean outgoing = "2".equals(dsc);
            boolean hasInStatus = AccessRightService.hasSanitaryMeasureInStatus(rightsJson);
            boolean hasOutEdit = AccessRightService.hasSanitaryMeasureOutEdit(rightsJson);
            int smrCount = countSmr(conn, smdid);

            boolean canAddInfoRequest = incoming && hasInStatus;
            boolean canPrepareReviewResult = incoming && hasInStatus && smrCount == 0;

            boolean canDelete = false;
            String canDeleteReason = null;
            boolean canSend = false;
            String canSendReason = null;
            boolean canValidate = false;
            String canValidateReason = null;
            boolean canCompleteIncomingProcessing = false;
            String canCompleteIncomingProcessingReason = null;
            boolean canCloseCard = false;
            String canCloseCardReason = null;
            if (outgoing) {
                SmdDeleteSupport.Eligibility deleteEligibility =
                        SmdDeleteSupport.checkEligibility(conn, smdid, rightsJson);
                canDelete = deleteEligibility.allowed;
                canDeleteReason = deleteEligibility.reason;

                SmdSendSupport.Eligibility sendEligibility =
                        SmdSendSupport.checkEligibility(conn, smdid, rightsJson);
                canSend = sendEligibility.allowed;
                canSendReason = sendEligibility.reason;

                SmdViewSupport.Eligibility validateEligibility =
                        SmdViewSupport.checkValidateEligibility(conn, smdid, rightsJson);
                canValidate = validateEligibility.allowed;
                canValidateReason = validateEligibility.reason;

                SmdCloseSupport.Eligibility closeEligibility =
                        SmdCloseSupport.checkOutgoingCloseEligibility(conn, smdid, rightsJson);
                canCloseCard = closeEligibility.allowed;
                canCloseCardReason = closeEligibility.reason;
            }
            if (incoming) {
                SmdCompleteProcessingSupport.Eligibility completeEligibility =
                        SmdCompleteProcessingSupport.checkEligibility(conn, smdid, rightsJson);
                canCompleteIncomingProcessing = completeEligibility.allowed;
                canCompleteIncomingProcessingReason = completeEligibility.reason;

                SmdCloseSupport.Eligibility closeEligibility =
                        SmdCloseSupport.checkIncomingCloseEligibility(conn, smdid, rightsJson);
                canCloseCard = closeEligibility.allowed;
                canCloseCardReason = closeEligibility.reason;
            }

            boolean canEdit = false;
            String canEditReason = null;
            SmdDeleteSupport.Eligibility editEligibility =
                    SmdEditSupport.checkEditEligibility(conn, smdid, rightsJson);
            canEdit = editEligibility.allowed;
            canEditReason = editEligibility.reason;

            StringBuilder json = new StringBuilder();
            json.append("{");
            json.append("\"dataSourceKindCode\":").append(quote(dsc));
            json.append(",\"canAddInfoRequest\":").append(canAddInfoRequest);
            json.append(",\"canPrepareReviewResult\":").append(canPrepareReviewResult);
            json.append(",\"hasIncomingStatusRight\":").append(hasInStatus);
            json.append(",\"hasOutgoingEditRight\":").append(hasOutEdit);
            json.append(",\"isIncoming\":").append(incoming);
            json.append(",\"isOutgoing\":").append(outgoing);
            json.append(",\"hasLinkedReviewResult\":").append(smrCount > 0);
            json.append(",\"canDelete\":").append(canDelete);
            if (canDeleteReason != null) {
                json.append(",\"canDeleteReason\":").append(quote(canDeleteReason));
            }
            json.append(",\"canSend\":").append(canSend);
            if (canSendReason != null) {
                json.append(",\"canSendReason\":").append(quote(canSendReason));
            }
            json.append(",\"canValidate\":").append(canValidate);
            if (canValidateReason != null) {
                json.append(",\"canValidateReason\":").append(quote(canValidateReason));
            }
            json.append(",\"canCompleteIncomingProcessing\":").append(canCompleteIncomingProcessing);
            if (canCompleteIncomingProcessingReason != null) {
                json.append(",\"canCompleteIncomingProcessingReason\":")
                        .append(quote(canCompleteIncomingProcessingReason));
            }
            json.append(",\"canCloseCard\":").append(canCloseCard);
            if (canCloseCardReason != null) {
                json.append(",\"canCloseCardReason\":").append(quote(canCloseCardReason));
            }
            json.append(",\"canEdit\":").append(canEdit);
            if (canEditReason != null) {
                json.append(",\"canEditReason\":").append(quote(canEditReason));
            }
            json.append("}");

            response.setStatus(HttpServletResponse.SC_OK);
            PrintWriter out = response.getWriter();
            out.write(json.toString());
            out.flush();
        } catch (NumberFormatException e) {
            sendJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный SMDID");
        } catch (SQLException e) {
            System.err.println("[SmdRelatedActionsServlet] DB error: " + e.getMessage());
            e.printStackTrace();
            sendJsonError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        }
    }

    private static String loadDatasourceKind(Connection conn, long smdid) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SmdDbSupport.SQL_SMD_DATASOURCE)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    String dsc = rs.getString("DSC");
                    return dsc != null ? dsc.trim() : "";
                }
            }
        }
        return "";
    }

    private static int countSmr(Connection conn, long smdid) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SmdDbSupport.SQL_SMR_COUNT)) {
            ps.setLong(1, smdid);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt("CNT");
                }
            }
        }
        return 0;
    }

    private static String quote(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private static void sendJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        String escaped = message != null ? message.replace("\\", "\\\\").replace("\"", "\\\"") : "Unknown error";
        response.getWriter().print("{\"error\":\"" + escaped + "\"}");
    }
}
