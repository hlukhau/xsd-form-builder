package com.eec.servlet;

import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.SanitaryMeasureReasonOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * Справочник причин введения временной санитарной меры (SANITARYMEASUREREASON).
 * GET /api/sanitary-measure-reasons/options
 */
public class SanitaryMeasureReasonOptionsServlet extends HttpServlet {

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[SanitaryMeasureReasonOptionsServlet] Initialized");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        PrintWriter out = response.getWriter();
        try {
            DictionaryInitializerListener loader = DictionaryInitializerListener.getInstance();
            if (loader != null) {
                loader.ensureSanitaryMeasureReasonsLoaded(request.getParameter("guid"));
            }
            List<SanitaryMeasureReasonOption> reasons = DictionaryCache.getSanitaryMeasureReasonsList();
            out.print("[");
            boolean first = true;
            for (SanitaryMeasureReasonOption reason : reasons) {
                if (!first) out.print(",");
                first = false;
                String code = reason.code != null ? reason.code : "";
                String name = reason.name != null ? reason.name : "";
                code = code.replace("\\", "\\\\").replace("\"", "\\\"");
                name = name.replace("\\", "\\\\").replace("\"", "\\\"");
                out.print("{\"code\":\"" + code + "\",\"name\":\"" + name + "\"}");
            }
            out.print("]");
        } catch (Exception e) {
            System.err.println("[SanitaryMeasureReasonOptionsServlet] ERROR: " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            String errorMsg = e.getMessage() != null ? e.getMessage().replace("\"", "'") : "Unknown error";
            out.print("{\"error\":\"Ошибка: " + errorMsg + "\"}");
        } finally {
            out.close();
        }
    }
}
