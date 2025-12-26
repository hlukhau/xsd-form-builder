package com.eec.servlet;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Сервлет для обработки SPA маршрутизации.
 * Перенаправляет все запросы, которые не являются статическими ресурсами, на index.html
 */
@WebServlet(name = "SpaServlet", urlPatterns = {"/*"})
public class SpaServlet extends HttpServlet {

    private static final String[] STATIC_RESOURCE_EXTENSIONS = {
        ".js", ".css", ".json", ".xml", ".png", ".jpg", ".jpeg", ".gif", ".svg",
        ".ico", ".woff", ".woff2", ".ttf", ".eot", ".map"
    };

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String requestURI = request.getRequestURI();
        String contextPath = request.getContextPath();
        
        // Убираем context path из URI
        String path = requestURI.startsWith(contextPath) 
            ? requestURI.substring(contextPath.length()) 
            : requestURI;
        
        // Если это статический ресурс, пропускаем обработку
        if (isStaticResource(path)) {
            // Позволяем контейнеру обработать статический ресурс
            return;
        }
        
        // Для всех остальных запросов возвращаем index.html
        String indexPath = getServletContext().getRealPath("/index.html");
        if (indexPath != null && Files.exists(Paths.get(indexPath))) {
            request.getRequestDispatcher("/index.html").forward(request, response);
        } else {
            response.sendError(HttpServletResponse.SC_NOT_FOUND, "index.html not found");
        }
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        doGet(request, response);
    }

    @Override
    protected void doPut(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        doGet(request, response);
    }

    @Override
    protected void doDelete(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        doGet(request, response);
    }

    /**
     * Проверяет, является ли путь статическим ресурсом
     */
    private boolean isStaticResource(String path) {
        if (path == null || path.isEmpty() || "/".equals(path)) {
            return false;
        }
        
        String lowerPath = path.toLowerCase();
        for (String extension : STATIC_RESOURCE_EXTENSIONS) {
            if (lowerPath.endsWith(extension)) {
                return true;
            }
        }
        
        // Проверяем, является ли это API endpoint (начинается с /api/)
        if (lowerPath.startsWith("/api/")) {
            return false; // API endpoints обрабатываются отдельно
        }
        
        return false;
    }
}


