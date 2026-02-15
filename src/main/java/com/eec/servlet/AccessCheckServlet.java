package com.eec.servlet;

import com.eec.util.AccessRightService;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;

/**
 * API проверки прав доступа.
 * GET /api/access/check?id=...&right=... — id опционален; right — код права (dangerousProductIn:access, dangerousProductOut:access, dangerousProductDB:access).
 * Ответ: { "allowed": true }
 */
public class AccessCheckServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String id = request.getParameter("id");
        String right = request.getParameter("right");

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        boolean allowed;
        if (right != null && !right.trim().isEmpty()) {
            switch (right.trim()) {
                case "dangerousProductIn:access":
                    allowed = AccessRightService.hasDangerousProductInAccess(id);
                    break;
                case "dangerousProductOut:access":
                    allowed = AccessRightService.hasDangerousProductOutAccess(id);
                    break;
                case "dangerousProductDB:access":
                    allowed = AccessRightService.hasDangerousProductDBAccess(id);
                    break;
                default:
                    allowed = AccessRightService.hasAccess(id);
                    break;
            }
        } else {
            allowed = AccessRightService.hasAccess(id);
        }

        PrintWriter out = response.getWriter();
        out.print("{\"allowed\":" + allowed + "}");
        out.flush();
    }
}
