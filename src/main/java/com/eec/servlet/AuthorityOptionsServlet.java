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
 * Сервлет для получения списка уполномоченных органов (AUTHORITY) для выпадающего списка
 * GET /api/authorities/options?countryCode=RU
 * Регистрируется в web.xml
 */
public class AuthorityOptionsServlet extends HttpServlet {
    
    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[AuthorityOptionsServlet] Initialized");
        System.out.println("[AuthorityOptionsServlet] Ready to load authorities from database");
    }
    
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        String countryCode = request.getParameter("countryCode");
        System.out.println("[AuthorityOptionsServlet] Loading authorities from database, countryCode: " + countryCode);
        
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
            System.err.println("[AuthorityOptionsServlet] Cannot get writer: " + e.getMessage());
            return;
        }
        
        try {
            conn = DatabaseUtil.getConnection();
            System.out.println("[AuthorityOptionsServlet] Database connection established");
            
            // Запрос уполномоченных органов
            // Если указан countryCode, фильтруем по нему
            String sql;
            PreparedStatement stmt;
            
            if (countryCode != null && !countryCode.trim().isEmpty()) {
                sql = "SELECT AUTHORITYUID, AUTHORITYNAME, AUTHORITYBRIEFNAME, COUNTRYCODE " +
                      "FROM SESINT.AUTHORITY " +
                      "WHERE COUNTRYCODE = ? " +
                      "ORDER BY AUTHORITYNAME";
                stmt = conn.prepareStatement(sql);
                stmt.setString(1, countryCode.trim().toUpperCase());
            } else {
                sql = "SELECT AUTHORITYUID, AUTHORITYNAME, AUTHORITYBRIEFNAME, COUNTRYCODE " +
                      "FROM SESINT.AUTHORITY " +
                      "ORDER BY COUNTRYCODE, AUTHORITYNAME";
                stmt = conn.prepareStatement(sql);
            }
            
            ResultSet rs = stmt.executeQuery();
            
            out.print("[");
            
            boolean first = true;
            while (rs.next()) {
                if (!first) {
                    out.print(",");
                }
                first = false;
                count++;
                
                String uid = rs.getString("AUTHORITYUID");
                String name = rs.getString("AUTHORITYNAME");
                String briefName = rs.getString("AUTHORITYBRIEFNAME");
                String code = rs.getString("COUNTRYCODE");
                
                // Экранируем кавычки
                if (uid != null) {
                    uid = uid.replace("\\", "\\\\");
                    uid = uid.replace("\"", "\\\"");
                } else {
                    uid = "";
                }
                
                if (name != null) {
                    name = name.replace("\\", "\\\\");
                    name = name.replace("\"", "\\\"");
                } else {
                    name = "";
                }
                
                if (briefName != null) {
                    briefName = briefName.replace("\\", "\\\\");
                    briefName = briefName.replace("\"", "\\\"");
                } else {
                    briefName = "";
                }
                
                if (code != null) {
                    code = code.replace("\\", "\\\\");
                    code = code.replace("\"", "\\\"");
                } else {
                    code = "";
                }
                
                out.print("{\"uid\":\"" + uid + "\",\"name\":\"" + name + "\",\"briefName\":\"" + briefName + "\",\"countryCode\":\"" + code + "\"}");
            }
            
            out.print("]");
            System.out.println("[AuthorityOptionsServlet] Loaded " + count + " authorities from database");
            
            rs.close();
            stmt.close();
            
        } catch (SQLException e) {
            System.err.println("[AuthorityOptionsServlet] ERROR loading authorities: " + e.getMessage());
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

