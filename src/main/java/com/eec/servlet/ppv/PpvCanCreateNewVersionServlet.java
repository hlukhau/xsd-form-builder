package com.eec.servlet.ppv;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Проверка возможности создания новой версии карты PPV.
 * GET /api/ppv/can-create-new-version?dpaid=...&guid=...
 * Ответ: { "allowed": false, "reason": "..." } — для исходящих PPV создание новой версии не предусмотрено.
 */
public class PpvCanCreateNewVersionServlet extends HttpServlet {

    private static final String NOT_SUPPORTED =
            "Создание новой версии для карт сведений о выявленных нарушениях (PPV) не предусмотрено";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String dpaid = request.getParameter("dpaid");
        if (dpaid == null || dpaid.trim().isEmpty()) {
            sendJson(response, false, "Укажите dpaid");
            return;
        }
        sendJson(response, false, NOT_SUPPORTED);
    }

    private static void sendJson(HttpServletResponse response, boolean allowed, String reason) throws IOException {
        response.setStatus(HttpServletResponse.SC_OK);
        StringBuilder sb = new StringBuilder();
        sb.append("{\"allowed\":").append(allowed);
        if (reason != null) sb.append(",\"reason\":").append(quote(reason));
        sb.append("}");
        response.getWriter().print(sb.toString());
    }

    private static String quote(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }
}
