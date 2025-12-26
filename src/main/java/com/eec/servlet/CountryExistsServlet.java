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
 * Сервлет для проверки существования страны по коду
 * GET /api/countries/{code}/exists
 * Регистрируется в web.xml
 */
public class CountryExistsServlet extends HttpServlet {
    
    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("========================================");
        System.out.println("[CountryExistsServlet] INITIALIZED");
        System.out.println("[CountryExistsServlet] Ready to check countries in database");
        System.out.println("========================================");
    }
    
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        System.out.println("========================================");
        System.out.println("[CountryExistsServlet] doGet CALLED");
        System.out.println("[CountryExistsServlet] Request URI: " + request.getRequestURI());
        System.out.println("[CountryExistsServlet] Context Path: " + request.getContextPath());
        System.out.println("[CountryExistsServlet] Query String: " + request.getQueryString());
        System.err.println("[CountryExistsServlet] ERROR STREAM TEST - doGet called");
        System.out.println("========================================");
        
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Cache-Control", "no-cache");
        
        // Извлекаем код страны из URL
        // URL: /xsd_form_builder/api/countries/RU/exists
        String requestURI = request.getRequestURI();
        String contextPath = request.getContextPath();
        
        // Убираем context path из URI
        String path = requestURI;
        if (contextPath != null && !contextPath.isEmpty()) {
            path = requestURI.substring(contextPath.length());
        }
        
        // path теперь: /api/countries/BY/exists (основной формат)
        // или /api/countries/exists/BY (альтернативный формат)
        // Извлекаем код страны
        String countryCode = null;
        
        // Основной формат: /api/countries/BY/exists (используется фронтендом)
        if (path.startsWith("/api/countries/") && path.endsWith("/exists")) {
            String codePart = path.substring("/api/countries/".length());
            codePart = codePart.substring(0, codePart.length() - "/exists".length());
            countryCode = codePart.toUpperCase().trim();
        }
        // Альтернативный формат: /api/countries/exists/BY
        else if (path.startsWith("/api/countries/exists/")) {
            countryCode = path.substring("/api/countries/exists/".length()).toUpperCase().trim();
        }
        // Если это не запрос к /exists, возвращаем 404
        else {
            System.out.println("[CountryExistsServlet] Path does not match /exists pattern: " + path);
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            PrintWriter errorOut = response.getWriter();
            errorOut.print("{\"error\":\"Endpoint not found. Use /api/countries/{code}/exists\"}");
            errorOut.close();
            return;
        }
        
        if (countryCode == null || countryCode.isEmpty()) {
            System.out.println("[CountryExistsServlet] ERROR: Country code not specified, path: " + path);
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            PrintWriter errorOut = response.getWriter();
            errorOut.print("{\"error\":\"Код страны не указан или неверный формат URL\",\"exists\":false}");
            errorOut.close();
            return;
        }
        
        System.out.println("[CountryExistsServlet] Checking country: " + countryCode);
        
        Connection conn = null;
        PrintWriter out = null;
        
        // Создаем writer заранее, чтобы гарантировать ответ даже при ошибке
        try {
            out = response.getWriter();
            System.out.println("[CountryExistsServlet] Writer created successfully");
        } catch (IOException e) {
            System.err.println("[CountryExistsServlet] Cannot get writer: " + e.getMessage());
            e.printStackTrace();
            return;
        }
        
        try {
            conn = DatabaseUtil.getConnection();
            System.out.println("[CountryExistsServlet] Database connection established");
            
            // Проверка существования активной страны
            String sql = "SELECT COUNTRYNAME " +
                        "FROM SESINT.COUNTRY " +
                        "WHERE UPPER(COUNTRYCODE) = ? " +
                        "AND COUNTRYSDATE <= SYSDATE AND COUNTRYEDATE >= SYSDATE";
            
            PreparedStatement stmt = conn.prepareStatement(sql);
            stmt.setString(1, countryCode);
            ResultSet rs = stmt.executeQuery();
            
            // Writer уже создан выше, используем его
            if (rs.next()) {
                String name = rs.getString("COUNTRYNAME");
                // Экранируем кавычки и обратные слеши
                if (name != null) {
                    name = name.replace("\\", "\\\\");
                    name = name.replace("\"", "\\\"");
                } else {
                    name = "";
                }
                System.out.println("[CountryExistsServlet] Country " + countryCode + " found: " + name);
                String jsonResponse = "{\"exists\":true,\"code\":\"" + countryCode + "\",\"name\":\"" + name + "\"}";
                System.out.println("[CountryExistsServlet] Sending response: " + jsonResponse);
                out.print(jsonResponse);
                out.flush();
                System.out.println("[CountryExistsServlet] Response flushed");
            } else {
                System.out.println("[CountryExistsServlet] Country " + countryCode + " not found");
                String jsonResponse = "{\"exists\":false,\"code\":\"" + countryCode + "\"}";
                System.out.println("[CountryExistsServlet] Sending response: " + jsonResponse);
                out.print(jsonResponse);
                out.flush();
                System.out.println("[CountryExistsServlet] Response flushed");
            }
            
            rs.close();
            stmt.close();
            
        } catch (SQLException e) {
            System.err.println("[CountryExistsServlet] ERROR checking country " + countryCode + ": " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            
            // Убеждаемся, что у нас есть writer для ответа
            if (out == null) {
                try {
                    out = response.getWriter();
                } catch (IOException ioException) {
                    System.err.println("[CountryExistsServlet] Cannot get writer for error response");
                    ioException.printStackTrace();
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
            out.print("{\"error\":\"Ошибка базы данных: " + errorMsg + "\",\"exists\":false,\"code\":\"" + countryCode + "\"}");
            out.flush();
        } catch (Exception e) {
            System.err.println("[CountryExistsServlet] Unexpected error: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            
            if (out == null) {
                try {
                    out = response.getWriter();
                } catch (IOException ioException) {
                    System.err.println("[CountryExistsServlet] Cannot get writer for error response");
                    return;
                }
            }
            
            String errorMsg = e.getMessage();
            if (errorMsg != null) {
                errorMsg = errorMsg.replace("\\", "\\\\");
                errorMsg = errorMsg.replace("\"", "\\\"");
            } else {
                errorMsg = "Unknown error";
            }
            out.print("{\"error\":\"Ошибка: " + errorMsg + "\",\"exists\":false,\"code\":\"" + (countryCode != null ? countryCode : "") + "\"}");
            out.flush();
        } finally {
            DatabaseUtil.closeConnection(conn);
            if (out != null) {
                out.close();
            }
        }
    }
}
