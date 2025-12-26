package com.eec.servlet;

import com.eec.util.DatabaseUtil;
import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.CountryOption;
import com.eec.util.DictionaryCache.IncidentAlertKindOption;
import com.eec.util.DictionaryCache.AuthorityOption;

import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/**
 * Listener для инициализации справочников при старте приложения
 * Загружает справочники в кеш при старте
 * Регистрируется в web.xml
 */
public class DictionaryInitializerListener implements ServletContextListener {
    
    @Override
    public void contextInitialized(ServletContextEvent sce) {
        System.out.println("========================================");
        System.out.println("[DictionaryInitializer] Starting dictionary loading...");
        System.out.println("========================================");
        
        loadCountriesDictionary();
        loadIncidentAlertKindsDictionary();
        loadAuthoritiesDictionary();
        
        System.out.println("========================================");
        System.out.println("[DictionaryInitializer] Dictionary loading completed");
        System.out.println("========================================");
    }
    
    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        System.out.println("[DictionaryInitializer] Application context destroyed");
        // Очищаем кеш при остановке
        DictionaryCache.clearCountriesCache();
        DictionaryCache.clearIncidentAlertKindsCache();
        DictionaryCache.clearAuthoritiesCache();
    }
    
    /**
     * Загружает справочник стран из базы данных в кеш
     */
    private void loadCountriesDictionary() {
        Connection conn = null;
        
        try {
            System.out.println("[DictionaryInitializer] Loading countries dictionary...");
            conn = DatabaseUtil.getConnection();
            System.out.println("[DictionaryInitializer] Database connection established");
            
            String sql = "SELECT COUNTRYCODE, COUNTRYNAME " +
                        "FROM SESINT.COUNTRY " +
                        "WHERE COUNTRYSDATE <= SYSDATE AND COUNTRYEDATE >= SYSDATE " +
                        "ORDER BY SEQNUM, COUNTRYNAME";
            
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            
            List<CountryOption> countries = new ArrayList<>();
            int count = 0;
            
            while (rs.next()) {
                String code = rs.getString("COUNTRYCODE");
                String name = rs.getString("COUNTRYNAME");
                countries.add(new CountryOption(code, name));
                count++;
            }
            
            DictionaryCache.setCountriesCache(countries);
            System.out.println("[DictionaryInitializer] Loaded " + count + " countries into cache");
            
            rs.close();
            stmt.close();
            
        } catch (SQLException e) {
            System.err.println("[DictionaryInitializer] ERROR loading countries dictionary: " + e.getMessage());
            e.printStackTrace();
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }
    
    /**
     * Загружает справочник видов уведомлений из базы данных в кеш
     */
    private void loadIncidentAlertKindsDictionary() {
        Connection conn = null;
        
        try {
            System.out.println("[DictionaryInitializer] Loading incident alert kinds dictionary...");
            conn = DatabaseUtil.getConnection();
            
            String sql = "SELECT INCIDENTALERTKINDCODE, INCIDENTALERTKINDNAME " +
                        "FROM SESINT.INCIDENTALERTKIND " +
                        "WHERE INCIDENTALERTKINDACTFL = 1 " +
                        "ORDER BY NVL(INCIDENTALERTKINDSEQNUM, 999999), INCIDENTALERTKINDNAME";
            
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            
            List<IncidentAlertKindOption> kinds = new ArrayList<>();
            int count = 0;
            
            while (rs.next()) {
                String code = rs.getString("INCIDENTALERTKINDCODE");
                String name = rs.getString("INCIDENTALERTKINDNAME");
                kinds.add(new IncidentAlertKindOption(code, name));
                count++;
            }
            
            DictionaryCache.setIncidentAlertKindsCache(kinds);
            System.out.println("[DictionaryInitializer] Loaded " + count + " incident alert kinds into cache");
            
            rs.close();
            stmt.close();
            
        } catch (SQLException e) {
            System.err.println("[DictionaryInitializer] ERROR loading incident alert kinds dictionary: " + e.getMessage());
            e.printStackTrace();
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }
    
    /**
     * Загружает справочник уполномоченных органов из базы данных в кеш
     */
    private void loadAuthoritiesDictionary() {
        Connection conn = null;
        
        try {
            System.out.println("[DictionaryInitializer] Loading authorities dictionary...");
            conn = DatabaseUtil.getConnection();
            
            String sql = "SELECT AUTHORITYUID, AUTHORITYNAME, AUTHORITYBRIEFNAME, COUNTRYCODE " +
                        "FROM SESINT.AUTHORITY " +
                        "ORDER BY COUNTRYCODE, AUTHORITYNAME";
            
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            
            List<AuthorityOption> authorities = new ArrayList<>();
            int count = 0;
            
            while (rs.next()) {
                String uid = rs.getString("AUTHORITYUID");
                String name = rs.getString("AUTHORITYNAME");
                String briefName = rs.getString("AUTHORITYBRIEFNAME");
                String countryCode = rs.getString("COUNTRYCODE");
                
                authorities.add(new AuthorityOption(
                    uid != null ? uid : "",
                    name != null ? name : "",
                    briefName != null ? briefName : "",
                    countryCode != null ? countryCode : ""
                ));
                count++;
            }
            
            DictionaryCache.loadAllAuthoritiesCache(authorities);
            System.out.println("[DictionaryInitializer] Loaded " + count + " authorities into cache");
            
            rs.close();
            stmt.close();
            
        } catch (SQLException e) {
            System.err.println("[DictionaryInitializer] ERROR loading authorities dictionary: " + e.getMessage());
            e.printStackTrace();
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }
}



