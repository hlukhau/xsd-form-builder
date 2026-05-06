package com.eec.servlet;

import com.eec.rights.CachingHttpRightsRegistry;
import com.eec.rights.GuidJsonExtractor;
import com.eec.rights.RightsRegistryException;
import com.eec.rights.RightsRegistry;
import com.eec.rights.RightsRegistryProvider;

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
import java.nio.charset.StandardCharsets;
/**
 * Сервлет для работы с XSD Form Builder.
 * POST /dpa_card, /pha_card или /ppv_card — принимает JSON с GUID и сохраняет в мапу (контекст приложения).
 * GET .../{DPAID|PPVID|PHAID} — возвращает HTML форму (SPA) для отображения карты
 * GET .../{id}/{GUID} — возвращает HTML форму (SPA) с проверкой GUID в мапе
 * Форма загружает XML из базы через /api/dpa/xml/{id}, /api/ppv/xml/{id} или /api/pha/xml/{id} (в зависимости от контекста WAR)
 */
public class XsdFormBuilderServlet extends HttpServlet {

    /** Инженерный GUID "1" — всегда в карте, не требует предварительного POST. */
    private static final String ENGINEERING_GUID = "1";
    private static final String ENGINEERING_GUID_JSON =
            "{\n" +
                    "  \"GUID\": \"1\",\n" +
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
                    "    },\n" +
                    "    \"violationDetectedOut\": {\n" +
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
                    "    \"violationDetectedDB\": {\n" +
                    "      \"view\": {\n" +
                    "        \"522\": {}\n" +
                    "      },\n" +
                    "      \"access\": {\n" +
                    "        \"522\": {}\n" +
                    "      }\n" +
                    "    },\n" +
                    "    \"violationDetectedIn\": {\n" +
                    "      \"view\": {\n" +
                    "        \"522\": {}\n" +
                    "      },\n" +
                    "      \"access\": {\n" +
                    "        \"522\": {}\n" +
                    "      },\n" +
                    "      \"status\": {\n" +
                    "        \"522\": {}\n" +
                    "      }\n" +
                    "    },\n" +
                    "    \"publicHealthOut\": {\n" +
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
                    "    \"publicHealthDB\": {\n" +
                    "      \"view\": {\n" +
                    "        \"522\": {}\n" +
                    "      },\n" +
                    "      \"access\": {\n" +
                    "        \"522\": {}\n" +
                    "      }\n" +
                    "    },\n" +
                    "    \"publicHealthIn\": {\n" +
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
        RightsRegistry reg = RightsRegistryProvider.get();
        if (reg instanceof CachingHttpRightsRegistry) {
            ((CachingHttpRightsRegistry) reg).putLocalCacheOnly(ENGINEERING_GUID, ENGINEERING_GUID_JSON);
            System.out.println("[XsdFormBuilderServlet] Initialized; engineering GUID " + ENGINEERING_GUID
                    + " в локальном кэше прав (старт без синхронного POST в EEC, иначе до ~45 с ожидания при недоступном сервисе прав)");
        } else {
            try {
                reg.putRightsJson(ENGINEERING_GUID, ENGINEERING_GUID_JSON);
                System.out.println("[XsdFormBuilderServlet] Initialized; engineering GUID " + ENGINEERING_GUID + " отправлен в реестр прав");
            } catch (RightsRegistryException e) {
                System.err.println("[XsdFormBuilderServlet] Failed to register engineering GUID in rights registry: " + e.getMessage());
            }
        }
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
        if (pathInfo != null && pathInfo.equals("/api/ppv/save")) {
            javax.servlet.RequestDispatcher rd = getServletContext().getNamedDispatcher("PpvSaveServlet");
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

            // Сохраняем GUID -> JSON в реестр (in-memory WAR или eec-rights-service)
            try {
                RightsRegistryProvider.get().putRightsJsonBody(jsonBody);
            } catch (IllegalStateException e) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                response.getWriter().print("{\"error\":\"" + e.getMessage().replace("\"", "'") + "\"}");
                return;
            } catch (RightsRegistryException e) {
                response.setStatus(HttpServletResponse.SC_BAD_GATEWAY);
                response.getWriter().print("{\"error\":\"Сервис прав: " + e.getMessage().replace("\"", "'") + "\"}");
                return;
            }
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

