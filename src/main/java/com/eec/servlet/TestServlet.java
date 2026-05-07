package com.eec.servlet;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;

/**
 * Простой тестовый сервлет для проверки деплоя
 */
public class TestServlet extends HttpServlet {
    
    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("========================================");
        System.out.println("[TestServlet] INITIALIZED SUCCESSFULLY");
        System.out.println("========================================");
    }
    
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        System.out.println("========================================");
        System.out.println("[TestServlet] doGet CALLED");
        System.out.println("[TestServlet] Request URI: " + request.getRequestURI());
        System.out.println("[TestServlet] Context Path: " + request.getContextPath());
        System.out.println("========================================");
        
        response.setContentType("text/plain;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setStatus(HttpServletResponse.SC_OK);
        
        PrintWriter out = response.getWriter();
        out.print("TEST SERVLET WORKS! Request URI: " + request.getRequestURI());
        out.flush();
        out.close();
        
        System.out.println("[TestServlet] Response sent successfully");
    }
}



