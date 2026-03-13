package com.eec.servlet;

import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.SupplyChainPartyKindOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * Сервлет для получения списка видов участников цепи поставки (SUPPLYCHAINPARTYKIND) для выпадающего списка
 * GET /api/supply-chain-party-kinds/options
 * Регистрируется в web.xml
 */
public class SupplyChainPartyKindOptionsServlet extends HttpServlet {
    
    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[SupplyChainPartyKindOptionsServlet] Initialized");
        System.out.println("[SupplyChainPartyKindOptionsServlet] Ready to serve supply chain party kinds from cache");
    }
    
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        System.out.println("[SupplyChainPartyKindOptionsServlet] Loading supply chain party kinds from cache");
        
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        
        PrintWriter out = null;
        
        try {
            out = response.getWriter();
        } catch (IOException e) {
            System.err.println("[SupplyChainPartyKindOptionsServlet] Cannot get writer: " + e.getMessage());
            return;
        }
        
        try {
            // Получаем данные из кеша
            com.eec.servlet.DictionaryInitializerListener loader = com.eec.servlet.DictionaryInitializerListener.getInstance();
            if (loader != null) loader.ensureSupplyChainPartyKindsLoaded(request.getParameter("guid"));

            List<SupplyChainPartyKindOption> kinds = DictionaryCache.getSupplyChainPartyKindsList();
            
            out.print("[");
            boolean first = true;
            int count = 0;
            
            for (SupplyChainPartyKindOption kind : kinds) {
                if (!first) {
                    out.print(",");
                }
                first = false;
                count++;
                
                String code = kind.code != null ? kind.code : "";
                String name = kind.name != null ? kind.name : "";
                
                // Экранируем кавычки
                code = code.replace("\\", "\\\\").replace("\"", "\\\"");
                name = name.replace("\\", "\\\\").replace("\"", "\\\"");
                
                out.print("{\"code\":\"" + code + "\",\"name\":\"" + name + "\"}");
            }
            
            out.print("]");
            System.out.println("[SupplyChainPartyKindOptionsServlet] Loaded " + count + " supply chain party kinds from cache");
            
        } catch (Exception e) {
            System.err.println("[SupplyChainPartyKindOptionsServlet] ERROR: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            
            if (out == null) {
                try {
                    out = response.getWriter();
                } catch (IOException ioException) {
                    System.err.println("[SupplyChainPartyKindOptionsServlet] Cannot get writer for error response");
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

