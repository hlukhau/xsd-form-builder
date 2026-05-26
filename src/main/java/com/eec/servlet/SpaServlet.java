package com.eec.servlet;

import javax.servlet.DispatcherType;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Сервлет для обработки SPA маршрутизации.
 * Перенаправляет все запросы, которые не являются статическими ресурсами, на index.html
 * Регистрируется в web.xml
 */
public class SpaServlet extends HttpServlet {

    private static final String[] STATIC_RESOURCE_EXTENSIONS = {
        ".js", ".css", ".json", ".xml", ".png", ".jpg", ".jpeg", ".gif", ".svg",
        ".ico", ".woff", ".woff2", ".ttf", ".eot", ".map"
    };

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[SpaServlet] Initialized");
    }
    
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        // REQUEST — обычный запрос; FORWARD — welcome-file (/) → index.html.
        // ERROR не обрабатываем (раньше error-page 500→index.html давал пустой ответ и рекурсию).
        DispatcherType dispatcherType = request.getDispatcherType();
        if (dispatcherType != DispatcherType.REQUEST && dispatcherType != DispatcherType.FORWARD) {
            if (dispatcherType == DispatcherType.ERROR) {
                String requestURI = request.getRequestURI();
                String errorStatus = request.getAttribute("javax.servlet.error.status_code") != null
                        ? request.getAttribute("javax.servlet.error.status_code").toString()
                        : "unknown";
                System.out.println("[SpaServlet] Skipping ERROR dispatcher. URI: " + requestURI + ", status: " + errorStatus);
            }
            return;
        }
        
        String requestURI = request.getRequestURI();
        String contextPath = request.getContextPath();
        
        System.out.println("[SpaServlet] Request: " + requestURI + ", contextPath: " + contextPath);
        
        // Убираем context path из URI
        String path = requestURI.startsWith(contextPath) 
            ? requestURI.substring(contextPath.length()) 
            : requestURI;
        
        // Пропускаем API запросы - они обрабатываются другими сервлетами
        // В Tomcat более специфичные паттерны обрабатываются первыми,
        // но если SpaServlet уже вызван, нужно явно не обрабатывать запрос
        if (path != null && path.startsWith("/api/")) {
            System.out.println("[SpaServlet] Skipping API request: " + path + " - letting other servlets handle it");
            // ВАЖНО: В Tomcat паттерн /* перехватывает все запросы, включая API.
            // Более специфичные паттерны должны обрабатываться первыми, но если SpaServlet
            // уже вызван, return не передаст управление другим сервлетам.
            // Решение: не обрабатываем запрос вообще - просто возвращаемся.
            // Tomcat должен был вызвать более специфичный сервлет первым, но если мы здесь,
            // значит что-то не так с конфигурацией или порядком загрузки.
            System.err.println("[SpaServlet] WARNING: API request reached SpaServlet - this should not happen!");
            System.err.println("[SpaServlet] This means more specific patterns are not working correctly.");
            // НЕ записываем в response - просто возвращаемся
            // Это может привести к пустому ответу, но предотвратит рекурсию
            return;
        }
        
        // Для корня и index.html возвращаем index.html
        if (path != null && (path.equals("/index.html") || path.equals("/"))) {
            // Возвращаем index.html для корня и прямого запроса
            System.out.println("[SpaServlet] Returning index.html for root/index.html");
            InputStream is = getServletContext().getResourceAsStream("/index.html");
            if (is != null) {
                response.setContentType("text/html;charset=UTF-8");
                response.setStatus(HttpServletResponse.SC_OK);
                
                copyStream(is, response.getOutputStream());
            } else {
                response.sendError(HttpServletResponse.SC_NOT_FOUND, "index.html not found");
            }
            return;
        }
        
        // Проверяем, является ли запрос к папке assets или другим статическим ресурсам
        if (path != null && (path.startsWith("/assets/") || path.startsWith("/xml/"))) {
            // Для статических ресурсов читаем напрямую и устанавливаем правильный MIME тип
            InputStream resourceStream = getServletContext().getResourceAsStream(path);
            if (resourceStream != null) {
                // Определяем content-type по расширению
                String contentType = getContentType(path);
                if (contentType == null || contentType.isEmpty()) {
                    contentType = "application/octet-stream";
                }
                System.out.println("[SpaServlet] Serving static resource: " + path + " with content-type: " + contentType);
                response.setContentType(contentType);
                response.setStatus(HttpServletResponse.SC_OK);
                
                copyStream(resourceStream, response.getOutputStream());
            } else {
                System.out.println("[SpaServlet] Static resource not found: " + path);
                response.sendError(HttpServletResponse.SC_NOT_FOUND);
            }
            return;
        }
        
        // Если это статический ресурс по расширению, обрабатываем аналогично
        if (isStaticResource(path)) {
            InputStream resourceStream = getServletContext().getResourceAsStream(path);
            if (resourceStream != null) {
                String contentType = getContentType(path);
                if (contentType == null || contentType.isEmpty()) {
                    contentType = "application/octet-stream";
                }
                System.out.println("[SpaServlet] Serving static resource: " + path + " with content-type: " + contentType);
                response.setContentType(contentType);
                response.setStatus(HttpServletResponse.SC_OK);
                
                copyStream(resourceStream, response.getOutputStream());
            } else {
                System.out.println("[SpaServlet] Static resource not found: " + path);
                response.sendError(HttpServletResponse.SC_NOT_FOUND);
            }
            return;
        }
        
        // Для всех остальных запросов (SPA routes) возвращаем index.html
        // Читаем файл напрямую, чтобы избежать рекурсии
        System.out.println("[SpaServlet] Returning index.html for path: " + path);
        InputStream is = getServletContext().getResourceAsStream("/index.html");
        if (is != null) {
            System.out.println("[SpaServlet] index.html found, sending content");
            response.setContentType("text/html;charset=UTF-8");
            response.setStatus(HttpServletResponse.SC_OK);
            
            int totalBytes = copyStream(is, response.getOutputStream());
            System.out.println("[SpaServlet] Sent " + totalBytes + " bytes");
        } else {
            System.out.println("[SpaServlet] ERROR: index.html not found!");
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

    private static int copyStream(InputStream in, OutputStream out) throws IOException {
        byte[] buffer = new byte[4096];
        int totalBytes = 0;
        int bytesRead;
        try {
            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
                totalBytes += bytesRead;
            }
            out.flush();
        } finally {
            in.close();
        }
        return totalBytes;
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
        
        return false;
    }
    
    /**
     * Определяет content-type по расширению файла
     */
    private String getContentType(String path) {
        if (path == null) {
            return "application/octet-stream";
        }
        
        String lowerPath = path.toLowerCase();
        if (lowerPath.endsWith(".js")) {
            // Для модульных JS файлов используем application/javascript
            return "application/javascript";
        } else if (lowerPath.endsWith(".css")) {
            return "text/css;charset=UTF-8";
        } else if (lowerPath.endsWith(".json")) {
            return "application/json;charset=UTF-8";
        } else if (lowerPath.endsWith(".xml")) {
            return "application/xml;charset=UTF-8";
        } else if (lowerPath.endsWith(".svg")) {
            return "image/svg+xml";
        } else if (lowerPath.endsWith(".png")) {
            return "image/png";
        } else if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) {
            return "image/jpeg";
        } else if (lowerPath.endsWith(".gif")) {
            return "image/gif";
        } else if (lowerPath.endsWith(".woff")) {
            return "font/woff";
        } else if (lowerPath.endsWith(".woff2")) {
            return "font/woff2";
        } else if (lowerPath.endsWith(".ttf")) {
            return "font/ttf";
        } else if (lowerPath.endsWith(".eot")) {
            return "application/vnd.ms-fontobject";
        } else if (lowerPath.endsWith(".ico")) {
            return "image/x-icon";
        } else {
            return "application/octet-stream";
        }
    }
}




