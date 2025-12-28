package com.eec.servlet;

import com.eec.util.DatabaseUtil;
import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.CountryOption;
import com.eec.util.DictionaryCache.IncidentAlertKindOption;
import com.eec.util.DictionaryCache.AuthorityOption;
import com.eec.util.DictionaryCache.SanitaryProdTypeOption;
import com.eec.util.DictionaryCache.MeasurementUnitOption;
import com.eec.util.DictionaryCache.ShipDocKindOption;
import com.eec.util.DictionaryCache.SupplyChainPartyKindOption;
import com.eec.util.DictionaryCache.TechRegulOption;
import com.eec.util.DictionaryCache.SanitaryMeasureObjKindOption;
import com.eec.util.DictionaryCache.SanitaryMeasureOption;

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
        loadSanitaryProdTypesDictionary();
        loadMeasurementUnitsDictionary();
        loadShipDocKindsDictionary();
        loadSupplyChainPartyKindsDictionary();
        loadTechRegulsDictionary();
        loadSanitaryMeasureObjKindsDictionary();
        loadSanitaryMeasuresDictionary();
        
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
        DictionaryCache.clearSanitaryProdTypesCache();
        DictionaryCache.clearMeasurementUnitsCache();
        DictionaryCache.clearShipDocKindsCache();
        DictionaryCache.clearSupplyChainPartyKindsCache();
        DictionaryCache.clearTechRegulsCache();
        DictionaryCache.clearSanitaryMeasureObjKindsCache();
        DictionaryCache.clearSanitaryMeasuresCache();
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
    
    /**
     * Загружает справочник типов санитарной продукции из базы данных в кеш
     */
    private void loadSanitaryProdTypesDictionary() {
        Connection conn = null;
        try {
            System.out.println("[DictionaryInitializer] Loading sanitary product types dictionary...");
            conn = DatabaseUtil.getConnection();
            
            // Загружаем только активные записи (где SANITARYPRODTYPEEDATE IS NULL или в будущем)
            String sql = "SELECT SANITARYPRODTYPECODE, SANITARYPRODTYPENAME " +
                        "FROM SESINT.SANITARYPRODTYPE " +
                        "WHERE SANITARYPRODTYPEEDATE IS NULL OR SANITARYPRODTYPEEDATE >= SYSDATE " +
                        "ORDER BY SANITARYPRODTYPECODE";
            
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            
            List<SanitaryProdTypeOption> types = new ArrayList<>();
            int count = 0;
            
            while (rs.next()) {
                String code = rs.getString("SANITARYPRODTYPECODE");
                String name = rs.getString("SANITARYPRODTYPENAME");
                
                types.add(new SanitaryProdTypeOption(
                    code != null ? code : "",
                    name != null ? name : ""
                ));
                count++;
            }
            
            DictionaryCache.setSanitaryProdTypesCache(types);
            System.out.println("[DictionaryInitializer] Loaded " + count + " sanitary product types into cache");
            
            rs.close();
            stmt.close();
            
        } catch (SQLException e) {
            System.err.println("[DictionaryInitializer] ERROR loading sanitary product types dictionary: " + e.getMessage());
            e.printStackTrace();
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }
    
    /**
     * Загружает справочник единиц измерения из базы данных в кеш
     */
    private void loadMeasurementUnitsDictionary() {
        Connection conn = null;
        try {
            System.out.println("[DictionaryInitializer] Loading measurement units dictionary...");
            conn = DatabaseUtil.getConnection();
            
            // Загружаем только активные записи (где MEASUREMENTUNITEDATE >= SYSDATE)
            String sql = "SELECT MEASUREMENTUNITCODE, MEASUREMENTUNITNAME, MEASUREMENTUNITBRIEFNAME " +
                        "FROM SESINT.MEASUREMENTUNIT " +
                        "WHERE MEASUREMENTUNITEDATE >= SYSDATE " +
                        "ORDER BY NVL(SEQNUM, 999999), MEASUREMENTUNITCODE";
            
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            
            List<MeasurementUnitOption> units = new ArrayList<>();
            int count = 0;
            
            while (rs.next()) {
                String code = rs.getString("MEASUREMENTUNITCODE");
                String name = rs.getString("MEASUREMENTUNITNAME");
                String briefName = rs.getString("MEASUREMENTUNITBRIEFNAME");
                
                units.add(new MeasurementUnitOption(
                    code != null ? code : "",
                    name != null ? name : "",
                    briefName != null ? briefName : ""
                ));
                count++;
            }
            
            DictionaryCache.setMeasurementUnitsCache(units);
            System.out.println("[DictionaryInitializer] Loaded " + count + " measurement units into cache");
            
            rs.close();
            stmt.close();
            
        } catch (SQLException e) {
            System.err.println("[DictionaryInitializer] ERROR loading measurement units dictionary: " + e.getMessage());
            e.printStackTrace();
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }
    
    /**
     * Загружает справочник видов товаросопроводительных документов из базы данных в кеш
     */
    private void loadShipDocKindsDictionary() {
        Connection conn = null;
        try {
            System.out.println("[DictionaryInitializer] Loading ship document kinds dictionary...");
            conn = DatabaseUtil.getConnection();
            
            // Загружаем только активные записи (где SHIPDOCKINDEDATE >= SYSDATE)
            String sql = "SELECT SHIPDOCKINDCODE, SHIPDOCKINDNAME " +
                        "FROM SESINT.SHIPDOCKIND " +
                        "WHERE SHIPDOCKINDEDATE >= SYSDATE " +
                        "ORDER BY NVL(SEQNUM, 999999), SHIPDOCKINDCODE";
            
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            
            List<ShipDocKindOption> kinds = new ArrayList<>();
            int count = 0;
            
            while (rs.next()) {
                String code = rs.getString("SHIPDOCKINDCODE");
                String name = rs.getString("SHIPDOCKINDNAME");
                
                kinds.add(new ShipDocKindOption(
                    code != null ? code : "",
                    name != null ? name : ""
                ));
                count++;
            }
            
            DictionaryCache.setShipDocKindsCache(kinds);
            System.out.println("[DictionaryInitializer] Loaded " + count + " ship document kinds into cache");
            
            rs.close();
            stmt.close();
            
        } catch (SQLException e) {
            System.err.println("[DictionaryInitializer] ERROR loading ship document kinds dictionary: " + e.getMessage());
            e.printStackTrace();
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }
    
    /**
     * Загружает справочник видов участников цепи поставки из базы данных в кеш
     */
    private void loadSupplyChainPartyKindsDictionary() {
        Connection conn = null;
        try {
            System.out.println("[DictionaryInitializer] Loading supply chain party kinds dictionary...");
            conn = DatabaseUtil.getConnection();
            
            // Загружаем только активные записи (где SUPPLYCHAINPARTYKINDACTFL = 1)
            String sql = "SELECT SUPPLYCHAINPARTYKINDCODE, SUPPLYCHAINPARTYKINDNAME " +
                        "FROM SESINT.SUPPLYCHAINPARTYKIND " +
                        "WHERE SUPPLYCHAINPARTYKINDACTFL = 1 " +
                        "ORDER BY NVL(SUPPLYCHAINPARTYKINDSEQNUM, 999999), SUPPLYCHAINPARTYKINDCODE";
            
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            
            List<SupplyChainPartyKindOption> kinds = new ArrayList<>();
            int count = 0;
            
            while (rs.next()) {
                String code = rs.getString("SUPPLYCHAINPARTYKINDCODE");
                String name = rs.getString("SUPPLYCHAINPARTYKINDNAME");
                
                kinds.add(new SupplyChainPartyKindOption(
                    code != null ? code : "",
                    name != null ? name : ""
                ));
                count++;
            }
            
            DictionaryCache.setSupplyChainPartyKindsCache(kinds);
            System.out.println("[DictionaryInitializer] Loaded " + count + " supply chain party kinds into cache");
            
            rs.close();
            stmt.close();
            
        } catch (SQLException e) {
            System.err.println("[DictionaryInitializer] ERROR loading supply chain party kinds dictionary: " + e.getMessage());
            e.printStackTrace();
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }
    
    /**
     * Загружает справочник технических регламентов из базы данных в кеш
     */
    private void loadTechRegulsDictionary() {
        Connection conn = null;
        try {
            System.out.println("[DictionaryInitializer] Loading technical regulations dictionary...");
            conn = DatabaseUtil.getConnection();
            
            // Загружаем только активные записи (где TECHREGULEDATE либо NULL, либо больше текущей даты)
            String sql = "SELECT TECHREGULCODE, TECHREGULNAME, TECHREGULREGNUM " +
                        "FROM SESINT.TECHREGUL " +
                        "WHERE TECHREGULSDATE <= SYSDATE " +
                        "AND (TECHREGULEDATE IS NULL OR TECHREGULEDATE >= SYSDATE) " +
                        "ORDER BY TECHREGULCODE";
            
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            
            List<TechRegulOption> reguls = new ArrayList<>();
            int count = 0;
            
            while (rs.next()) {
                String code = rs.getString("TECHREGULCODE");
                String name = rs.getString("TECHREGULNAME");
                String regNum = rs.getString("TECHREGULREGNUM");
                
                reguls.add(new TechRegulOption(
                    code != null ? code : "",
                    name != null ? name : "",
                    regNum != null ? regNum : ""
                ));
                count++;
            }
            
            DictionaryCache.setTechRegulsCache(reguls);
            System.out.println("[DictionaryInitializer] Loaded " + count + " technical regulations into cache");
            
            rs.close();
            stmt.close();
            
        } catch (SQLException e) {
            System.err.println("[DictionaryInitializer] ERROR loading technical regulations dictionary: " + e.getMessage());
            e.printStackTrace();
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }
    
    /**
     * Загружает справочник видов объектов действия мер из базы данных в кеш
     */
    private void loadSanitaryMeasureObjKindsDictionary() {
        Connection conn = null;
        try {
            System.out.println("[DictionaryInitializer] Loading sanitary measure object kinds dictionary...");
            conn = DatabaseUtil.getConnection();
            
            // Загружаем только активные записи (где SANITARYMEASUREOBJKINDACTFL = 1)
            String sql = "SELECT SANITARYMEASUREOBJKINDCODE, SANITARYMEASUREOBJKINDNAME " +
                        "FROM SESINT.SANITARYMEASUREOBJKIND " +
                        "WHERE SANITARYMEASUREOBJKINDACTFL = 1 " +
                        "ORDER BY NVL(SANITARYMEASUREOBJKINDSEQNUM, 999999), SANITARYMEASUREOBJKINDNAME";
            
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            
            List<SanitaryMeasureObjKindOption> kinds = new ArrayList<>();
            int count = 0;
            
            while (rs.next()) {
                String code = rs.getString("SANITARYMEASUREOBJKINDCODE");
                String name = rs.getString("SANITARYMEASUREOBJKINDNAME");
                
                kinds.add(new SanitaryMeasureObjKindOption(
                    code != null ? code : "",
                    name != null ? name : ""
                ));
                count++;
            }
            
            DictionaryCache.setSanitaryMeasureObjKindsCache(kinds);
            System.out.println("[DictionaryInitializer] Loaded " + count + " sanitary measure object kinds into cache");
            
            rs.close();
            stmt.close();
            
        } catch (SQLException e) {
            System.err.println("[DictionaryInitializer] ERROR loading sanitary measure object kinds dictionary: " + e.getMessage());
            e.printStackTrace();
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }
    
    /**
     * Загружает справочник санитарных мер из базы данных в кеш
     */
    private void loadSanitaryMeasuresDictionary() {
        Connection conn = null;
        try {
            System.out.println("[DictionaryInitializer] Loading sanitary measures dictionary...");
            conn = DatabaseUtil.getConnection();
            
            // Загружаем только активные записи (где SANITARYMEASURESDATE <= SYSDATE и (SANITARYMEASUREEDATE IS NULL или SANITARYMEASUREEDATE >= SYSDATE))
            String sql = "SELECT SANITARYMEASURECODE, SANITARYMEASURENAME " +
                        "FROM SESINT.SANITARYMEASURE " +
                        "WHERE SANITARYMEASURESDATE <= SYSDATE " +
                        "AND (SANITARYMEASUREEDATE IS NULL OR SANITARYMEASUREEDATE >= SYSDATE) " +
                        "ORDER BY SANITARYMEASURECODE";
            
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            
            List<SanitaryMeasureOption> measures = new ArrayList<>();
            int count = 0;
            
            while (rs.next()) {
                String code = rs.getString("SANITARYMEASURECODE");
                String name = rs.getString("SANITARYMEASURENAME");
                
                measures.add(new SanitaryMeasureOption(
                    code != null ? code : "",
                    name != null ? name : ""
                ));
                count++;
            }
            
            DictionaryCache.setSanitaryMeasuresCache(measures);
            System.out.println("[DictionaryInitializer] Loaded " + count + " sanitary measures into cache");
            
            rs.close();
            stmt.close();
            
        } catch (SQLException e) {
            System.err.println("[DictionaryInitializer] ERROR loading sanitary measures dictionary: " + e.getMessage());
            e.printStackTrace();
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }
}



