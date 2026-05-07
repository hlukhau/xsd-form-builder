package com.eec.servlet;

import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.SanitaryMeasureOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * Сервлет для получения списка санитарных мер (SANITARYMEASURE) для выпадающего списка
 * GET /api/sanitary-measures/options
 * Регистрируется в web.xml
 */
public class SanitaryMeasureOptionsServlet extends HttpServlet {
    
    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[SanitaryMeasureOptionsServlet] Initialized");
        System.out.println("[SanitaryMeasureOptionsServlet] Ready to serve sanitary measures from cache");
    }
    
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        System.out.println("[SanitaryMeasureOptionsServlet] Loading sanitary measures from cache");
        
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        
        PrintWriter out = null;
        
        try {
            out = response.getWriter();
        } catch (IOException e) {
            System.err.println("[SanitaryMeasureOptionsServlet] Cannot get writer: " + e.getMessage());
            return;
        }
        
        try {
            // Получаем данные из кеша
            com.eec.servlet.DictionaryInitializerListener loader = com.eec.servlet.DictionaryInitializerListener.getInstance();
            if (loader != null) loader.ensureSanitaryMeasuresLoaded(request.getParameter("guid"));

            List<SanitaryMeasureOption> measures = DictionaryCache.getSanitaryMeasuresList();
            
            out.print("[");
            boolean first = true;
            int count = 0;
            
            for (SanitaryMeasureOption measure : measures) {
                if (!first) {
                    out.print(",");
                }
                first = false;
                count++;
                
                String code = measure.code != null ? measure.code : "";
                String name = measure.name != null ? measure.name : "";
                
                // Экранируем кавычки
                code = code.replace("\\", "\\\\").replace("\"", "\\\"");
                name = name.replace("\\", "\\\\").replace("\"", "\\\"");
                
                out.print("{\"code\":\"" + code + "\",\"name\":\"" + name + "\"}");
            }
            
            out.print("]");
            System.out.println("[SanitaryMeasureOptionsServlet] Loaded " + count + " sanitary measures from cache");
            
        } catch (Exception e) {
            System.err.println("[SanitaryMeasureOptionsServlet] ERROR: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            
            if (out == null) {
                try {
                    out = response.getWriter();
                } catch (IOException ioException) {
                    System.err.println("[SanitaryMeasureOptionsServlet] Cannot get writer for error response");
                    return;
                }
            }
            
            String errorMsg = e.getMessage();
            if (errorMsg != null) {
                errorMsg = errorMsg.replace("\\", "\\\\");
                errorMsg = errorMsg.replace("\"", "\\\"");
                errorMsg = errorMsg.replace("\n", " ");
                errorMsg = errorMsg.replace("\r", " ");
            } else {
                errorMsg = "Unknown error";
            }
            out.print("{\"error\":\"Ошибка: " + errorMsg + "\"}");
        } finally {
            if (out != null) {
                out.close();
            }
        }
    }
}

