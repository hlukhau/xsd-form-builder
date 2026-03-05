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
import com.eec.util.DictionaryCache.MediaTypeOption;
import com.eec.util.DictionaryCache.DepOption;
import com.eec.util.DictionaryCache.LegalFormOption;
import com.eec.util.DictionaryCache.IdentificationMethodOption;
import com.eec.util.DictionaryCache.ConformityDocKindOption;
import com.eec.util.DictionaryCache.IdentityDocKindOption;

import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.function.BooleanSupplier;

/**
 * Listener для инициализации справочников при старте приложения
 * Загружает справочники в кеш при старте
 * Регистрируется в web.xml
 */
public class DictionaryInitializerListener implements ServletContextListener {
    
    @Override
    public void contextInitialized(ServletContextEvent sce) {
        System.out.println("========================================");
        System.out.println("[DictionaryInitializer] Starting dictionary loading in background (Tomcat will respond immediately)");
        System.out.println("========================================");
        // Загрузка в фоне, чтобы не блокировать развёртывание контекста и не «подвешивать» Tomcat при недоступности БД
        Thread loader = new Thread(() -> {
            try {
                loadWithRetries("countries", this::loadCountriesDictionary, DictionaryCache::isCountriesLoaded);
                loadWithRetries("incident alert kinds", this::loadIncidentAlertKindsDictionary, DictionaryCache::isIncidentAlertKindsLoaded);
                loadWithRetries("authorities", this::loadAuthoritiesDictionary, DictionaryCache::isAuthoritiesLoaded);
                loadWithRetries("sanitary product types", this::loadSanitaryProdTypesDictionary, DictionaryCache::isSanitaryProdTypesLoaded);
                loadWithRetries("measurement units", this::loadMeasurementUnitsDictionary, DictionaryCache::isMeasurementUnitsLoaded);
                loadWithRetries("ship document kinds", this::loadShipDocKindsDictionary, DictionaryCache::isShipDocKindsLoaded);
                loadWithRetries("supply chain party kinds", this::loadSupplyChainPartyKindsDictionary, DictionaryCache::isSupplyChainPartyKindsLoaded);
                loadWithRetries("technical regulations", this::loadTechRegulsDictionary, DictionaryCache::isTechRegulsLoaded);
                loadWithRetries("sanitary measure object kinds", this::loadSanitaryMeasureObjKindsDictionary, DictionaryCache::isSanitaryMeasureObjKindsLoaded);
                loadWithRetries("sanitary measures", this::loadSanitaryMeasuresDictionary, DictionaryCache::isSanitaryMeasuresLoaded);
                loadWithRetries("media types", this::loadMediaTypesDictionary, DictionaryCache::isMediaTypesLoaded);
                loadWithRetries("dep options", this::loadDepOptionsDictionary, DictionaryCache::isDepOptionsLoaded);
                loadWithRetries("legal forms", this::loadLegalFormsDictionary, DictionaryCache::isLegalFormsLoaded);
                loadWithRetries("identification methods", this::loadIdentificationMethodsDictionary, DictionaryCache::isIdentificationMethodsLoaded);
                loadWithRetries("conformity doc kinds", this::loadConformityDocKindsDictionary, DictionaryCache::isConformityDocKindsLoaded);
                loadWithRetries("identity doc kinds", this::loadIdentityDocKindsDictionary, DictionaryCache::isIdentityDocKindsLoaded);
                System.out.println("========================================");
                System.out.println("[DictionaryInitializer] Dictionary loading completed");
                System.out.println("========================================");
            } catch (Throwable t) {
                System.err.println("[DictionaryInitializer] Background loading failed: " + t.getMessage());
                t.printStackTrace();
            }
        }, "DictionaryInitializer");
        loader.setDaemon(true);
        loader.start();
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
        DictionaryCache.clearMediaTypesCache();
        DictionaryCache.clearDepOptionsCache();
        DictionaryCache.clearLegalFormsCache();
        DictionaryCache.clearIdentificationMethodsCache();
        DictionaryCache.clearConformityDocKindsCache();
        DictionaryCache.clearIdentityDocKindsCache();
    }
    
