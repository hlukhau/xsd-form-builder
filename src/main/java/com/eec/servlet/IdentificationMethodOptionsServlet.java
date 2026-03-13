package com.eec.servlet;

import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.IdentificationMethodOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * Сервлет для получения списка методов идентификации (SESINT.BUSENTKIND, codeListId=1033)
 * GET /api/identification-methods/options?countryCode=BY
 * Регистрируется в web.xml
 */
public class IdentificationMethodOptionsServlet extends HttpServlet {

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[IdentificationMethodOptionsServlet] Initialized");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String countryCode = request.getParameter("countryCode");

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        PrintWriter out = null;
        try {
            out = response.getWriter();
        } catch (IOException e) {
            System.err.println("[IdentificationMethodOptionsServlet] Cannot get writer: " + e.getMessage());
            return;
        }

        try {
            com.eec.servlet.DictionaryInitializerListener loader = com.eec.servlet.DictionaryInitializerListener.getInstance();
            if (loader != null) loader.ensureIdentificationMethodsLoaded(request.getParameter("guid"));

            List<IdentificationMethodOption> list = (countryCode != null && !countryCode.trim().isEmpty())
                    ? DictionaryCache.getIdentificationMethodsByCountry(countryCode.trim())
                    : DictionaryCache.getIdentificationMethodsList();

            out.print("[");
            boolean first = true;
            for (IdentificationMethodOption o : list) {
                if (!first) out.print(",");
                first = false;
                String code = escapeJson(o.code);
                String letterCode = escapeJson(o.letterCode);
                String description = escapeJson(o.description);
                out.print("{\"code\":\"" + code + "\",\"letterCode\":\"" + letterCode + "\",\"description\":\"" + description + "\"}");
            }
            out.print("]");

        } catch (Exception e) {
            System.err.println("[IdentificationMethodOptionsServlet] ERROR: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            if (out != null) {
                try { out = response.getWriter(); } catch (IOException ignored) {}
                out.print("{\"error\":\"Ошибка: " + escapeJson(e.getMessage()) + "\"}");
            }
        } finally {
            if (out != null) out.close();
        }
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ");
    }
}
