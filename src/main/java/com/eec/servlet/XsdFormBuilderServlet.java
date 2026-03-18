package com.eec.servlet;

import com.eec.util.DatabaseUtil;

import javax.servlet.ReadListener;
import javax.servlet.ServletException;
import javax.servlet.ServletInputStream;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletRequestWrapper;
import javax.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Clob;
/**
 * Сервлет для работы с XSD Form Builder.
 * POST /xsd_form_builder - принимает JSON с GUID и сохраняет в мапу
 * GET /xsd_form_builder/{DPAID} - возвращает HTML форму (SPA) для отображения карты по DPAID
 * GET /xsd_form_builder/{DPAID}/{GUID} - возвращает HTML форму (SPA) с проверкой GUID в мапе
 * Форма загружает XML из базы через API /api/dpa/xml/{DPAID}
 */
public class XsdFormBuilderServlet extends HttpServlet {

    /** Инженерный GUID "1" — всегда в карте, не требует предварительного POST. */
    private static final String ENGINEERING_GUID = "1";
    private static final String ENGINEERING_GUID_JSON =
            "{\n" +
                    "  \"GUID\": \"4c5a50f1-a7b7-494c-93a6-85f8f0b16998\",\n" +
                    "  \"dbConnectString\": \"jdbc:oracle:thin:@192.168.203.212:1521/ses\",\n" +
                    "  \"userId\": \"1\",\n" +
                    "  \"dbUsername\": \"sesdev\",\n" +
                    "  \"dbPassword\": \"sesdev\",\n" +
                    "  \"department\": {\n" +
                    "    \"depid\": 522,\n" +
                    "    \"depkindid\": 73\n" +
                    "  },\n" +
                    "  \"up\": {\n" +
                    "    \"dangerousProductOut\": {\n" +
                    "      \"view\": {\n" +
                    "        \"522\": {}\n" +
                    "      },\n" +
                    "      \"access\": {\n" +
                    "        \"522\": {}\n" +
                    "      },\n" +
                    "      \"edit\": {\n" +
                    "        \"522\": {}\n" +
                    "      },\n" +
                    "      \"send\": {\n" +
                    "        \"522\": {}\n" +
                    "      },\n" +
                    "      \"status\": {\n" +
                    "        \"522\": {}\n" +
                    "      },\n" +
                    "      \"create\": {\n" +
                    "        \"132\": {},\n" +
                    "        \"522\": {}\n" +
                    "      }\n" +
                    "    },\n" +
                    "    \"dangerousProductDB\": {\n" +
                    "      \"view\": {\n" +
                    "        \"522\": {}\n" +
                    "      },\n" +
                    "      \"access\": {\n" +
                    "        \"522\": {}\n" +
                    "      }\n" +
                    "    },\n" +
                    "    \"dangerousProductIn\": {\n" +
                    "      \"view\": {\n" +
                    "        \"522\": {}\n" +
                    "      },\n" +
                    "      \"access\": {\n" +
                    "        \"522\": {}\n" +
                    "      },\n" +
                    "      \"status\": {\n" +
                    "        \"522\": {}\n" +
                    "      }\n" +
                    "    }\n" +
                    "  }\n" +
                    "}";

    @Override
    public void init() throws ServletException {
        super.init();
        RightsJsonStore.guidMap.put(ENGINEERING_GUID, ENGINEERING_GUID_JSON);
        System.out.println("[XsdFormBuilderServlet] Initialized; engineering GUID " + ENGINEERING_GUID + " added to map");
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String pathInfo = request.getPathInfo();
        if (pathInfo != null && pathInfo.equals("/api/dpa/save")) {
            javax.servlet.RequestDispatcher rd = getServletContext().getNamedDispatcher("DpaSaveServlet");
            if (rd != null) {
                rd.forward(request, response);
                return;
            }
        }

        response.setCharacterEncoding("UTF-8");
        response.setContentType("application/json;charset=UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");

        try {
            // Читаем body запроса
            BufferedReader reader = request.getReader();
            StringBuilder jsonBuilder = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                jsonBuilder.append(line);
            }
            String jsonBody = jsonBuilder.toString().trim();

            if (jsonBody.isEmpty()) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                response.getWriter().print("{\"error\":\"Request body is empty\"}");
                return;
            }