    private static final int LOAD_MAX_ATTEMPTS = 3;
    private static final long LOAD_RETRY_DELAY_MS = 3000;
    
    /**
     * Выполняет загрузку справочника с повторными попытками при неудаче (таймаут БД, сеть).
     */
    private void loadWithRetries(String dictionaryName, Runnable loadTask, BooleanSupplier isLoaded) {
        for (int attempt = 1; attempt <= LOAD_MAX_ATTEMPTS; attempt++) {
            loadTask.run();
            if (isLoaded.getAsBoolean()) {
                if (attempt > 1) {
                    System.out.println("[DictionaryInitializer] " + dictionaryName + " loaded on attempt " + attempt);
                }
                return;
            }
            if (attempt < LOAD_MAX_ATTEMPTS) {
                System.out.println("[DictionaryInitializer] " + dictionaryName + " failed (attempt " + attempt + "/" + LOAD_MAX_ATTEMPTS + "), retry in " + (LOAD_RETRY_DELAY_MS / 1000) + " s...");
                try {
                    Thread.sleep(LOAD_RETRY_DELAY_MS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    System.err.println("[DictionaryInitializer] Interrupted while waiting before retry");
                    return;
                }
            } else {
                System.err.println("[DictionaryInitializer] " + dictionaryName + " failed after " + LOAD_MAX_ATTEMPTS + " attempts");
            }
        }
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
            // Fallback: чтобы API был доступен и проверка кода "7" не пропускалась
            List<IncidentAlertKindOption> fallback = new ArrayList<>();
            fallback.add(new IncidentAlertKindOption("7", "Вид уведомления 7"));
            DictionaryCache.setIncidentAlertKindsCache(fallback);
            System.out.println("[DictionaryInitializer] Using fallback incident alert kinds (code 7) so validation is not skipped");
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
            
            String sql = "SELECT AUTHORITYID, AUTHORITYUID, AUTHORITYNAME, AUTHORITYBRIEFNAME, COUNTRYCODE " +
                        "FROM SESINT.AUTHORITY " +
                        "ORDER BY COUNTRYCODE, AUTHORITYNAME";
            
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            
            List<AuthorityOption> authorities = new ArrayList<>();
            int count = 0;
            
            while (rs.next()) {
                int authId = rs.getInt("AUTHORITYID");
                if (rs.wasNull()) continue;
                String uid = rs.getString("AUTHORITYUID");
                String name = rs.getString("AUTHORITYNAME");
                String briefName = rs.getString("AUTHORITYBRIEFNAME");
                String countryCode = rs.getString("COUNTRYCODE");
                
                authorities.add(new AuthorityOption(
                    uid != null ? uid : "",
                    name != null ? name : "",
                    briefName != null ? briefName : "",
                    countryCode != null ? countryCode : "",
                    authId
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
     * Загружает справочник организационно-правовых форм (SESINT.LEGALFORM, codeListId=2049) в кеш
     */
    private void loadLegalFormsDictionary() {
        Connection conn = null;
        try {
            System.out.println("[DictionaryInitializer] Loading legal forms dictionary...");
            conn = DatabaseUtil.getConnection();
            String sql = "SELECT LEGALFORMCODE, LEGALFORMNAME, COUNTRYCODE " +
                        "FROM SESINT.LEGALFORM " +
                        "WHERE (LEGALFORMSDATE IS NULL OR LEGALFORMSDATE <= SYSDATE) " +
                        "AND (LEGALFORMEDATE IS NULL OR LEGALFORMEDATE >= SYSDATE) " +
                        "ORDER BY COUNTRYCODE, LEGALFORMCODE";
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            List<LegalFormOption> list = new ArrayList<>();
            int count = 0;
            while (rs.next()) {
                list.add(new LegalFormOption(
                    rs.getString("LEGALFORMCODE"),
                    rs.getString("LEGALFORMNAME"),
                    rs.getString("COUNTRYCODE")
                ));
                count++;
            }
            DictionaryCache.setLegalFormsCache(list);
            System.out.println("[DictionaryInitializer] Loaded " + count + " legal forms into cache");
            rs.close();
            stmt.close();
        } catch (SQLException e) {
            System.err.println("[DictionaryInitializer] ERROR loading legal forms dictionary: " + e.getMessage());
            e.printStackTrace();
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }
    
    /**
     * Загружает справочник методов идентификации (SESINT.BUSENTKIND, codeListId=1033) в кеш
     */
    private void loadIdentificationMethodsDictionary() {
        Connection conn = null;
        try {
            System.out.println("[DictionaryInitializer] Loading identification methods dictionary...");
            conn = DatabaseUtil.getConnection();
            String sql = "SELECT BUSENTKINDCODE, BUSENTKINDLETTERCODE, BUSENTKINDDESC, COUNTRYCODE " +
                        "FROM SESINT.BUSENTKIND " +
                        "WHERE (BUSENTKINDSDATE IS NULL OR BUSENTKINDSDATE <= SYSDATE) " +
                        "AND (BUSENTKINDEDATE IS NULL OR BUSENTKINDEDATE >= SYSDATE) " +
                        "ORDER BY COUNTRYCODE, BUSENTKINDCODE";
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            List<IdentificationMethodOption> list = new ArrayList<>();
            int count = 0;
            while (rs.next()) {
                list.add(new IdentificationMethodOption(
                    rs.getString("BUSENTKINDCODE"),
                    rs.getString("BUSENTKINDLETTERCODE"),
                    rs.getString("BUSENTKINDDESC"),
                    rs.getString("COUNTRYCODE")
                ));
                count++;
            }
            DictionaryCache.setIdentificationMethodsCache(list);
            System.out.println("[DictionaryInitializer] Loaded " + count + " identification methods into cache");
            rs.close();
            stmt.close();
        } catch (SQLException e) {
            System.err.println("[DictionaryInitializer] ERROR loading identification methods dictionary: " + e.getMessage());
            e.printStackTrace();
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }
    
    /**
     * Загружает справочник видов документов об оценке соответствия (SESINT.CONFDOCKIND, codeListId=2001) в кеш
     */
    private void loadConformityDocKindsDictionary() {
        Connection conn = null;
        try {
            System.out.println("[DictionaryInitializer] Loading conformity doc kinds dictionary...");
            conn = DatabaseUtil.getConnection();
            String sql = "SELECT CONFDOCKINDCODE, CONFDOCKINDNAME, CONFDOCKINDBRIEFNAME " +
                        "FROM SESINT.CONFDOCKIND " +
                        "WHERE (CONFDOCKINDSDATE IS NULL OR CONFDOCKINDSDATE <= SYSDATE) " +
                        "AND CONFDOCKINDEDATE >= SYSDATE " +
                        "ORDER BY CONFDOCKINDCODE";
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            List<ConformityDocKindOption> list = new ArrayList<>();
            int count = 0;
            while (rs.next()) {
                list.add(new ConformityDocKindOption(
                    rs.getString("CONFDOCKINDCODE"),
                    rs.getString("CONFDOCKINDNAME"),
                    rs.getString("CONFDOCKINDBRIEFNAME")
                ));
                count++;
            }
            DictionaryCache.setConformityDocKindsCache(list);
            System.out.println("[DictionaryInitializer] Loaded " + count + " conformity doc kinds into cache");
            rs.close();
            stmt.close();
        } catch (SQLException e) {
            System.err.println("[DictionaryInitializer] ERROR loading conformity doc kinds dictionary: " + e.getMessage());
            e.printStackTrace();
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }
    
    /**
     * Загружает справочник видов документов, удостоверяющих личность (SESINT.IDENTITYDOCKIND, codeListId=2053) в кеш
     */
    private void loadIdentityDocKindsDictionary() {
        Connection conn = null;
        try {
            System.out.println("[DictionaryInitializer] Loading identity doc kinds dictionary...");
            conn = DatabaseUtil.getConnection();
            String sql = "SELECT IDENTITYDOCKINDCODE, IDENTITYDOCKINDNAME " +
                        "FROM SESINT.IDENTITYDOCKIND " +
                        "WHERE IDENTITYDOCKINDSDATE <= SYSDATE " +
                        "AND (IDENTITYDOCKINDEDATE IS NULL OR IDENTITYDOCKINDEDATE >= SYSDATE) " +
                        "ORDER BY IDENTITYDOCKINDCODE";
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            List<IdentityDocKindOption> list = new ArrayList<>();
            int count = 0;
            while (rs.next()) {
                list.add(new IdentityDocKindOption(
                    rs.getString("IDENTITYDOCKINDCODE"),
                    rs.getString("IDENTITYDOCKINDNAME")
                ));
                count++;
            }
            DictionaryCache.setIdentityDocKindsCache(list);
            System.out.println("[DictionaryInitializer] Loaded " + count + " identity doc kinds into cache");
            rs.close();
            stmt.close();
        } catch (SQLException e) {
            System.err.println("[DictionaryInitializer] ERROR loading identity doc kinds dictionary: " + e.getMessage());
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
    
    /**
     * Загружает справочник форматов данных (MEDIATYPE) из базы данных в кеш
     */
    private void loadMediaTypesDictionary() {
        Connection conn = null;
        try {
            System.out.println("[DictionaryInitializer] Loading media types dictionary...");
            conn = DatabaseUtil.getConnection();
            
            // Загружаем только активные записи (где MEDIATYPEACTFL = 1)
            String sql = "SELECT MEDIATYPECODE, MEDIATYPENAME " +
                        "FROM SESINT.MEDIATYPE " +
                        "WHERE MEDIATYPEACTFL = 1 " +
                        "ORDER BY NVL(MEDIATYPESEQNUM, 999999), MEDIATYPENAME";
            
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            
            List<MediaTypeOption> mediaTypes = new ArrayList<>();
            int count = 0;
            
            while (rs.next()) {
                String code = rs.getString("MEDIATYPECODE");
                String name = rs.getString("MEDIATYPENAME");
                
                mediaTypes.add(new MediaTypeOption(
                    code != null ? code : "",
                    name != null ? name : ""
                ));
                count++;
            }
            
            DictionaryCache.setMediaTypesCache(mediaTypes);
            System.out.println("[DictionaryInitializer] Loaded " + count + " media types into cache");
            
            rs.close();
            stmt.close();
            
        } catch (SQLException e) {
            System.err.println("[DictionaryInitializer] ERROR loading media types dictionary: " + e.getMessage());
            e.printStackTrace();
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }
    
    /**
     * Загружает справочник подразделений (TB_DEP + TB_DEPKIND) для «Определить доступ»
     */
    private void loadDepOptionsDictionary() {
        Connection conn = null;
        try {
            System.out.println("[DictionaryInitializer] Loading dep options dictionary...");
            conn = DatabaseUtil.getConnection();
            
            String sql = "SELECT d.DEPID, d.DEPNAME, dk.DEPKINDCODE "
                    + "FROM SESDEV.TB_DEP d "
                    + "LEFT JOIN SESDEV.TB_DEPKIND dk ON d.DEPKINDID = dk.DEPKINDID "
                    + "ORDER BY d.DEPNAME";
            
            PreparedStatement stmt = conn.prepareStatement(sql);
            ResultSet rs = stmt.executeQuery();
            
            List<DepOption> options = new ArrayList<>();
            int count = 0;
            
            while (rs.next()) {
                String id = rs.getString(1);
                String name = rs.getString(2);
                String depKindCode = rs.getString(3);
                options.add(new DepOption(id, name, depKindCode));
                count++;
            }
            
            DictionaryCache.setDepOptionsCache(options);
            System.out.println("[DictionaryInitializer] Loaded " + count + " dep options into cache");
            
            rs.close();
            stmt.close();
            
        } catch (SQLException e) {
            System.err.println("[DictionaryInitializer] ERROR loading dep options dictionary: " + e.getMessage());
            e.printStackTrace();
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }
}



