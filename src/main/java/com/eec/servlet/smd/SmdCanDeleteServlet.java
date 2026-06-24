package com.eec.servlet.smd;

import com.eec.rights.RightsRegistryProvider;
import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.sql.Connection;
import java.sql.SQLException;

/**
 * Проверка возможности удаления карты SMD (для кнопки на карте и action в реестре).
 * GET /api/smd/can-delete?smdid=...&guid=...
 */
public class SmdCanDeleteServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String smdid = request.getParameter("smdid");
        String guid = request.getParameter("guid");
        if (smdid == null || smdid.trim().isEmpty()) {
            sendJson(response, false, "Укажите smdid");
            return;
        }
        if (guid == null || guid.trim().isEmpty()) {
            sendJson(response, false, "Укажите guid");
            return;
        }
        smdid = smdid.trim();
        guid = guid.trim();

        Connection conn = null;
        try {
            long sourceSmdid;
            try {
                sourceSmdid = Long.parseLong(smdid);
            } catch (NumberFormatException e) {
                sendJson(response, false, "Некорректный smdid");
                return;
            }

            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
            SmdDeleteSupport.Eligibility eligibility =
                    SmdDeleteSupport.checkEligibility(conn, sourceSmdid, rightsJson);
            if (eligibility.allowed) {
                sendJson(response, true, null);
            } else {
                sendJson(response, false, eligibility.reason);
            }
        } catch (SQLException e) {
            sendJson(response, false, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static void sendJson(HttpServletResponse response, boolean allowed, String reason) throws IOException {
        response.setStatus(HttpServletResponse.SC_OK);
        StringBuilder sb = new StringBuilder();
        sb.append("{\"allowed\":").append(allowed);
        if (reason != null) {
            sb.append(",\"reason\":").append(quote(reason));
        }
        sb.append("}");
        response.getWriter().print(sb.toString());
    }

    private static String quote(String s) {
        if (s == null) {
            return "null";
        }
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }
}
