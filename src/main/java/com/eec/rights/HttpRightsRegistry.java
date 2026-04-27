package com.eec.rights;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Клиент eec-rights-service (in-memory в отдельном JVM-процессе).
 */
public final class HttpRightsRegistry implements RightsRegistry {

    public static final String HEADER_API_KEY = "X-Api-Key";
    private static final int CONNECT_TIMEOUT_MS = 15_000;
    private static final int READ_TIMEOUT_MS = 45_000;
    private static final Pattern COUNT_PATTERN = Pattern.compile("\\\"count\\\"\\s*:\\s*(\\d+)");

    private final String baseUrl;
    private final String apiKey;

    public HttpRightsRegistry(String baseUrl, String apiKey) {
        if (baseUrl == null || baseUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("baseUrl is empty");
        }
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.apiKey = (apiKey == null || apiKey.trim().isEmpty()) ? null : apiKey.trim();
    }

    @Override
    public String getRightsJson(String guid) {
        if (guid == null) {
            return null;
        }
        String path = baseUrl + "/api/rights/" + urlPathEncode(guid.trim());
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(path).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            if (apiKey != null) {
                conn.setRequestProperty(HEADER_API_KEY, apiKey);
            }
            int code = conn.getResponseCode();
            if (code == 404) {
                return null;
            }
            if (code < 200 || code >= 300) {
                throw new RightsRegistryException("GET /api/rights/{guid} HTTP " + code);
            }
            return readString(conn.getInputStream());
        } catch (IOException e) {
            throw new RightsRegistryException("Сервис прав недоступен: " + e.getMessage(), e);
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    @Override
    public void putRightsJson(String guid, String jsonBody) {
        if (guid == null || jsonBody == null) {
            return;
        }
        doPostJson(jsonBody);
    }

    @Override
    public void putRightsJsonBody(String jsonBody) {
        doPostJson(jsonBody);
    }

    @Override
    public boolean containsGuid(String guid) {
        return getRightsJson(guid) != null;
    }

    @Override
    public int size() {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(baseUrl + "/api/rights").openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            if (apiKey != null) {
                conn.setRequestProperty(HEADER_API_KEY, apiKey);
            }
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                return 0;
            }
            String body = readString(conn.getInputStream());
            Matcher m = COUNT_PATTERN.matcher(body);
            if (m.find()) {
                return Integer.parseInt(m.group(1));
            }
        } catch (Exception e) {
            System.err.println("[HttpRightsRegistry] size: " + e.getMessage());
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
        return 0;
    }

    @Override
    public Set<String> guidKeySet() {
        return Collections.emptySet();
    }

    private void doPostJson(String jsonBody) {
        HttpURLConnection conn = null;
        try {
            byte[] data = jsonBody.getBytes(StandardCharsets.UTF_8);
            conn = (HttpURLConnection) new URL(baseUrl + "/api/rights").openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            if (apiKey != null) {
                conn.setRequestProperty(HEADER_API_KEY, apiKey);
            }
            OutputStream os = conn.getOutputStream();
            os.write(data);
            os.close();
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                String err = readStringSafe(conn.getErrorStream());
                throw new RightsRegistryException("POST /api/rights HTTP " + code + (err != null ? ": " + err : ""));
            }
        } catch (IOException e) {
            throw new RightsRegistryException("Сервис прав: " + e.getMessage(), e);
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private static String readString(InputStream in) throws IOException {
        if (in == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) {
                if (sb.length() > 0) {
                    sb.append('\n');
                }
                sb.append(line);
            }
        }
        return sb.toString();
    }

    private static String readStringSafe(InputStream in) {
        if (in == null) {
            return null;
        }
        try {
            return readString(in);
        } catch (IOException e) {
            return e.getMessage();
        }
    }

    private static String urlPathEncode(String s) {
        try {
            return java.net.URLEncoder.encode(s, "UTF-8").replace("+", "%20");
        } catch (java.io.UnsupportedEncodingException e) {
            return s;
        }
    }
}
