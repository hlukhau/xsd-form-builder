package com.eec.util;

import com.eec.rights.RightsRegistryException;
import com.eec.rights.RightsRegistryProvider;

import javax.servlet.http.HttpServletRequest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Утилита для работы с базой данных Oracle
 */
public class DatabaseUtil {
    
    /** Таймаут подключения к БД (мс). Увеличен для медленной сети; при недоступности Oracle приложение не зависает бесконечно */
    private static final int CONNECT_TIMEOUT_MS = 45_000;
    
    private static boolean driverLoaded = false;
    private static String driverError = null;
    
    static {
        try {
            // Регистрация драйвера Oracle
            Class.forName("oracle.jdbc.OracleDriver");
            driverLoaded = true;
            System.out.println("[DatabaseUtil] Oracle JDBC Driver loaded successfully");
        } catch (ClassNotFoundException e) {
            driverError = "Oracle JDBC Driver не найден: " + e.getMessage();
            System.err.println("[DatabaseUtil] ERROR: " + driverError);
            System.err.println("[DatabaseUtil] Please add ojdbc8.jar to WEB-INF/lib/");
            // Не выбрасываем исключение, чтобы приложение могло запуститься
            // Ошибка будет при попытке подключения
        }
    }
    
    /**
     * Получить соединение с базой данных
     */
    public static Connection getConnection() throws SQLException {
        throw new SQLException("Подключение по умолчанию отключено. Передайте guid и dbConnectString/dbUsername/dbPassword в JSON прав.");
    }

    /**
     * Получить соединение с БД по GUID из JSON прав.
     */
    public static Connection getConnectionForRequest(HttpServletRequest request) throws SQLException {
        return getConnectionForRequest(request, null);
    }

    /**
     * Получить соединение с БД по GUID из JSON прав.
     * explicitGuid имеет приоритет над параметром/заголовком запроса.
     */
    public static Connection getConnectionForRequest(HttpServletRequest request, String explicitGuid) throws SQLException {
        String guid = normalizeGuid(explicitGuid);
        if (guid == null && request != null) {
            Object attrGuid = request.getAttribute("guid");
            if (attrGuid != null) guid = normalizeGuid(String.valueOf(attrGuid));
            if (guid == null) guid = normalizeGuid(request.getParameter("guid"));
            if (guid == null) guid = normalizeGuid(request.getHeader("X-Guid"));
            if (guid == null) guid = normalizeGuid(request.getHeader("X-GUID"));
        }
        if (guid != null) {
            return getConnectionForGuid(guid);
        }
        throw new SQLException("GUID не задан. Подключение к БД возможно только по db-кредам из JSON прав.");
    }

    /**
     * Получить соединение с БД по dbConnectString/dbUsername/dbPassword из JSON прав.
     */
    public static Connection getConnectionForGuid(String guid) throws SQLException {
        if (!driverLoaded) {
            throw new SQLException(driverError != null ? driverError : "Oracle JDBC Driver не загружен. Добавьте ojdbc8.jar в WEB-INF/lib/");
        }

        String normalizedGuid = normalizeGuid(guid);
        if (normalizedGuid == null) {
            throw new SQLException("GUID не задан. Подключение к БД возможно только по db-кредам из JSON прав.");
        }

        String rightsJson;
        try {
            rightsJson = RightsRegistryProvider.get().getRightsJson(normalizedGuid);
        } catch (RightsRegistryException e) {
            throw new SQLException("Сервис прав: " + e.getMessage(), e);
        }
        if (rightsJson == null || rightsJson.trim().isEmpty()) {
            throw new SQLException("Права по GUID не найдены: " + normalizedGuid);
        }

        String dbUrl = extractJsonString(rightsJson, "dbConnectString");
        String dbUser = extractJsonString(rightsJson, "dbUsername");
        String dbPassword = extractJsonString(rightsJson, "dbPassword");
        if (isBlank(dbUrl) || isBlank(dbUser) || dbPassword == null) {
            throw new SQLException("В JSON прав отсутствуют параметры подключения к БД для GUID " + normalizedGuid);
        }

        return getConnection(ensureConnectTimeout(dbUrl.trim()), dbUser.trim(), dbPassword, "guid=" + normalizedGuid);
    }

    private static Connection getConnection(String dbUrl, String dbUser, String dbPassword, String source) throws SQLException {
        if (!driverLoaded) {
            throw new SQLException(driverError != null ? driverError : "Oracle JDBC Driver не загружен. Добавьте ojdbc8.jar в WEB-INF/lib/");
        }

        Properties props = new Properties();
        props.setProperty("user", dbUser);
        props.setProperty("password", dbPassword);

        try {
            Connection conn = DriverManager.getConnection(dbUrl, props);
            System.out.println("[DatabaseUtil] Connection established (" + source + ") to: " + dbUrl);
            return conn;
        } catch (SQLException e) {
            System.err.println("[DatabaseUtil] ERROR connecting to database (" + source + "): " + e.getMessage());
            throw e;
        }
    }

    private static String ensureConnectTimeout(String dbUrl) {
        if (dbUrl == null || dbUrl.isEmpty()) return dbUrl;
        if (dbUrl.toLowerCase().contains("oracle.net.connect_timeout=")) return dbUrl;
        return dbUrl + (dbUrl.contains("?") ? "&" : "?") + "oracle.net.CONNECT_TIMEOUT=" + CONNECT_TIMEOUT_MS;
    }

    private static String extractJsonString(String json, String key) {
        if (json == null || key == null) return null;
        Pattern pattern = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"((?:\\\\.|[^\\\\\"])*)\"");
        Matcher matcher = pattern.matcher(json);
        if (!matcher.find()) return null;
        return matcher.group(1)
                .replace("\\\"", "\"")
                .replace("\\\\", "\\")
                .replace("\\n", "\n")
                .replace("\\r", "\r")
                .replace("\\t", "\t");
    }

    private static String normalizeGuid(String guid) {
        if (guid == null) return null;
        String trimmed = guid.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
    
    /**
     * Закрыть соединение
     */
    public static void closeConnection(Connection conn) {
        if (conn != null) {
            try {
                conn.close();
            } catch (SQLException e) {
                // Игнорируем ошибки при закрытии
            }
        }
    }

    /**
     * Откат незакоммиченной транзакции (при {@code setAutoCommit(false)}).
     * Безопасно вызывать после успешного {@link Connection#commit()}: откатывается пустая транзакция.
     */
    public static void rollbackQuietly(Connection conn) {
        if (conn == null) {
            return;
        }
        try {
            if (!conn.isClosed() && !conn.getAutoCommit()) {
                conn.rollback();
            }
        } catch (SQLException ignored) {
        }
    }
}



