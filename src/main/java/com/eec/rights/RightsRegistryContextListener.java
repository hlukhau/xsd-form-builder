package com.eec.rights;

import javax.servlet.ServletContext;
import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;

/**
 * Подключает {@link CachingHttpRightsRegistry} поверх {@link HttpRightsRegistry} к eec-rights-service:
 * локальный in-memory кэш в WAR, затем HTTP.
 * URL: context-param / system property / {@code EEC_RIGHTS_SERVICE_BASE_URL}; если нигде не задан —
 * {@code http://127.0.0.1:8083/card_rigths} (задать порт = HTTP-коннектор Tomcat).
 */
public class RightsRegistryContextListener implements ServletContextListener {

    public static final String CTX_BASE_URL = "eec.rights.service.baseUrl";
    public static final String CTX_API_KEY = "eec.rights.service.apiKey";
    public static final String SYS_BASE_URL = "eec.rights.service.baseUrl";
    public static final String SYS_API_KEY = "eec.rights.service.apiKey";
    /** WAR eec-rights в том же Tomcat: тот же хост/порт, context /card_rigths */
    public static final String DEFAULT_DEV_BASE_URL = "http://127.0.0.1:8083/card_rigths";

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        ServletContext ctx = sce.getServletContext();
        // env / -D важнее web.xml: так можно переопределить URL в production без пересборки WAR
        String base = firstNonBlank(
                System.getenv("EEC_RIGHTS_SERVICE_BASE_URL"),
                System.getProperty(SYS_BASE_URL),
                ctx.getInitParameter(CTX_BASE_URL)
        );
        String apiKey = firstNonBlank(
                System.getenv("EEC_RIGHTS_SERVICE_API_KEY"),
                System.getProperty(SYS_API_KEY),
                ctx.getInitParameter(CTX_API_KEY)
        );
        if (isBlank(base)) {
            base = DEFAULT_DEV_BASE_URL;
            System.err.println("[RightsRegistry] WARNING: eec.rights.service.baseUrl not set; using " + base
                    + " — for production set context-param, -Deec.rights.service.baseUrl=, or EEC_RIGHTS_SERVICE_BASE_URL");
        }
        String trimmed = base.trim();
        HttpRightsRegistry http = new HttpRightsRegistry(trimmed, isBlank(apiKey) ? null : apiKey.trim());
        RightsRegistryProvider.set(new CachingHttpRightsRegistry(http));
        System.out.println("[RightsRegistry] CachingHttpRightsRegistry -> " + trimmed);
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        // nothing
    }

    private static String firstNonBlank(String... s) {
        if (s == null) {
            return null;
        }
        for (String x : s) {
            if (x != null && !x.trim().isEmpty()) {
                return x.trim();
            }
        }
        return null;
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
