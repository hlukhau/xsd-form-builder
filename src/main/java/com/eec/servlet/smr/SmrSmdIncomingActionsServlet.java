package com.eec.servlet.smr;

import com.eec.util.DatabaseUtil;
import com.eec.util.SmrCreateSupport;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.SQLException;

/**
 * Действия по входящей SMD для связанной DPR: «Подготовить результат рассмотрения» и «Открыть результат рассмотрения».
 * GET /api/smr/smd-incoming-actions/{SMDID}?guid=...
 */
public class SmrSmdIncomingActionsServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendJson(response, HttpServletResponse.SC_BAD_REQUEST, "{\"error\":\"Укажите SMDID в пути\"}");
            return;
        }
        String idStr = pathInfo.startsWith("/") ? pathInfo.substring(1).trim() : pathInfo.trim();
        String guid = request.getParameter("guid");
        if (guid != null) {
            guid = guid.trim();
        }
        if (guid == null || guid.isEmpty()) {
            sendJson(response, HttpServletResponse.SC_BAD_REQUEST, "{\"error\":\"Укажите guid\"}");
            return;
        }

        long smdid;
        try {
            smdid = Long.parseLong(idStr);
        } catch (NumberFormatException e) {
            sendJson(response, HttpServletResponse.SC_BAD_REQUEST, "{\"error\":\"Некорректный SMDID\"}");
            return;
        }

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            SmrCreateSupport.OpenLinkedResult open = SmrCreateSupport.evaluateOpenLinkedSmr(conn, smdid, guid);
            SmrCreateSupport.GateResult prepare = SmrCreateSupport.evaluateGate(conn, smdid, guid);

            StringBuilder json = new StringBuilder();
            json.append("{");
            json.append("\"canOpenLinkedSmr\":").append(open.allowed);
            json.append(",\"openLinkedSmrReason\":").append(quote(open.reason));
            json.append(",\"linkedSmrId\":").append(open.linkedSmrId != null ? open.linkedSmrId : "null");
            json.append(",\"canPrepareReviewResult\":").append(prepare.allowed);
            json.append(",\"prepareReviewResultReason\":").append(quote(prepare.reason));
            if (prepare.allowed) {
                String docDate = prepare.docCreationDate != null ? prepare.docCreationDate.toLocalDate().toString() : "";
                json.append(",\"prepareContext\":{");
                json.append("\"smdid\":").append(prepare.smdid);
                json.append(",\"docId\":").append(quote(prepare.docId));
                json.append(",\"docCountryCode\":").append(quote(prepare.docCountryCode));
                json.append(",\"messageCode\":").append(quote(prepare.messageCode));
                json.append(",\"docCreationDate\":").append(quote(docDate));
                json.append(",\"responseCountryId\":").append(prepare.responseCountryId);
                json.append(",\"responseCountryCode\":").append(quote(prepare.responseCountryCode));
                json.append(",\"responseCountryName\":").append(quote(prepare.responseCountryName));
                json.append(",\"draftSmrStatusId\":").append(prepare.draftSmrStatusId);
                json.append(",\"draftSmrStatusName\":").append(quote(prepare.draftSmrStatusName));
                json.append("}");
            } else {
                json.append(",\"prepareContext\":null");
            }
            json.append("}");

            response.setStatus(HttpServletResponse.SC_OK);
            PrintWriter out = response.getWriter();
            out.print(json.toString());
            out.flush();
        } catch (SQLException e) {
            sendJson(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "{\"error\":" + quote("Ошибка БД: " + e.getMessage()) + "}");
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static String quote(String s) {
        if (s == null) {
            return "null";
        }
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }

    private static void sendJson(HttpServletResponse response, int status, String body) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();
        out.print(body);
        out.flush();
    }
}
