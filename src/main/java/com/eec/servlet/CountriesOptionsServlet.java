package com.eec.servlet;

import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

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
        System.out.println("[CountriesOptionsServlet] Ready to load countries from database");
    }
    
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        System.out.println("[CountriesOptionsServlet] Loading countries from database...");
        
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        
        Connection conn = null;
        PrintWriter out = null;
        int count = 0;
        
        // Создаем writer заранее, чтобы гарантировать ответ даже при ошибке
        try {
            out = response.getWriter();
        } catch (IOException e) {
            System.err.println("[CountriesOptionsServlet] Cannot get writer: " + e.getMessage());
            return;
        }
        
        try {
            conn = DatabaseUtil.getConnection();
            System.out.println("[CountriesOptionsServlet] Database connection established");
            
            // Запрос активных стран (где текущая дата между COUNTRYSDATE и COUNTRYEDATE)
            String sql = "SELECT COUNTRYCODE, COUNTRYNAME " +
                        "FROM SESINT.COUNTRY " +
                        "WHERE COUNTRYSDATE <= SYSDATE AND COUNTRYEDATE >= SYSDATE " +
                        "ORDER BY SEQNUM, COUNTRYNAME";
            
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            
            out.print("[");
            
            boolean first = true;
            while (rs.next()) {
                if (!first) {
                    out.print(",");
                }
                first = false;
                count++;
                
                String code = rs.getString("COUNTRYCODE");
                String name = rs.getString("COUNTRYNAME");
                
                // Экранируем кавычки в названии
                name = name.replace("\"", "\\\"");
                name = name.replace("\\", "\\\\");
                
                out.print("{\"code\":\"" + code + "\",\"name\":\"" + name + "\"}");
            }
            
            out.print("]");
            System.out.println("[CountriesOptionsServlet] Loaded " + count + " countries from database");
            
            rs.close();
            stmt.close();
            
        } catch (SQLException e) {
            System.err.println("[CountriesOptionsServlet] ERROR loading countries: " + e.getMessage());
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
                errorMsg = "Unknown database error";
            }
            out.print("{\"error\":\"Ошибка базы данных: " + errorMsg + "\"}");
        } finally {
            DatabaseUtil.closeConnection(conn);
            if (out != null) {
                out.close();
            }
        }
    }
}

