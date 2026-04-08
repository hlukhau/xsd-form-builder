package com.eec.servlet;

import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.ShipDocKindOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * Сервлет для получения списка видов товаросопроводительных документов (SHIPDOCKIND) для выпадающего списка
 * GET /api/ship-doc-kinds/options
 * Регистрируется в web.xml
 */
public class ShipDocKindOptionsServlet extends HttpServlet {
    
    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[ShipDocKindOptionsServlet] Initialized");
        System.out.println("[ShipDocKindOptionsServlet] Ready to serve ship document kinds from cache");
    }
    
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        System.out.println("[ShipDocKindOptionsServlet] Loading ship document kinds from cache");
        
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        
        PrintWriter out = null;
        
        try {
            out = response.getWriter();
        } catch (IOException e) {
            System.err.println("[ShipDocKindOptionsServlet] Cannot get writer: " + e.getMessage());
            return;
        }
        
        try {
            // Получаем данные из кеша
            com.eec.servlet.DictionaryInitializerListener loader = com.eec.servlet.DictionaryInitializerListener.getInstance();
            if (loader != null) loader.ensureShipDocKindsLoaded(request.getParameter("guid"));

            List<ShipDocKindOption> kinds = DictionaryCache.getShipDocKindsList();
            
            out.print("[");
            boolean first = true;
            int count = 0;
            
            for (ShipDocKindOption kind : kinds) {
                if (!first) {
                    out.print(",");
                }
                first = false;
                count++;
                
                String code = kind.code != null ? kind.code : "";
                String name = kind.name != null ? kind.name : "";
                String groupCode = kind.groupCode != null ? kind.groupCode : "";
                
                // Экранируем кавычки
                code = code.replace("\\", "\\\\").replace("\"", "\\\"");
                name = name.replace("\\", "\\\\").replace("\"", "\\\"");
                groupCode = groupCode.replace("\\", "\\\\").replace("\"", "\\\"");
                
                out.print("{\"code\":\"" + code + "\",\"name\":\"" + name + "\",\"groupCode\":\"" + groupCode + "\"}");
            }
            
            out.print("]");
            System.out.println("[ShipDocKindOptionsServlet] Loaded " + count + " ship document kinds from cache");
            
        } catch (Exception e) {
            System.err.println("[ShipDocKindOptionsServlet] ERROR: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            
            if (out == null) {
                try {
                    out = response.getWriter();
                } catch (IOException ioException) {
                    System.err.println("[ShipDocKindOptionsServlet] Cannot get writer for error response");
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

