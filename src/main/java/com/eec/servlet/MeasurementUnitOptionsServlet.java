package com.eec.servlet;

import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.MeasurementUnitOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * Сервлет для получения списка единиц измерения (MEASUREMENTUNIT) для выпадающего списка
 * GET /api/measurement-units/options
 * Регистрируется в web.xml
 */
public class MeasurementUnitOptionsServlet extends HttpServlet {
    
    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[MeasurementUnitOptionsServlet] Initialized");
        System.out.println("[MeasurementUnitOptionsServlet] Ready to serve measurement units from cache");
    }
    
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        System.out.println("[MeasurementUnitOptionsServlet] Loading measurement units from cache");
        
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        
        PrintWriter out = null;
        
        try {
            out = response.getWriter();
        } catch (IOException e) {
            System.err.println("[MeasurementUnitOptionsServlet] Cannot get writer: " + e.getMessage());
            return;
        }
        
        try {
            // Получаем данные из кеша
            com.eec.servlet.DictionaryInitializerListener loader = com.eec.servlet.DictionaryInitializerListener.getInstance();
            if (loader != null) loader.ensureMeasurementUnitsLoaded(request.getParameter("guid"));

            List<MeasurementUnitOption> units = DictionaryCache.getMeasurementUnitsList();
            
            out.print("[");
            boolean first = true;
            int count = 0;
            
            for (MeasurementUnitOption unit : units) {
                if (!first) {
                    out.print(",");
                }
                first = false;
                count++;
                
                String code = unit.code != null ? unit.code : "";
                String name = unit.name != null ? unit.name : "";
                String briefName = unit.briefName != null ? unit.briefName : "";
                
                // Экранируем кавычки
                code = code.replace("\\", "\\\\").replace("\"", "\\\"");
                name = name.replace("\\", "\\\\").replace("\"", "\\\"");
                briefName = briefName.replace("\\", "\\\\").replace("\"", "\\\"");
                
                out.print("{\"code\":\"" + code + "\",\"name\":\"" + name + "\",\"briefName\":\"" + briefName + "\"}");
            }
            
            out.print("]");
            System.out.println("[MeasurementUnitOptionsServlet] Loaded " + count + " measurement units from cache");
            
        } catch (Exception e) {
            System.err.println("[MeasurementUnitOptionsServlet] ERROR: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            
            if (out == null) {
                try {
                    out = response.getWriter();
                } catch (IOException ioException) {
                    System.err.println("[MeasurementUnitOptionsServlet] Cannot get writer for error response");
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

