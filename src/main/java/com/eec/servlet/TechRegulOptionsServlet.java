package com.eec.servlet;

import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.TechRegulOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * Сервлет для получения списка технических регламентов (TECHREGUL) для выпадающего списка
 * GET /api/tech-reguls/options
 * Регистрируется в web.xml
 */
public class TechRegulOptionsServlet extends HttpServlet {
    
    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[TechRegulOptionsServlet] Initialized");
        System.out.println("[TechRegulOptionsServlet] Ready to serve technical regulations from cache");
    }
    
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        System.out.println("[TechRegulOptionsServlet] Loading technical regulations from cache");
        
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        
        PrintWriter out = null;
        
        try {
            out = response.getWriter();
        } catch (IOException e) {
            System.err.println("[TechRegulOptionsServlet] Cannot get writer: " + e.getMessage());
            return;
        }
        
        try {
            // Получаем данные из кеша
            com.eec.servlet.DictionaryInitializerListener loader = com.eec.servlet.DictionaryInitializerListener.getInstance();
            if (loader != null) loader.ensureTechRegulsLoaded();

            List<TechRegulOption> reguls = DictionaryCache.getTechRegulsList();
            
            out.print("[");
            boolean first = true;
            int count = 0;
            
            for (TechRegulOption regul : reguls) {
                if (!first) {
                    out.print(",");
                }
                first = false;
                count++;
                
                String code = regul.code != null ? regul.code : "";
                String name = regul.name != null ? regul.name : "";
                String regNum = regul.regNum != null ? regul.regNum : "";
                
                // Экранируем кавычки
                code = code.replace("\\", "\\\\").replace("\"", "\\\"");
                name = name.replace("\\", "\\\\").replace("\"", "\\\"");
                regNum = regNum.replace("\\", "\\\\").replace("\"", "\\\"");
                
                out.print("{\"code\":\"" + code + "\",\"name\":\"" + name + "\",\"regNum\":\"" + regNum + "\"}");
            }
            
            out.print("]");
            System.out.println("[TechRegulOptionsServlet] Loaded " + count + " technical regulations from cache");
            
        } catch (Exception e) {
            System.err.println("[TechRegulOptionsServlet] ERROR: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            
            if (out == null) {
                try {
                    out = response.getWriter();
                } catch (IOException ioException) {
                    System.err.println("[TechRegulOptionsServlet] Cannot get writer for error response");
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

