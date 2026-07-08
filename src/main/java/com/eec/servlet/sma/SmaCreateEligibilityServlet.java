package com.eec.servlet.sma;

import com.eec.util.DatabaseUtil;
import com.eec.util.SmaCreateSupport;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.SQLException;

/**
 * Проверка возможности создать SMAQ (по SMD) или SMAR (по SMAQ).
 * GET /api/sma/create-eligibility/smd/{smdid}?guid=...
 * GET /api/sma/create-eligibility/smaq/{smaqid}?guid=...
 */
public class SmaCreateEligibilityServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        SmaEligibilityTarget target = SmaServletUtil.parseEligibilityPath(request.getPathInfo());
        if (target == null) {
            sendJson(response, HttpServletResponse.SC_BAD_REQUEST,
                    "{\"error\":\"Укажите smd/{id} или smaq/{id} в пути\"}");
            return;
        }
        String guid = request.getParameter("guid");
        if (guid != null) {
            guid = guid.trim();
        }
        if (guid == null || guid.isEmpty()) {
            sendJson(response, HttpServletResponse.SC_BAD_REQUEST, "{\"error\":\"Укажите guid\"}");
            return;
        }

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            SmaCreateSupport.GateResult g = target.createKind == SmaCardKind.SMAQ
                    ? SmaCreateSupport.evaluateSmaqCreateGate(conn, target.smdid, guid)
                    : SmaCreateSupport.evaluateSmarCreateGate(conn, target.smaqid, guid);

            PrintWriter out = response.getWriter();
            if (!g.allowed) {
                response.setStatus(HttpServletResponse.SC_OK);
                out.print("{\"allowed\":false,\"reason\":" + SmaServletUtil.quote(g.reason) + "}");
                out.flush();
                return;
            }
            response.setStatus(HttpServletResponse.SC_OK);
            String docDate = g.docCreationDate != null ? g.docCreationDate.toLocalDate().toString() : "";
            out.print("{");
            out.print("\"allowed\":true");
            out.print(",\"kind\":" + SmaServletUtil.quote(target.createKind.apiName()));
            out.print(",\"smdid\":" + g.smdid);
            out.print(",\"smaqid\":" + g.smaqid);
            out.print(",\"docId\":" + SmaServletUtil.quote(g.docId));
            out.print(",\"docCountryCode\":" + SmaServletUtil.quote(g.docCountryCode));
            out.print(",\"docCreationDate\":" + SmaServletUtil.quote(docDate));
            out.print(",\"requestCountryId\":" + g.requestCountryId);
            out.print(",\"requestCountryCode\":" + SmaServletUtil.quote(g.requestCountryCode));
            out.print(",\"requestCountryName\":" + SmaServletUtil.quote(g.requestCountryName));
            out.print(",\"draftStatusId\":" + g.draftStatusId);
            out.print(",\"draftStatusName\":" + SmaServletUtil.quote(g.draftStatusName));
            out.print("}");
            out.flush();
        } catch (SQLException e) {
            sendJson(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "{\"error\":" + SmaServletUtil.quote("Ошибка БД: " + e.getMessage()) + "}");
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static void sendJson(HttpServletResponse response, int status, String body) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();
        out.print(body);
        out.flush();
    }
}
