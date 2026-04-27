package com.eec.rights;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/**
 * POST /api/rights — body = JSON с полем guid (как WAR)
 * GET /api/rights/{guid} — 200 + JSON, 404 если нет
 * GET /api/rights — { "count": n }
 */
public class RightsApiServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        RightsMemoryStore store = RightsMemoryStore.getInstance();
        String pathInfo = request.getPathInfo();
        if (pathInfo == null) {
            pathInfo = "";
        }
        pathInfo = pathInfo.trim();
        if (pathInfo.isEmpty() || "/".equals(pathInfo)) {
            int n = store.size();
            String body = "{\"count\":" + n + "}";
            response.setStatus(HttpServletResponse.SC_OK);
            response.setContentType("application/json;charset=UTF-8");
            response.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
            return;
        }
        if (pathInfo.startsWith("/")) {
            pathInfo = pathInfo.substring(1);
        }
        if (pathInfo.isEmpty()) {
            int n = store.size();
            response.getOutputStream().write(("{\"count\":" + n + "}").getBytes(StandardCharsets.UTF_8));
            return;
        }
        String rawGuid;
        int slash = pathInfo.indexOf('/');
        rawGuid = slash < 0 ? pathInfo : pathInfo.substring(0, slash);
        String guid;
        try {
            guid = URLDecoder.decode(rawGuid, "UTF-8");
        } catch (Exception e) {
            guid = rawGuid;
        }
        if (guid == null || guid.trim().isEmpty()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json;charset=UTF-8");
            response.getOutputStream().write("{\"error\":\"empty guid\"}".getBytes(StandardCharsets.UTF_8));
            return;
        }
        String json = store.get(guid);
        if (json == null) {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            response.setContentType("application/json;charset=UTF-8");
            response.getOutputStream().write("{\"error\":\"not found\"}".getBytes(StandardCharsets.UTF_8));
            return;
        }
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType("application/json;charset=UTF-8");
        response.getOutputStream().write(json.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        if (!"POST".equals(request.getMethod())) {
            return;
        }
        String pathInfo = request.getPathInfo();
        if (pathInfo != null && !pathInfo.trim().isEmpty() && !"/".equals(pathInfo.trim())) {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        String jsonBody = readRequestBody(request);
        if (jsonBody == null || jsonBody.trim().isEmpty()) {
            writeJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "Request body is empty");
            return;
        }
        String guid = GuidJsonExtractor.extractGuidFromJson(jsonBody);
        if (guid == null || guid.isEmpty()) {
            writeJsonError(response, HttpServletResponse.SC_BAD_REQUEST, "GUID not found in JSON body");
            return;
        }
        try {
            RightsMemoryStore.getInstance().put(guid, jsonBody);
        } catch (IllegalArgumentException e) {
            writeJsonError(response, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
            return;
        }
        String esc = jsonEscape(guid);
        String out = "{\"success\":true,\"guid\":\"" + esc + "\"}";
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType("application/json;charset=UTF-8");
        response.getOutputStream().write(out.getBytes(StandardCharsets.UTF_8));
    }

    private static void writeJsonError(HttpServletResponse response, int code, String message) throws IOException {
        response.setStatus(code);
        response.setContentType("application/json;charset=UTF-8");
        String body = "{\"error\":\"" + jsonEscape(message) + "\"}";
        response.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
    }

    private static String jsonEscape(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static String readRequestBody(HttpServletRequest request) throws IOException {
        int len = request.getContentLength();
        InputStream in = request.getInputStream();
        if (len > 0) {
            byte[] buf = new byte[len];
            int off = 0;
            while (off < len) {
                int r = in.read(buf, off, len - off);
                if (r < 0) {
                    break;
                }
                off += r;
            }
            return new String(buf, 0, off, StandardCharsets.UTF_8);
        }
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] t = new byte[8192];
        int n;
        while ((n = in.read(t)) >= 0) {
            b.write(t, 0, n);
        }
        return b.toString("UTF-8");
    }
}
