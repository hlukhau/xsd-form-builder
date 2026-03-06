package com.eec.servlet;

import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.IdentityDocKindOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * Сервлет для получения списка видов документов, удостоверяющих личность (SESINT.IDENTITYDOCKIND, codeListId=2053)
 * GET /api/identity-doc-kinds/options
 * Регистрируется в web.xml
 */
public class IdentityDocKindOptionsServlet extends HttpServlet {

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[IdentityDocKindOptionsServlet] Initialized");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        PrintWriter out = null;
        try {
            out = response.getWriter();
        } catch (IOException e) {
            System.err.println("[IdentityDocKindOptionsServlet] Cannot get writer: " + e.getMessage());
            return;
        }

        try {
            if (!DictionaryCache.isIdentityDocKindsLoaded()) {
                response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                out.print("{\"error\":\"Справочник видов документов, удостоверяющих личность, не загружен\"}");
                return;
            }

            List<IdentityDocKindOption> list = DictionaryCache.getIdentityDocKindsList();

            out.print("[");
            boolean first = true;
            for (IdentityDocKindOption o : list) {
                if (!first) out.print(",");
                first = false;
                String code = escapeJson(o.code);
                String name = escapeJson(o.name);
                out.print("{\"code\":\"" + code + "\",\"name\":\"" + name + "\"}");
            }
            out.print("]");

        } catch (Exception e) {
            System.err.println("[IdentityDocKindOptionsServlet] ERROR: " + e.getMessage());
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
