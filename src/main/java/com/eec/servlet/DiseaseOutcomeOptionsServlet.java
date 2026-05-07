package com.eec.servlet;

import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.DiseaseOutcomeOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * GET /api/disease-outcome/options
 * Справочник исходов болезни (DISEASEOUTCOME). Ленивая загрузка и кеш в DictionaryCache.
 */
public class DiseaseOutcomeOptionsServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        PrintWriter out = null;
        try {
            out = response.getWriter();
            DictionaryInitializerListener loader = DictionaryInitializerListener.getInstance();
            if (loader != null) loader.ensureDiseaseOutcomeLoaded(request.getParameter("guid"));
            List<DiseaseOutcomeOption> list = DictionaryCache.getDiseaseOutcomeList();
            out.print("[");
            boolean first = true;
            for (DiseaseOutcomeOption o : list) {
                if (!first) out.print(",");
                first = false;
                String code = o.code != null ? o.code.replace("\\", "\\\\").replace("\"", "\\\"") : "";
                String name = o.name != null ? o.name.replace("\\", "\\\\").replace("\"", "\\\"") : "";
                out.print("{\"code\":\"" + code + "\",\"name\":\"" + name + "\"}");
            }
            out.print("]");
        } catch (Exception e) {
            System.err.println("[DiseaseOutcomeOptionsServlet] ERROR: " + e.getMessage());
            e.printStackTrace();
            if (response.isCommitted()) return;
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            if (out == null) out = response.getWriter();
            String msg = e.getMessage() != null ? e.getMessage().replace("\"", "\\\"") : "Unknown error";
            out.print("{\"error\":\"" + msg + "\"}");
        } finally {
            if (out != null) out.close();
        }
    }
}
