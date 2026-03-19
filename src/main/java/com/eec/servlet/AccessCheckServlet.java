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
 * GET /api/access/check?id=...&right=... — id опционален (GUID для JSON прав); right — код права
 * (dangerousProductIn:access, dangerousProductOut:access, dangerousProductDB:access;
 *  publicHealthIn:view, publicHealthOut:view, publicHealthDB:view для PHA).
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
            String rightsJson = (id != null && !id.trim().isEmpty()) ? RightsJsonStore.guidMap.get(id.trim()) : null;
            switch (right.trim()) {
                case "dangerousProductIn:access":
                    allowed = AccessRightService.hasDangerousProductInAccess(rightsJson);
                    break;
                case "dangerousProductOut:access":
                    allowed = AccessRightService.hasDangerousProductOutAccess(rightsJson);
                    break;
                case "dangerousProductDB:access":
                    allowed = AccessRightService.hasDangerousProductDBAccess(rightsJson);
                    break;
                case "dangerousProductIn:status":
                    allowed = AccessRightService.hasDangerousProductInStatus(rightsJson);
                    break;
                case "dangerousProductOut:status":
                    allowed = AccessRightService.hasDangerousProductOutStatus(rightsJson);
                    break;
                case "dangerousProductOut:send":
                    allowed = AccessRightService.hasDangerousProductOutSend(rightsJson);
                    break;
                case "dangerousProductOut:edit":
                    allowed = AccessRightService.hasDangerousProductOutEdit(rightsJson);
                    break;
                case "publicHealthIn:view":
                    allowed = AccessRightService.hasPublicHealthInView(rightsJson);
                    break;
                case "publicHealthOut:view":
                    allowed = AccessRightService.hasPublicHealthOutView(rightsJson);
                    break;
                case "publicHealthDB:view":
                    allowed = AccessRightService.hasPublicHealthDBView(rightsJson);
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
