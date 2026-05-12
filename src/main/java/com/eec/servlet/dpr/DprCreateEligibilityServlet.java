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
 * Проверка возможности создать карту DPR (ответ) по входящей PPV.
 * GET /api/dpr/create-eligibility/{PPVID}?guid=...
 */
public class DprCreateEligibilityServlet extends HttpServlet {

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
            DprCreateSupport.GateResult g = DprCreateSupport.evaluateGate(conn, ppvid, guid);
            PrintWriter out = response.getWriter();
            if (!g.allowed) {
                response.setStatus(HttpServletResponse.SC_OK);
                out.print("{\"allowed\":false,\"reason\":" + quote(g.reason) + "}");
                out.flush();
                return;
            }
            response.setStatus(HttpServletResponse.SC_OK);
            String docDate = g.docCreationDate != null ? g.docCreationDate.toLocalDate().toString() : "";
            out.print("{");
            out.print("\"allowed\":true");
            out.print(",\"ppvid\":" + g.ppvid);
            out.print(",\"incidentId\":" + quote(g.incidentId));
            out.print(",\"alertCountryCode\":" + quote(g.alertCountryCode));
            out.print(",\"incidentKindCode\":" + quote(g.incidentKindCode));
            out.print(",\"docCreationDate\":" + quote(docDate));
            out.print(",\"responseCountryId\":" + g.responseCountryId);
            out.print(",\"responseCountryCode\":" + quote(g.responseCountryCode));
            out.print(",\"responseCountryName\":" + quote(g.responseCountryName));
            out.print(",\"draftDprStatusId\":" + g.draftDprStatusId);
            out.print(",\"draftDprStatusName\":" + quote(g.draftDprStatusName));
            out.print("}");
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
