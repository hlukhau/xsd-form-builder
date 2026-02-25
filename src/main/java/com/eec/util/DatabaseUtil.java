package com.eec.util;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

/**
 * Утилита для работы с базой данных Oracle
 */
public class DatabaseUtil {
    
    /** Таймаут подключения к БД (мс). Увеличен для медленной сети; при недоступности Oracle приложение не зависает бесконечно */
    private static final int CONNECT_TIMEOUT_MS = 45_000;
    private static final String DB_URL = "jdbc:oracle:thin:@192.168.203.212:1521/ses?oracle.net.CONNECT_TIMEOUT=" + CONNECT_TIMEOUT_MS;
    private static final String DB_USER = "sesdev";
    private static final String DB_PASSWORD = "sesdev";
    
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
        if (!driverLoaded) {
            throw new SQLException(driverError != null ? driverError : "Oracle JDBC Driver не загружен. Добавьте ojdbc8.jar в WEB-INF/lib/");
        }
        
        Properties props = new Properties();
        props.setProperty("user", DB_USER);
        props.setProperty("password", DB_PASSWORD);
        
        try {
            Connection conn = DriverManager.getConnection(DB_URL, props);
            System.out.println("[DatabaseUtil] Connection established to: " + DB_URL);
            return conn;
        } catch (SQLException e) {
            System.err.println("[DatabaseUtil] ERROR connecting to database: " + e.getMessage());
            throw e;
        }
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
}



