package com.eec.rights;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Если задан app.security.api-key (web.xml) или переменная среды EEC_RIGHTS_API_KEY —
 * для /api/rights* нужен заголовок {@value #HEADER_API_KEY}. /health без ключа.
 */
public class ApiKeyFilter implements Filter {

    public static final String HEADER_API_KEY = "X-Api-Key";

    private String expectedApiKey = "";

    @Override
    public void init(FilterConfig config) {
        if (config != null && config.getServletContext() != null) {
            String p = config.getServletContext().getInitParameter("app.security.api-key");
            if (p != null) {
                expectedApiKey = p;
            }
        }
        if (isBlank(expectedApiKey)) {
            String env = getenv("EEC_RIGHTS_API_KEY");
            if (!isBlank(env)) {
                expectedApiKey = env.trim();
            }
        }
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (!(request instanceof HttpServletRequest) || !(response instanceof HttpServletResponse)) {
            chain.doFilter(request, response);
            return;
        }
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;
        String uri = req.getRequestURI();
        if (uri != null) {
            String cpath = req.getContextPath() != null ? req.getContextPath() : "";
            if ("/health".equals(stripContext(uri, cpath)) || uri.endsWith("/health")) {
                chain.doFilter(request, response);
                return;
            }
        }
        if (isBlank(expectedApiKey)) {
            chain.doFilter(request, response);
            return;
        }
        if (uri == null || !uri.contains("/api/rights")) {
            chain.doFilter(request, response);
            return;
        }
        String key = req.getHeader(HEADER_API_KEY);
        if (key == null || !expectedApiKey.equals(key)) {
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"error\":\"unauthorized\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    @Override
    public void destroy() {
        // no-op
    }

    private static String stripContext(String requestUri, String contextPath) {
        if (contextPath == null || contextPath.isEmpty() || !requestUri.startsWith(contextPath)) {
            return requestUri;
        }
        return requestUri.length() == contextPath.length() ? "" : requestUri.substring(contextPath.length());
    }

    private static String getenv(String name) {
        try {
            return System.getenv(name);
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
