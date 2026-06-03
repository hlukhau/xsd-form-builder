package com.eec.servlet;

import com.eec.rights.RightsRegistryProvider;
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
 * (dangerousProductIn/Out/DB:access|status|send|edit; sanitaryMeasureIn/Out/DB — то же для SMD;
 *  violationDetectedIn/Out/DB — то же для PPV;
 *  publicHealthIn:view, … для PHA).
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
            String rightsJson = (id != null && !id.trim().isEmpty()) ? RightsRegistryProvider.get().getRightsJson(id.trim()) : null;
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
                case "sanitaryMeasureIn:access":
                    allowed = AccessRightService.hasSanitaryMeasureInAccess(rightsJson);
                    break;
                case "sanitaryMeasureOut:access":
                    allowed = AccessRightService.hasSanitaryMeasureOutAccess(rightsJson);
                    break;
                case "sanitaryMeasureDB:access":
                    allowed = AccessRightService.hasSanitaryMeasureDBAccess(rightsJson);
                    break;
                case "sanitaryMeasureIn:status":
                    allowed = AccessRightService.hasSanitaryMeasureInStatus(rightsJson);
                    break;
                case "sanitaryMeasureIn:view":
                    allowed = AccessRightService.hasSanitaryMeasureInView(rightsJson);
                    break;
                case "sanitaryMeasureOut:status":
                    allowed = AccessRightService.hasSanitaryMeasureOutStatus(rightsJson);
                    break;
                case "sanitaryMeasureOut:send":
                    allowed = AccessRightService.hasSanitaryMeasureOutSend(rightsJson);
                    break;
                case "sanitaryMeasureOut:edit":
                    allowed = AccessRightService.hasSanitaryMeasureOutEdit(rightsJson);
                    break;
                case "sanitaryMeasureOut:view":
                    allowed = AccessRightService.hasSanitaryMeasureOutView(rightsJson);
                    break;
                case "sanitaryMeasureDB:view":
                    allowed = AccessRightService.hasSanitaryMeasureDBView(rightsJson);
                    break;
                case "violationDetectedIn:access":
                    allowed = AccessRightService.hasViolationDetectedInAccess(rightsJson);
                    break;
                case "violationDetectedOut:access":
                    allowed = AccessRightService.hasViolationDetectedOutAccess(rightsJson);
                    break;
                case "violationDetectedDB:access":
                    allowed = AccessRightService.hasViolationDetectedDBAccess(rightsJson);
                    break;
                case "violationDetectedIn:status":
                    allowed = AccessRightService.hasViolationDetectedInStatus(rightsJson);
                    break;
                case "violationDetectedIn:view":
                    allowed = AccessRightService.hasViolationDetectedInView(rightsJson);
                    break;
                case "violationDetectedOut:status":
                    allowed = AccessRightService.hasViolationDetectedOutStatus(rightsJson);
                    break;
                case "violationDetectedOut:send":
                    allowed = AccessRightService.hasViolationDetectedOutSend(rightsJson);
                    break;
                case "violationDetectedOut:edit":
                    allowed = AccessRightService.hasViolationDetectedOutEdit(rightsJson);
                    break;
                case "violationDetectedOut:view":
                    allowed = AccessRightService.hasViolationDetectedOutView(rightsJson);
                    break;
                case "publicHealthIn:view":
                    allowed = AccessRightService.hasPublicHealthInView(rightsJson);
                    break;
                case "publicHealthIn:status":
                    allowed = AccessRightService.hasPublicHealthInStatus(rightsJson);
                    break;
                case "publicHealthOut:view":
                    allowed = AccessRightService.hasPublicHealthOutView(rightsJson);
                    break;
                case "publicHealthOut:status":
                    allowed = AccessRightService.hasPublicHealthOutStatus(rightsJson);
                    break;
                case "publicHealthOut:send":
                    allowed = AccessRightService.hasPublicHealthOutSend(rightsJson);
                    break;
                case "publicHealthOut:edit":
                    allowed = AccessRightService.hasPublicHealthOutEdit(rightsJson);
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
