package com.eec.servlet;

import com.eec.util.DatabaseUtil;

import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Listener для инициализации справочников при старте приложения
 * Регистрируется в web.xml
 */
public class DictionaryInitializerListener implements ServletContextListener {
    
    @Override
    public void contextInitialized(ServletContextEvent sce) {
        System.out.println("========================================");
        System.out.println("[DictionaryInitializer] Starting dictionary loading...");
        System.out.println("========================================");
        
        loadCountriesDictionary();
        
        System.out.println("========================================");
        System.out.println("[DictionaryInitializer] Dictionary loading completed");
        System.out.println("========================================");
    }
    
    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        System.out.println("[DictionaryInitializer] Application context destroyed");
    }
    
    /**
     * Загружает справочник стран из базы данных
     */
    private void loadCountriesDictionary() {
        Connection conn = null;
        
        try {
            System.out.println("[DictionaryInitializer] Connecting to database...");
            conn = DatabaseUtil.getConnection();
            System.out.println("[DictionaryInitializer] Database connection established");
            
            String sql = "SELECT COUNT(*) as CNT " +
                        "FROM SESINT.COUNTRY " +
                        "WHERE COUNTRYSDATE <= SYSDATE AND COUNTRYEDATE >= SYSDATE";
            
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            
            if (rs.next()) {
                int count = rs.getInt("CNT");
                System.out.println("[DictionaryInitializer] Found " + count + " active countries in database");
                
                if (count > 0) {
                    // Загружаем несколько примеров для проверки
                    String sampleSql = "SELECT COUNTRYCODE, COUNTRYNAME " +
                                     "FROM SESINT.COUNTRY " +
                                     "WHERE COUNTRYSDATE <= SYSDATE AND COUNTRYEDATE >= SYSDATE " +
                                     "ORDER BY SEQNUM, COUNTRYNAME " +
                                     "FETCH FIRST 5 ROWS ONLY";
                    
                    PreparedStatement sampleStmt = conn.prepareStatement(sampleSql);
                    ResultSet sampleRs = sampleStmt.executeQuery();
                    
                    System.out.println("[DictionaryInitializer] Sample countries:");
                    while (sampleRs.next()) {
                        String code = sampleRs.getString("COUNTRYCODE");
                        String name = sampleRs.getString("COUNTRYNAME");
                        System.out.println("  - " + code + ": " + name);
                    }
                    
                    sampleRs.close();
                    sampleStmt.close();
                }
            }
            
            rs.close();
            stmt.close();
            
            System.out.println("[DictionaryInitializer] Countries dictionary loaded successfully");
            
        } catch (SQLException e) {
            System.err.println("[DictionaryInitializer] ERROR loading countries dictionary: " + e.getMessage());
            e.printStackTrace();
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }
}


