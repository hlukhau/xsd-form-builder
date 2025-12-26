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
 * Сервлет для получения списка видов уведомлений (INCIDENTALERTKIND) для выпадающего списка
 * GET /api/incident-alert-kinds/options
 * Регистрируется в web.xml
 */
public class IncidentAlertKindOptionsServlet extends HttpServlet {
    
    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[IncidentAlertKindOptionsServlet] Initialized");
        System.out.println("[IncidentAlertKindOptionsServlet] Ready to load incident alert kinds from database");
    }
    
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        System.out.println("[IncidentAlertKindOptionsServlet] Loading incident alert kinds from database...");
        
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
            System.err.println("[IncidentAlertKindOptionsServlet] Cannot get writer: " + e.getMessage());
            return;
        }
        
        try {
            conn = DatabaseUtil.getConnection();
            System.out.println("[IncidentAlertKindOptionsServlet] Database connection established");
            
            // Запрос активных видов уведомлений (где INCIDENTALERTKINDACTFL = 1)
            String sql = "SELECT INCIDENTALERTKINDCODE, INCIDENTALERTKINDNAME " +
                        "FROM SESINT.INCIDENTALERTKIND " +
                        "WHERE INCIDENTALERTKINDACTFL = 1 " +
                        "ORDER BY INCIDENTALERTKINDSEQNUM, INCIDENTALERTKINDNAME";
            
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
                
                String code = rs.getString("INCIDENTALERTKINDCODE");
                String name = rs.getString("INCIDENTALERTKINDNAME");
                
                // Экранируем кавычки в названии
                if (name != null) {
                    name = name.replace("\\", "\\\\");
                    name = name.replace("\"", "\\\"");
                } else {
                    name = "";
                }
                
                if (code != null) {
                    code = code.replace("\\", "\\\\");
                    code = code.replace("\"", "\\\"");
                } else {
                    code = "";
                }
                
                out.print("{\"code\":\"" + code + "\",\"name\":\"" + name + "\"}");
            }
            
            out.print("]");
            System.out.println("[IncidentAlertKindOptionsServlet] Loaded " + count + " incident alert kinds from database");
            
            rs.close();
            stmt.close();
            
        } catch (SQLException e) {
            System.err.println("[IncidentAlertKindOptionsServlet] ERROR loading incident alert kinds: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            
            if (out == null) {
                try {
                    out = response.getWriter();
                } catch (IOException ioException) {
                    System.err.println("[IncidentAlertKindOptionsServlet] Cannot get writer for error response");
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