            // Парсим JSON для извлечения GUID
            // Ожидаемый формат: {"guid": "..."} или {"GUID": "..."}
            String guid = extractGuidFromJson(jsonBody);
            if (guid == null || guid.isEmpty()) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                response.getWriter().print("{\"error\":\"GUID not found in JSON body\"}");
                return;
            }

            // Сохраняем GUID -> JSON в мапу (читается RightsServlet для «Определить доступ»)
            RightsJsonStore.guidMap.put(guid, jsonBody);
            System.out.println("[XsdFormBuilderServlet] Stored GUID: " + guid);

            response.setStatus(HttpServletResponse.SC_OK);
            response.getWriter().print("{\"success\":true,\"guid\":\"" + guid + "\"}");

        } catch (Exception e) {
            System.err.println("[XsdFormBuilderServlet] POST error: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"error\":\"" + e.getMessage().replace("\"", "'") + "\"}");
        }
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        // getPathInfo() возвращает часть пути после паттерна маппинга
        String pathInfo = request.getPathInfo();
        
        System.out.println("[XsdFormBuilderServlet] doGet called, pathInfo: " + pathInfo);
        
        // Если pathInfo пустой или только "/", это запрос к корню - возвращаем SPA
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            System.out.println("[XsdFormBuilderServlet] Empty path, returning SPA");
            forwardToSpa(request, response);
            return;
        }

        // Проверяем, не является ли это запросом к статическим ресурсам
        // Если путь содержит точку (расширение файла), это статический ресурс
        if (pathInfo.contains(".")) {
            System.out.println("[XsdFormBuilderServlet] Static resource detected: " + pathInfo);
            // Обрабатываем статический ресурс напрямую
            serveStaticResource(pathInfo, request, response);
            return;
        }

        // Убираем начальный слеш
        String path = pathInfo.startsWith("/") ? pathInfo.substring(1) : pathInfo;
        String[] parts = path.split("/");

        System.out.println("[XsdFormBuilderServlet] Path parts count: " + parts.length + ", parts: " + java.util.Arrays.toString(parts));

        // Если путь содержит 2 сегмента: /xsd_form_builder/{DPAID}/{GUID}
        // Опционально: ?command=copy или ?command=delete — вызов API без нажатия кнопки (без проверки прав)
        if (parts.length == 2) {
            String dpaidStr = parts[0];
            String guid = parts[1];

            if (dpaidStr.isEmpty() || guid.isEmpty()) {
                System.out.println("[XsdFormBuilderServlet] Empty DPAID or GUID, returning SPA");
                forwardToSpa(request, response);
                return;
            }

            String command = request.getParameter("command");
            if (command != null && !command.trim().isEmpty()) {
                String cmd = command.trim().toLowerCase();
                if ("delete".equals(cmd)) {
                    long dpaid;
                    try {
                        dpaid = Long.parseLong(dpaidStr);
                    } catch (NumberFormatException e) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        response.setContentType("application/json;charset=UTF-8");
                        response.getWriter().print("{\"success\":false,\"message\":\"Неверный DPAID\"}");
                        return;
                    }
                    String body = "{\"dpaid\":" + dpaid + ",\"guid\":\"" + escapeJsonString(guid) + "\"}";
                    HttpServletRequest wrapped = new PostBodyRequestWrapper(request, body, true);
                    try {
                        request.getRequestDispatcher("/api/dpa/delete").forward(wrapped, response);
                    } catch (Exception e) {
                        System.err.println("[XsdFormBuilderServlet] command=delete forward error: " + e.getMessage());
                        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                        response.setContentType("application/json;charset=UTF-8");
                        response.getWriter().print("{\"success\":false,\"message\":\"" + escapeJsonString(e.getMessage()) + "\"}");
                    }
                    return;
                }
                if ("copy".equals(cmd)) {
                    long dpaid;
                    try {
                        dpaid = Long.parseLong(dpaidStr);
                    } catch (NumberFormatException e) {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        response.setContentType("application/json;charset=UTF-8");
                        response.getWriter().print("{\"success\":false,\"message\":\"Неверный DPAID\"}");
                        return;
                    }
                    Connection conn = null;
                    try {
                        conn = DatabaseUtil.getConnectionForRequest(request, guid);
                        String xmlBody = getXmlBodyByDpaid(conn, dpaid);
                        if (xmlBody == null || xmlBody.trim().isEmpty()) {
                            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                            response.setContentType("application/json;charset=UTF-8");
                            response.getWriter().print("{\"success\":false,\"message\":\"Карта с DPAID " + dpaid + " не найдена или пустой XML\"}");
                            return;
                        }
                        String body = buildCopySaveBody(dpaid, guid, xmlBody);
                        HttpServletRequest wrapped = new PostBodyRequestWrapper(request, body, true);
                        request.getRequestDispatcher("/api/dpa/save").forward(wrapped, response);
                    } catch (SQLException e) {
                        System.err.println("[XsdFormBuilderServlet] command=copy DB error: " + e.getMessage());
                        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                        response.setContentType("application/json;charset=UTF-8");
                        response.getWriter().print("{\"success\":false,\"message\":\"" + escapeJsonString("Ошибка БД: " + e.getMessage()) + "\"}");
                    } catch (Exception e) {
                        System.err.println("[XsdFormBuilderServlet] command=copy forward error: " + e.getMessage());
                        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                        response.setContentType("application/json;charset=UTF-8");
                        response.getWriter().print("{\"success\":false,\"message\":\"" + escapeJsonString(e.getMessage()) + "\"}");
                    } finally {
                        if (conn != null) {
                            try { conn.close(); } catch (SQLException ignored) {}
                        }
                    }
                    return;
                }
            }

            // Проверяем наличие GUID в мапе (инженерный GUID "1" всегда разрешён и уже в карте)
            System.out.println("[XsdFormBuilderServlet] Checking GUID in map for DPAID: " + dpaidStr + ", GUID: " + guid);
            System.out.println("[XsdFormBuilderServlet] Current map size: " + RightsJsonStore.guidMap.size());
            
            if (!RightsJsonStore.guidMap.containsKey(guid)) {
                System.err.println("[XsdFormBuilderServlet] GUID not found in map: " + guid);
                System.err.println("[XsdFormBuilderServlet] Available GUIDs in map: " + RightsJsonStore.guidMap.keySet());
                // Возвращаем HTML страницу с ошибкой вместо JSON
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("text/html;charset=UTF-8");
                response.getWriter().print("<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Доступ запрещен</title></head><body><h1>403 - Доступ запрещен</h1><p>GUID не найден или истек срок действия.</p><p>GUID: " + guid + "</p></body></html>");
                return;
            }
            
            System.out.println("[XsdFormBuilderServlet] GUID found in map: " + guid + ", returning SPA for DPAID: " + dpaidStr);
            // GUID найден - возвращаем SPA форму
            forwardToSpa(request, response);
            return;
        }

        // Если путь содержит 1 сегмент: /xsd_form_builder/{DPAID}
        // Или любое другое количество сегментов - просто возвращаем SPA
        System.out.println("[XsdFormBuilderServlet] Path does not contain GUID, returning SPA");
        forwardToSpa(request, response);
    }

    @Override
    protected void doOptions(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        response.setStatus(HttpServletResponse.SC_OK);
    }

    /**
     * Возвращает index.html для SPA роутов
     */
    private void forwardToSpa(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        System.out.println("[XsdFormBuilderServlet] Returning index.html for SPA: " + request.getPathInfo());
        
        // Возвращаем index.html напрямую для SPA роутов
        InputStream is = getServletContext().getResourceAsStream("/index.html");
        if (is != null) {
            response.setContentType("text/html;charset=UTF-8");
            response.setStatus(HttpServletResponse.SC_OK);
            
            OutputStream os = response.getOutputStream();
            byte[] buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = is.read(buffer)) >= 0) {
                os.write(buffer, 0, bytesRead);
            }
            is.close();
            os.flush();
        } else {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            response.setContentType("text/plain;charset=UTF-8");
            response.getWriter().print("index.html not found");
        }
    }

    /**
     * Обрабатывает статические ресурсы (JS, CSS, изображения и т.д.)
     */
    private void serveStaticResource(String pathInfo, HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        // pathInfo уже содержит начальный слеш, например "/assets/index-CRVosi6W.js"
        // getServletContext().getResourceAsStream() ищет относительно корня веб-приложения
        String resourcePath = pathInfo.startsWith("/") ? pathInfo : "/" + pathInfo;
        
        System.out.println("[XsdFormBuilderServlet] Trying to load static resource: " + resourcePath);
        
        InputStream resourceStream = getServletContext().getResourceAsStream(resourcePath);
        if (resourceStream != null) {
            // Определяем content-type по расширению
            String contentType = getContentType(resourcePath);
            if (contentType == null || contentType.isEmpty()) {
                contentType = "application/octet-stream";
            }
            
            System.out.println("[XsdFormBuilderServlet] Serving static resource: " + resourcePath + " with content-type: " + contentType);
            response.setContentType(contentType);
            response.setStatus(HttpServletResponse.SC_OK);
            
            OutputStream os = response.getOutputStream();
            byte[] buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = resourceStream.read(buffer)) >= 0) {
                os.write(buffer, 0, bytesRead);
            }
            resourceStream.close();
            os.flush();
        } else {
            System.out.println("[XsdFormBuilderServlet] Static resource not found: " + resourcePath);
            // Пробуем без начального слеша
            String altPath = resourcePath.startsWith("/") ? resourcePath.substring(1) : resourcePath;
            resourceStream = getServletContext().getResourceAsStream(altPath);
            if (resourceStream != null) {
                String contentType = getContentType(resourcePath);
                if (contentType == null || contentType.isEmpty()) {
                    contentType = "application/octet-stream";
                }
                System.out.println("[XsdFormBuilderServlet] Serving static resource (alt path): " + altPath);
                response.setContentType(contentType);
                response.setStatus(HttpServletResponse.SC_OK);
                
                OutputStream os = response.getOutputStream();
                byte[] buffer = new byte[4096];
                int bytesRead;
                while ((bytesRead = resourceStream.read(buffer)) >= 0) {
                    os.write(buffer, 0, bytesRead);
                }
                resourceStream.close();
                os.flush();
            } else {
                System.out.println("[XsdFormBuilderServlet] Static resource not found (both paths tried)");
                response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            }
        }
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

    /**
     * Извлекает GUID из JSON строки
     * Поддерживает форматы: {"guid": "..."}, {"GUID": "..."}, {"guid":"..."}
     */
    private String extractGuidFromJson(String json) {
        if (json == null || json.isEmpty()) {
            return null;
        }

        // Простой парсинг JSON без библиотек
        // Ищем "guid" или "GUID" в любом регистре
        json = json.trim();
        
        // Убираем фигурные скобки если есть
        if (json.startsWith("{") && json.endsWith("}")) {
            json = json.substring(1, json.length() - 1).trim();
        }

        // Ищем ключ "guid" (case-insensitive)
        String[] patterns = {"\"guid\"", "\"GUID\"", "'guid'", "'GUID'"};
        for (String pattern : patterns) {
            int keyIndex = json.toLowerCase().indexOf(pattern.toLowerCase());
            if (keyIndex >= 0) {
                // Находим значение после двоеточия
                int colonIndex = json.indexOf(':', keyIndex);
                if (colonIndex >= 0) {
                    String valuePart = json.substring(colonIndex + 1).trim();
                    // Убираем кавычки
                    if (valuePart.startsWith("\"")) {
                        int endQuote = valuePart.indexOf('"', 1);
                        if (endQuote > 0) {
                            return valuePart.substring(1, endQuote);
                        }
                    } else if (valuePart.startsWith("'")) {
                        int endQuote = valuePart.indexOf('\'', 1);
                        if (endQuote > 0) {
                            return valuePart.substring(1, endQuote);
                        }
                    } else {
                        // Без кавычек - берем до запятой или конца
                        int commaIndex = valuePart.indexOf(',');
                        if (commaIndex > 0) {
                            return valuePart.substring(0, commaIndex).trim();
                        }
                        return valuePart.trim();
                    }
                }
            }
        }

        return null;
    }

    /** Экранирование строки для вставки в JSON (кавычки и обратный слэш). */
    private static String escapeJsonString(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    private static final String SQL_GET_XML_BODY = "SELECT DPAXMLBODY FROM DPAXML WHERE DPAID = ?";

    /** Читает XML-тело карты по DPAID из DPAXML. */
    private String getXmlBodyByDpaid(Connection conn, long dpaid) throws SQLException, IOException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_GET_XML_BODY)) {
            ps.setLong(1, dpaid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                Clob clob = rs.getClob("DPAXMLBODY");
                if (clob == null) return null;
                try (Reader r = clob.getCharacterStream()) {
                    StringBuilder sb = new StringBuilder();
                    char[] buf = new char[4096];
                    int n;
                    while ((n = r.read(buf)) >= 0) sb.append(buf, 0, n);
                    return sb.toString();
                }
            }
        }
    }

    /** Формирует тело POST для создания новой версии (copy): isNew, copyFromDpaid, guid, xmlBody, metadata. */
    private String buildCopySaveBody(long copyFromDpaid, String guid, String xmlBody) {
        String escaped = escapeJsonString(xmlBody);
        return "{\"isNew\":true,\"copyFromDpaid\":" + copyFromDpaid + ",\"guid\":\"" + escapeJsonString(guid) + "\",\"xmlBody\":\"" + escaped + "\",\"metadata\":{}}";
    }

    /**
     * Обёртка запроса: подменяет метод на POST и тело на заданный JSON.
     * При commandInvoke=true атрибут com.eec.command.invoke = true (для отключения проверки прав в API).
     */
    private static final class PostBodyRequestWrapper extends HttpServletRequestWrapper {
        private final byte[] bodyBytes;
        private final boolean commandInvoke;
        private static final String ATTR_COMMAND_INVOKE = "com.eec.command.invoke";

        PostBodyRequestWrapper(HttpServletRequest request, String body, boolean commandInvoke) {
            super(request);
            this.bodyBytes = body.getBytes(StandardCharsets.UTF_8);
            this.commandInvoke = commandInvoke;
        }

        @Override
        public String getMethod() {
            return "POST";
        }

        @Override
        public String getContentType() {
            return "application/json;charset=UTF-8";
        }

        @Override
        public Object getAttribute(String name) {
            if (commandInvoke && ATTR_COMMAND_INVOKE.equals(name)) return Boolean.TRUE;
            return super.getAttribute(name);
        }

        @Override
        public ServletInputStream getInputStream() {
            return new ServletInputStream() {
                private final ByteArrayInputStream in = new ByteArrayInputStream(bodyBytes);
                @Override
                public boolean isFinished() { return in.available() == 0; }
                @Override
                public boolean isReady() { return true; }
                @Override
                public void setReadListener(ReadListener readListener) { }
                @Override
                public int read() throws IOException { return in.read(); }
            };
        }

        @Override
        public BufferedReader getReader() {
            return new BufferedReader(new InputStreamReader(new ByteArrayInputStream(bodyBytes), StandardCharsets.UTF_8));
        }
    }
}