        // Если путь содержит 2 сегмента: /{context}/{DPAID|PHAID}/{GUID}
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
                    String uri = request.getRequestURI();
                    boolean phaContext = uri != null && uri.contains("/pha_card/");
                    boolean ppvContext = uri != null && uri.contains("/ppv_card/");
                    String body = phaContext
                            ? "{\"phaid\":" + dpaid + ",\"guid\":\"" + escapeJsonString(guid) + "\"}"
                            : "{\"dpaid\":" + dpaid + ",\"guid\":\"" + escapeJsonString(guid) + "\"}";
                    HttpServletRequest wrapped = new PostBodyRequestWrapper(request, body, true);
                    try {
                        String deleteApi = phaContext ? "/api/pha/delete" : ppvContext ? "/api/ppv/delete" : "/api/dpa/delete";
                        request.getRequestDispatcher(deleteApi).forward(wrapped, response);
                    } catch (Exception e) {
                        System.err.println("[XsdFormBuilderServlet] command=delete forward error: " + e.getMessage());
                        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                        response.setContentType("application/json;charset=UTF-8");
                        response.getWriter().print("{\"success\":false,\"message\":\"" + escapeJsonString(e.getMessage()) + "\"}");
                    }
                    return;
                }
                if ("copy".equals(cmd)) {
                    // Для эквивалентности нажатия кнопки «Сделать копию» copy выполняется на фронтенде:
                    // загрузка карты, проверка can-create-new-version и формирование initialCardData
                    // c переходом на /-/GUID без автосохранения.
                    forwardToSpa(request, response);
                    return;
                }
            }

            // Инженерный GUID "1" — доступ к SPA без запроса к eec-rights-service (сервис может быть остановлен)
            if (guid != null && ENGINEERING_GUID.equals(guid.trim())) {
                System.out.println("[XsdFormBuilderServlet] Engineering GUID — пропуск проверки реестра, DPAID: " + dpaidStr);
                forwardToSpa(request, response);
                return;
            }

            System.out.println("[XsdFormBuilderServlet] Checking GUID in map for DPAID: " + dpaidStr + ", GUID: " + guid);
            System.out.println("[XsdFormBuilderServlet] Current map size: " + RightsRegistryProvider.get().size());

            try {
                if (!RightsRegistryProvider.get().containsGuid(guid)) {
                    System.err.println("[XsdFormBuilderServlet] GUID not found in map: " + guid);
                    System.err.println("[XsdFormBuilderServlet] Available GUIDs in map: " + RightsRegistryProvider.get().guidKeySet());
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("text/html;charset=UTF-8");
                    response.getWriter().print("<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Доступ запрещен</title></head><body><h1>403 - Доступ запрещен</h1><p>GUID не найден или истек срок действия.</p><p>GUID: " + guid + "</p></body></html>");
                    return;
                }
            } catch (RightsRegistryException e) {
                System.err.println("[XsdFormBuilderServlet] eec-rights-service недоступен: " + e.getMessage());
                response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                response.setContentType("text/html;charset=UTF-8");
                response.getWriter().print(
                        "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Сервис прав</title></head><body>"
                        + "<h1>503 — реестр прав (WAR <code>card_rigths</code>) недоступен</h1>"
                        + "<p>Убедитесь, что <code>card_rigths.war</code> в <code>webapps</code> и URL для PHA/… совпадает: "
                        + "<code>eec.rights.service.baseUrl</code> = <code>http://&lt;хост&gt;:&lt;порт-tomcat&gt;/card_rigths</code> (без слеша в конце, порт = HTTP Connector, например 8083).</p>"
                        + "<p>Или задайте <code>EEC_RIGHTS_SERVICE_BASE_URL</code> для Tomcat (в окружении JVM).</p>"
                        + "</body></html>");
                return;
            }

            System.out.println("[XsdFormBuilderServlet] GUID found in map: " + guid + ", returning SPA for DPAID: " + dpaidStr);
            forwardToSpa(request, response);
            return;
        }

        // Если путь содержит 1 сегмент: /{context}/{DPAID|PHAID}
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
        return GuidJsonExtractor.extractGuidFromJson(json);
    }

    /** Экранирование строки для вставки в JSON (кавычки и обратный слэш). */
    private static String escapeJsonString(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
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
