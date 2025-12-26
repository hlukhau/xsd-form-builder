package com.eec.servlet;

import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.AuthorityOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * Сервлет для получения списка уполномоченных органов (AUTHORITY) для выпадающего списка
 * GET /api/authorities/options?countryCode=RU
 * Регистрируется в web.xml
 */
public class AuthorityOptionsServlet extends HttpServlet {
    
    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[AuthorityOptionsServlet] Initialized");
        System.out.println("[AuthorityOptionsServlet] Ready to serve authorities from cache");
    }
    
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        String countryCode = request.getParameter("countryCode");
        System.out.println("[AuthorityOptionsServlet] Loading authorities from cache, countryCode: " + countryCode);
        
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        
        PrintWriter out = null;
        
        try {
            out = response.getWriter();
        } catch (IOException e) {
            System.err.println("[AuthorityOptionsServlet] Cannot get writer: " + e.getMessage());
            return;
        }
        
        try {
            // Получаем данные из кеша
            List<AuthorityOption> authorities;
            
            if (countryCode != null && !countryCode.trim().isEmpty()) {
                // Фильтруем по стране
                authorities = DictionaryCache.getAuthoritiesByCountry(countryCode.trim().toUpperCase());
            } else {
                // Возвращаем все органы (из всех стран)
                authorities = DictionaryCache.getAllAuthorities();
                // Сортируем по стране и названию
                authorities.sort((a1, a2) -> {
                    int countryCompare = (a1.countryCode != null ? a1.countryCode : "").compareTo(a2.countryCode != null ? a2.countryCode : "");
                    if (countryCompare != 0) return countryCompare;
                    return (a1.name != null ? a1.name : "").compareTo(a2.name != null ? a2.name : "");
                });
            }
            
            out.print("[");
            boolean first = true;
            int count = 0;
            
            for (AuthorityOption authority : authorities) {
                if (!first) {
                    out.print(",");
                }
                first = false;
                count++;
                
                String uid = authority.uid != null ? authority.uid : "";
                String name = authority.name != null ? authority.name : "";
                String briefName = authority.briefName != null ? authority.briefName : "";
                String code = authority.countryCode != null ? authority.countryCode : "";
                
                // Экранируем кавычки
                uid = uid.replace("\\", "\\\\").replace("\"", "\\\"");
                name = name.replace("\\", "\\\\").replace("\"", "\\\"");
                briefName = briefName.replace("\\", "\\\\").replace("\"", "\\\"");
                code = code.replace("\\", "\\\\").replace("\"", "\\\"");
                
                out.print("{\"uid\":\"" + uid + "\",\"name\":\"" + name + "\",\"briefName\":\"" + briefName + "\",\"countryCode\":\"" + code + "\"}");
            }
            
            out.print("]");
            System.out.println("[AuthorityOptionsServlet] Loaded " + count + " authorities from cache");
            
        } catch (Exception e) {
            System.err.println("[AuthorityOptionsServlet] ERROR: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            
            if (out == null) {
                try {
                    out = response.getWriter();
                } catch (IOException ioException) {
                    System.err.println("[AuthorityOptionsServlet] Cannot get writer for error response");
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


