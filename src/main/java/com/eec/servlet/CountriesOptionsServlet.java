package com.eec.servlet;

import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.CountryOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * Сервлет для получения списка стран для выпадающего списка
 * GET /api/countries/options
 * Регистрируется в web.xml
 */
public class CountriesOptionsServlet extends HttpServlet {
    
    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[CountriesOptionsServlet] Initialized");
        System.out.println("[CountriesOptionsServlet] Ready to serve countries from cache");
    }
    
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        System.out.println("[CountriesOptionsServlet] Loading countries from cache...");
        
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        
        PrintWriter out = null;
        
        try {
            out = response.getWriter();
        } catch (IOException e) {
            System.err.println("[CountriesOptionsServlet] Cannot get writer: " + e.getMessage());
            return;
        }
        
        try {
            // Ленивая загрузка: при первом запросе загружаем справочник и кешируем
            com.eec.servlet.DictionaryInitializerListener loader = com.eec.servlet.DictionaryInitializerListener.getInstance();
            if (loader != null) {
                loader.ensureCountriesLoaded(request.getParameter("guid"));
            }
            List<CountryOption> countries = DictionaryCache.getCountriesList();
            
            out.print("[");
            boolean first = true;
            int count = 0;
            
            for (CountryOption country : countries) {
                if (!first) {
                    out.print(",");
                }
                first = false;
                count++;
                
                String code = country.code;
                String name = country.name;
                
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
            System.out.println("[CountriesOptionsServlet] Loaded " + count + " countries from cache");
            
        } catch (Exception e) {
            System.err.println("[CountriesOptionsServlet] ERROR: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            
            if (out == null) {
                try {
                    out = response.getWriter();
                } catch (IOException ioException) {
                    System.err.println("[CountriesOptionsServlet] Cannot get writer for error response");
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

