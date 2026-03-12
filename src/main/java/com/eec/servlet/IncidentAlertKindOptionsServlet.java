package com.eec.servlet;

import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.IncidentAlertKindOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * Сервлет для получения списка видов уведомлений (INCIDENTALERTKIND) для выпадающего списка
 * GET /api/incident-alert-kinds/options
 * Регистрируется в web.xml
 */
public class IncidentAlertKindOptionsServlet extends HttpServlet {
    
    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("========================================");
        System.out.println("[IncidentAlertKindOptionsServlet] INIT CALLED");
        System.out.println("[IncidentAlertKindOptionsServlet] Servlet initialized successfully");
        System.out.println("[IncidentAlertKindOptionsServlet] Ready to serve incident alert kinds from cache");
        System.out.println("========================================");
    }
    
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        System.out.println("========================================");
        System.out.println("[IncidentAlertKindOptionsServlet] doGet CALLED");
        System.out.println("[IncidentAlertKindOptionsServlet] Request URI: " + request.getRequestURI());
        System.out.println("[IncidentAlertKindOptionsServlet] Context Path: " + request.getContextPath());
        System.out.println("[IncidentAlertKindOptionsServlet] Loading incident alert kinds from cache...");
        System.out.println("========================================");
        
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        
        PrintWriter out = null;
        
        try {
            out = response.getWriter();
        } catch (IOException e) {
            System.err.println("[IncidentAlertKindOptionsServlet] Cannot get writer: " + e.getMessage());
            return;
        }
        
        try {
            // Ленивая загрузка: при первом запросе загружаем справочник и кешируем
            com.eec.servlet.DictionaryInitializerListener loader = com.eec.servlet.DictionaryInitializerListener.getInstance();
            if (loader != null) {
                loader.ensureIncidentAlertKindsLoaded();
            }
            List<IncidentAlertKindOption> kinds = DictionaryCache.isIncidentAlertKindsLoaded()
                ? DictionaryCache.getIncidentAlertKindsList()
                : java.util.Collections.emptyList();
            
            out.print("[");
            boolean first = true;
            int count = 0;
            
            for (IncidentAlertKindOption kind : kinds) {
                if (!first) {
                    out.print(",");
                }
                first = false;
                count++;
                
                String code = kind.code;
                String name = kind.name;
                
                // Экранируем кавычки
                if (name != null) {
                    name = name.replace("\\", "\\\\");
                    name = name.replace("\"", "\\\"");
                }
                if (code != null) {
                    code = code.replace("\\", "\\\\");
                    code = code.replace("\"", "\\\"");
                }
                
                out.print("{\"code\":\"" + code + "\",\"name\":\"" + name + "\"}");
            }
            
            out.print("]");
            System.out.println("[IncidentAlertKindOptionsServlet] Loaded " + count + " incident alert kinds from cache");
            
        } catch (Exception e) {
            System.err.println("[IncidentAlertKindOptionsServlet] ERROR: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            
            if (out == null) {
                try {
                    out = response.getWriter();
                } catch (IOException ioException) {
                    System.err.println("[IncidentAlertKindOptionsServlet] Cannot get writer for error response");
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


