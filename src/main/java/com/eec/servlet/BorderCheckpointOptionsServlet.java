package com.eec.servlet;

import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.BorderCheckpointOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * Сервлет для получения списка пунктов пропуска (SESINT.BORDERCHECKPOINT).
 * GET /api/border-checkpoints/options
 * Возвращает JSON-массив [{ "code": "…", "name": "…" }]. Отображать в виде &lt;код&gt;-&lt;наименование&gt;.
 */
public class BorderCheckpointOptionsServlet extends HttpServlet {

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
            return;
        }

        try {
            DictionaryInitializerListener loader = DictionaryInitializerListener.getInstance();
            if (loader != null) {
                loader.ensureBorderCheckpointsLoaded(request.getParameter("guid"));
            }
            List<BorderCheckpointOption> list = DictionaryCache.getBorderCheckpointList();

            out.print("[");
            boolean first = true;
            for (BorderCheckpointOption opt : list) {
                if (!first) out.print(",");
                first = false;
                String code = opt.code != null ? opt.code.replace("\\", "\\\\").replace("\"", "\\\"") : "";
                String name = opt.name != null ? opt.name.replace("\\", "\\\\").replace("\"", "\\\"") : "";
                out.print("{\"code\":\"" + code + "\",\"name\":\"" + name + "\"}");
            }
            out.print("]");
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            out.print("[]");
        } finally {
            if (out != null) out.close();
        }
    }
}
