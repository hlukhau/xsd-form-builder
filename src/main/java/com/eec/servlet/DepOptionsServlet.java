package com.eec.servlet;

import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.DepOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;

/**
 * Список подразделений из кеша (TB_DEP + TB_DEPKIND, загружаются при старте).
 * GET /api/dep/options — все подразделения { id, name, depKindCode }.
 */
public class DepOptionsServlet extends HttpServlet {

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[DepOptionsServlet] Initialized, serving from cache");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        com.eec.servlet.DictionaryInitializerListener loader = com.eec.servlet.DictionaryInitializerListener.getInstance();
        if (loader != null) {
            loader.ensureDepOptionsLoaded(request.getParameter("guid"));
        }
        List<DepOption> list = DictionaryCache.getDepOptionsList();
        StringBuilder json = new StringBuilder("[");
        boolean first = true;
        for (DepOption o : list) {
            if (!first) json.append(",");
            first = false;
            json.append("{\"id\":").append(quote(o.id)).append(",\"name\":").append(quote(o.name)).append(",\"depKindCode\":").append(quote(o.depKindCode)).append("}");
        }
        json.append("]");
        response.getWriter().print(json.toString());
    }

    private static String quote(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }
}
