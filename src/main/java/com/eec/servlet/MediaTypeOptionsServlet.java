package com.eec.servlet;

import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.MediaTypeOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * Сервлет для получения списка форматов данных (MEDIATYPE) для выпадающего списка
 * GET /api/media-types/options
 * Регистрируется в web.xml
 */
public class MediaTypeOptionsServlet extends HttpServlet {
    
    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[MediaTypeOptionsServlet] Initialized");
        System.out.println("[MediaTypeOptionsServlet] Ready to serve media types from cache");
    }
    
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        System.out.println("[MediaTypeOptionsServlet] Loading media types from cache");
        
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        
        PrintWriter out = null;
        
        try {
            out = response.getWriter();
        } catch (IOException e) {
            System.err.println("[MediaTypeOptionsServlet] Cannot get writer: " + e.getMessage());
            return;
        }
        
        try {
            // Получаем данные из кеша
            com.eec.servlet.DictionaryInitializerListener loader = com.eec.servlet.DictionaryInitializerListener.getInstance();
            if (loader != null) loader.ensureMediaTypesLoaded(request.getParameter("guid"));

            List<MediaTypeOption> mediaTypes = DictionaryCache.getMediaTypesList();
            
            out.print("[");
            boolean first = true;
            int count = 0;
            
            for (MediaTypeOption mediaType : mediaTypes) {
                if (!first) {
                    out.print(",");
                }
                first = false;
                count++;
                
                String code = mediaType.code != null ? mediaType.code : "";
                String name = mediaType.name != null ? mediaType.name : "";
                
                // Экранируем кавычки
                code = code.replace("\\", "\\\\").replace("\"", "\\\"");
                name = name.replace("\\", "\\\\").replace("\"", "\\\"");
                
                out.print("{\"code\":\"" + code + "\",\"name\":\"" + name + "\"}");
            }
            
            out.print("]");
            System.out.println("[MediaTypeOptionsServlet] Loaded " + count + " media types from cache");
            
        } catch (Exception e) {
            System.err.println("[MediaTypeOptionsServlet] ERROR: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            
            if (out == null) {
                try {
                    out = response.getWriter();
                } catch (IOException ioException) {
                    System.err.println("[MediaTypeOptionsServlet] Cannot get writer for error response");
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

