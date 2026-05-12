package com.eec.servlet.dpr;

import com.eec.util.DatabaseUtil;
import com.eec.util.DprCreateSupport;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.SQLException;

/**
 * Действия по входящей PPV для связанной DPR: «Подготовить ответ» и «Открыть ответ».
 * GET /api/dpr/ppv-incoming-actions/{PPVID}?guid=...
 */
public class DprPpvIncomingActionsServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            sendJson(response, HttpServletResponse.SC_BAD_REQUEST, "{\"error\":\"Укажите PPVID в пути\"}");
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

        long ppvid;
        try {
            ppvid = Long.parseLong(idStr);
        } catch (NumberFormatException e) {
            sendJson(response, HttpServletResponse.SC_BAD_REQUEST, "{\"error\":\"Некорректный PPVID\"}");
            return;
        }

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            DprCreateSupport.OpenLinkedResult open = DprCreateSupport.evaluateOpenLinkedDpr(conn, ppvid, guid);
            DprCreateSupport.GateResult prepare = DprCreateSupport.evaluateGate(conn, ppvid, guid);

            StringBuilder json = new StringBuilder();
            json.append("{");
            json.append("\"canOpenLinkedDpr\":").append(open.allowed);
            json.append(",\"openLinkedDprReason\":").append(quote(open.reason));
            json.append(",\"linkedDprid\":").append(open.linkedDprid != null ? open.linkedDprid : "null");
            json.append(",\"canPrepareAnswer\":").append(prepare.allowed);
            json.append(",\"prepareAnswerReason\":").append(quote(prepare.reason));
            if (prepare.allowed) {
                String docDate = prepare.docCreationDate != null ? prepare.docCreationDate.toLocalDate().toString() : "";
                json.append(",\"prepareContext\":{");
                json.append("\"ppvid\":").append(prepare.ppvid);
                json.append(",\"incidentId\":").append(quote(prepare.incidentId));
                json.append(",\"alertCountryCode\":").append(quote(prepare.alertCountryCode));
                json.append(",\"incidentKindCode\":").append(quote(prepare.incidentKindCode));
                json.append(",\"docCreationDate\":").append(quote(docDate));
                json.append(",\"responseCountryId\":").append(prepare.responseCountryId);
                json.append(",\"responseCountryCode\":").append(quote(prepare.responseCountryCode));
                json.append(",\"responseCountryName\":").append(quote(prepare.responseCountryName));
                json.append(",\"draftDprStatusId\":").append(prepare.draftDprStatusId);
                json.append(",\"draftDprStatusName\":").append(quote(prepare.draftDprStatusName));
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
