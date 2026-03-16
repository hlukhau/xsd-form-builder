package com.eec.util;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Кеш для справочников
 * Хранит справочники в памяти для быстрого доступа
 */
public class DictionaryCache {
    
    // Кеш стран: код -> название
    private static final Map<String, String> countriesCache = new ConcurrentHashMap<>();
    private static final List<CountryOption> countriesListCache = new ArrayList<>();

    // Кеш пунктов пропуска (SESINT.BORDERCHECKPOINT): код -> название
    private static final List<BorderCheckpointOption> borderCheckpointsListCache = new ArrayList<>();
    
    // Кеш видов уведомлений: код -> название
    private static final Map<String, String> incidentAlertKindsCache = new ConcurrentHashMap<>();
    private static final List<IncidentAlertKindOption> incidentAlertKindsListCache = new ArrayList<>();
    
    // Кеш уполномоченных органов: UID -> данные
    private static final Map<String, AuthorityOption> authoritiesCache = new ConcurrentHashMap<>();
    // Кеш уполномоченных органов по стране: код страны -> список органов
    private static final Map<String, List<AuthorityOption>> authoritiesByCountryCache = new ConcurrentHashMap<>();
    
    // Кеш типов санитарной продукции: код -> название
    private static final Map<String, String> sanitaryProdTypesCache = new ConcurrentHashMap<>();
    private static final List<SanitaryProdTypeOption> sanitaryProdTypesListCache = new ArrayList<>();
    
    // Кеш единиц измерения: код -> данные
    private static final Map<String, MeasurementUnitOption> measurementUnitsCache = new ConcurrentHashMap<>();
    private static final List<MeasurementUnitOption> measurementUnitsListCache = new ArrayList<>();
    
    // Кеш видов товаросопроводительных документов: код -> название
    private static final Map<String, String> shipDocKindsCache = new ConcurrentHashMap<>();
    private static final List<ShipDocKindOption> shipDocKindsListCache = new ArrayList<>();
    
    // Кеш видов участников цепи поставки: код -> название
    private static final Map<String, String> supplyChainPartyKindsCache = new ConcurrentHashMap<>();
    private static final List<SupplyChainPartyKindOption> supplyChainPartyKindsListCache = new ArrayList<>();
    // Кеш видов каналов связи (COMMUNICATIONCHANNEL)
    private static final List<CommunicationChannelOption> communicationChannelsListCache = new ArrayList<>();
    
    // Кеш технических регламентов: код -> название
    private static final Map<String, String> techRegulsCache = new ConcurrentHashMap<>();
    private static final List<TechRegulOption> techRegulsListCache = new ArrayList<>();
    
    // Кеш видов объектов действия мер: код -> название
    private static final Map<String, String> sanitaryMeasureObjKindsCache = new ConcurrentHashMap<>();
    private static final List<SanitaryMeasureObjKindOption> sanitaryMeasureObjKindsListCache = new ArrayList<>();
    
    // Кеш санитарных мер: код -> название
    private static final Map<String, String> sanitaryMeasuresCache = new ConcurrentHashMap<>();
    private static final List<SanitaryMeasureOption> sanitaryMeasuresListCache = new ArrayList<>();
    
    // Кеш форматов данных: код -> название
    private static final Map<String, String> mediaTypesCache = new ConcurrentHashMap<>();
    private static final List<MediaTypeOption> mediaTypesListCache = new ArrayList<>();
    
    // Кеш подразделений (TB_DEP + TB_DEPKIND): список для «Определить доступ»
    private static final List<DepOption> depOptionsListCache = new ArrayList<>();
    
    // Кеш организационно-правовых форм (SESINT.LEGALFORM, codeListId=2049)
    private static final List<LegalFormOption> legalFormsListCache = new ArrayList<>();
    // Кеш методов идентификации (SESINT.BUSENTKIND, codeListId=1033)
    private static final List<IdentificationMethodOption> identificationMethodsListCache = new ArrayList<>();
    // Кеш видов документов об оценке соответствия (SESINT.CONFDOCKIND, codeListId=2001)
    private static final List<ConformityDocKindOption> conformityDocKindsListCache = new ArrayList<>();
    // Кеш видов документов, удостоверяющих личность (SESINT.IDENTITYDOCKIND, codeListId=2053)
    private static final List<IdentityDocKindOption> identityDocKindsListCache = new ArrayList<>();
    
    // Флаги загрузки
    private static volatile boolean countriesLoaded = false;
    private static volatile boolean borderCheckpointsLoaded = false;
    private static volatile boolean incidentAlertKindsLoaded = false;
    private static volatile boolean sanitaryProdTypesLoaded = false;
    private static volatile boolean measurementUnitsLoaded = false;
    private static volatile boolean shipDocKindsLoaded = false;
    private static volatile boolean supplyChainPartyKindsLoaded = false;
    private static volatile boolean communicationChannelsLoaded = false;
    private static volatile boolean techRegulsLoaded = false;
    private static volatile boolean sanitaryMeasureObjKindsLoaded = false;
    private static volatile boolean sanitaryMeasuresLoaded = false;
    private static volatile boolean mediaTypesLoaded = false;
    private static volatile boolean depOptionsLoaded = false;
    private static volatile boolean legalFormsLoaded = false;
    private static volatile boolean identificationMethodsLoaded = false;
    private static volatile boolean conformityDocKindsLoaded = false;
    private static volatile boolean identityDocKindsLoaded = false;
    
    /**
     * Класс для опции страны
     */
    public static class CountryOption {
        public String code;
        public String name;
        
        public CountryOption(String code, String name) {
            this.code = code;
            this.name = name;
        }
    }

    /**
     * Класс для опции пункта пропуска (SESINT.BORDERCHECKPOINT)
     */
    public static class BorderCheckpointOption {
        public String code;
        public String name;

        public BorderCheckpointOption(String code, String name) {
            this.code = code;
            this.name = name;
        }
    }
    
    /**
     * Класс для опции вида уведомления
     */
    public static class IncidentAlertKindOption {
        public String code;
        public String name;
        
        public IncidentAlertKindOption(String code, String name) {
            this.code = code;
            this.name = name;
        }
    }
    
    /**
     * Класс для опции уполномоченного органа
     * authorityId — для фильтрации по карте прав (dangerousProductOut.create).
     */
    public static class AuthorityOption {
        public String uid;
        public String name;
        public String briefName;
        public String countryCode;
        /** AUTHORITYID из SESINT.AUTHORITY (для фильтра по правам create) */
        public Integer authorityId;

        public AuthorityOption(String uid, String name, String briefName, String countryCode) {
            this(uid, name, briefName, countryCode, null);
        }

        public AuthorityOption(String uid, String name, String briefName, String countryCode, Integer authorityId) {
            this.uid = uid;
            this.name = name;
            this.briefName = briefName;
            this.countryCode = countryCode;
            this.authorityId = authorityId;
        }
    }
    
    /**
     * Класс для опции типа санитарной продукции
     */
    public static class SanitaryProdTypeOption {
        public String code;
        public String name;
        
        public SanitaryProdTypeOption(String code, String name) {
            this.code = code;
            this.name = name;
        }
    }
    
    /**
     * Класс для опции единицы измерения
     */
    public static class MeasurementUnitOption {
        public String code;
        public String name;
        public String briefName;
        
        public MeasurementUnitOption(String code, String name, String briefName) {
            this.code = code;
            this.name = name;
            this.briefName = briefName;
        }
    }
    
    /**
     * Класс для опции вида товаросопроводительного документа
     */
    public static class ShipDocKindOption {
        public String code;
        public String name;
        
        public ShipDocKindOption(String code, String name) {
            this.code = code;
            this.name = name;
        }
    }
    
    /**
     * Класс для опции вида участника цепи поставки
     */
    public static class SupplyChainPartyKindOption {
        public String code;
        public String name;
        
        public SupplyChainPartyKindOption(String code, String name) {
            this.code = code;
            this.name = name;
        }
    }

    /**
     * Опция справочника видов каналов связи (SESINT.COMMUNICATIONCHANNEL)
     */
    public static class CommunicationChannelOption {
        public String code;
        public String name;

        public CommunicationChannelOption(String code, String name) {
            this.code = code != null ? code : "";
            this.name = name != null ? name : "";
        }
    }
    
    /**
     * Класс для опции технического регламента
     */
    public static class TechRegulOption {
        public String code;
        public String name;
        public String regNum;
        
        public TechRegulOption(String code, String name, String regNum) {
            this.code = code;
            this.name = name;
            this.regNum = regNum;
        }
    }
    
    /**
     * Класс для опции вида объекта действия мер
     */
    public static class SanitaryMeasureObjKindOption {
        public String code;
        public String name;
        
        public SanitaryMeasureObjKindOption(String code, String name) {
            this.code = code;
            this.name = name;
        }
    }
    
    /**
     * Класс для опции санитарной меры
     */
    public static class SanitaryMeasureOption {
        public String code;
        public String name;
        
        public SanitaryMeasureOption(String code, String name) {
            this.code = code;
            this.name = name;
        }
    }
    
    /**
     * Класс для опции формата данных
     */
    public static class MediaTypeOption {
        public String code;
        public String name;
        
        public MediaTypeOption(String code, String name) {
            this.code = code;
            this.name = name;
        }
    }
    
    /**
     * Класс для опции подразделения (TB_DEP + DEPKINDCODE)
     */
    public static class DepOption {
        public String id;
        public String name;
        public String depKindCode;
        
        public DepOption(String id, String name, String depKindCode) {
            this.id = id != null ? id : "";
            this.name = name != null ? name : "";
            this.depKindCode = depKindCode != null ? depKindCode : "";
        }
    }
    
    /**
     * Опция справочника организационно-правовых форм (SESINT.LEGALFORM, codeListId=2049)
     */
    public static class LegalFormOption {
        public String code;
        public String name;
        public String countryCode;
        
        public LegalFormOption(String code, String name, String countryCode) {
            this.code = code != null ? code : "";
            this.name = name != null ? name : "";
            this.countryCode = countryCode != null ? countryCode : "";
        }
    }
    
    /**
     * Опция справочника методов идентификации (SESINT.BUSENTKIND, codeListId=1033)
     */
    public static class IdentificationMethodOption {
        public String code;
        public String letterCode;
        public String description;
        public String countryCode;
        
        public IdentificationMethodOption(String code, String letterCode, String description, String countryCode) {
            this.code = code != null ? code : "";
            this.letterCode = letterCode != null ? letterCode : "";
            this.description = description != null ? description : "";
            this.countryCode = countryCode != null ? countryCode : "";
        }
    }
    
    /**
     * Опция справочника видов документов об оценке соответствия (SESINT.CONFDOCKIND, codeListId=2001)
     */
    public static class ConformityDocKindOption {
        public String code;
        public String name;
        public String briefName;
        
        public ConformityDocKindOption(String code, String name, String briefName) {
            this.code = code != null ? code : "";
            this.name = name != null ? name : "";
            this.briefName = briefName != null ? briefName : "";
        }
    }
    
    /**
     * Опция справочника видов документов, удостоверяющих личность (SESINT.IDENTITYDOCKIND, codeListId=2053)
     */
    public static class IdentityDocKindOption {
        public String code;
        public String name;
        
        public IdentityDocKindOption(String code, String name) {
            this.code = code != null ? code : "";
            this.name = name != null ? name : "";
        }
    }
    
    // ========== Методы для стран ==========
    
    public static void clearCountriesCache() {
        synchronized (countriesCache) {
            countriesCache.clear();
            countriesListCache.clear();
            countriesLoaded = false;
        }
    }
    
    public static void setCountriesCache(List<CountryOption> countries) {
        synchronized (countriesCache) {
            countriesCache.clear();
            countriesListCache.clear();
            for (CountryOption country : countries) {
                countriesCache.put(country.code, country.name);
                countriesListCache.add(country);
            }
            countriesLoaded = true;
        }
    }
    
    public static List<CountryOption> getCountriesList() {
        synchronized (countriesCache) {
            return new ArrayList<>(countriesListCache);
        }
    }

    public static void setBorderCheckpointCache(List<BorderCheckpointOption> list) {
        synchronized (borderCheckpointsListCache) {
            borderCheckpointsListCache.clear();
            borderCheckpointsListCache.addAll(list);
            borderCheckpointsLoaded = true;
        }
    }

    public static List<BorderCheckpointOption> getBorderCheckpointList() {
        synchronized (borderCheckpointsListCache) {
            return new ArrayList<>(borderCheckpointsListCache);
        }
    }

    public static boolean isBorderCheckpointsLoaded() {
        return borderCheckpointsLoaded;
    }
    
    public static String getCountryName(String code) {
        return countriesCache.get(code);
    }
    
    public static boolean isCountriesLoaded() {
        return countriesLoaded;
    }
    
    // ========== Методы для видов уведомлений ==========
    
    public static void clearIncidentAlertKindsCache() {
        synchronized (incidentAlertKindsCache) {
            incidentAlertKindsCache.clear();
            incidentAlertKindsListCache.clear();
            incidentAlertKindsLoaded = false;
        }
    }
    
    public static void setIncidentAlertKindsCache(List<IncidentAlertKindOption> kinds) {
        synchronized (incidentAlertKindsCache) {
            incidentAlertKindsCache.clear();
            incidentAlertKindsListCache.clear();
            for (IncidentAlertKindOption kind : kinds) {
                incidentAlertKindsCache.put(kind.code, kind.name);
                incidentAlertKindsListCache.add(kind);
            }
            incidentAlertKindsLoaded = true;
        }
    }
    
    public static List<IncidentAlertKindOption> getIncidentAlertKindsList() {
        synchronized (incidentAlertKindsCache) {
            return new ArrayList<>(incidentAlertKindsListCache);
        }
    }
    
    public static String getIncidentAlertKindName(String code) {
        return incidentAlertKindsCache.get(code);
    }
    
    public static boolean isIncidentAlertKindExists(String code) {
        return incidentAlertKindsCache.containsKey(code);
    }
    
    public static boolean isIncidentAlertKindsLoaded() {
        return incidentAlertKindsLoaded;
    }
    
    // ========== Методы для уполномоченных органов ==========
    
    public static void clearAuthoritiesCache() {
        synchronized (authoritiesCache) {
            authoritiesCache.clear();
            authoritiesByCountryCache.clear();
        }
    }
    
    public static void setAuthoritiesCache(String countryCode, List<AuthorityOption> authorities) {
        synchronized (authoritiesCache) {
            // Обновляем кеш по стране
            authoritiesByCountryCache.put(countryCode, new ArrayList<>(authorities));
            // Обновляем общий кеш
            for (AuthorityOption authority : authorities) {
                authoritiesCache.put(authority.uid, authority);
            }
        }
    }
    
    /**
     * Загружает все уполномоченные органы в кеш, группируя по странам
     */
    public static void loadAllAuthoritiesCache(List<AuthorityOption> allAuthorities) {
        synchronized (authoritiesCache) {
            authoritiesCache.clear();
            authoritiesByCountryCache.clear();
            
            // Группируем по странам
            Map<String, List<AuthorityOption>> byCountry = new HashMap<>();
            for (AuthorityOption authority : allAuthorities) {
                // Добавляем в общий кеш
                authoritiesCache.put(authority.uid, authority);
                
                // Группируем по стране (приводим к верхнему регистру для единообразия)
                String countryCode = authority.countryCode != null ? authority.countryCode.trim().toUpperCase() : "";
                byCountry.computeIfAbsent(countryCode, k -> new ArrayList<>()).add(authority);
            }
            
            // Сохраняем сгруппированные данные
            authoritiesByCountryCache.putAll(byCountry);
            
            // Логируем статистику по странам
            System.out.println("[DictionaryCache] Authorities grouped by country:");
            for (Map.Entry<String, List<AuthorityOption>> entry : byCountry.entrySet()) {
                System.out.println("  " + entry.getKey() + ": " + entry.getValue().size() + " authorities");
            }
        }
    }
    
    /** Признак того, что справочник уполномоченных органов загружен (для повторных попыток при старте) */
    public static boolean isAuthoritiesLoaded() {
        synchronized (authoritiesCache) {
            return !authoritiesCache.isEmpty();
        }
    }
    
    public static List<AuthorityOption> getAuthoritiesByCountry(String countryCode) {
        synchronized (authoritiesCache) {
            // Приводим код страны к верхнему регистру для поиска
            String normalizedCountryCode = countryCode != null ? countryCode.trim().toUpperCase() : "";
            List<AuthorityOption> cached = authoritiesByCountryCache.get(normalizedCountryCode);
            
            if (cached == null) {
                System.out.println("[DictionaryCache] No authorities found for countryCode: " + normalizedCountryCode);
                System.out.println("[DictionaryCache] Available country codes: " + authoritiesByCountryCache.keySet());
                return new ArrayList<>();
            }
            
            System.out.println("[DictionaryCache] Found " + cached.size() + " authorities for countryCode: " + normalizedCountryCode);
            return new ArrayList<>(cached);
        }
    }
    
    public static AuthorityOption getAuthorityByUid(String uid) {
        return authoritiesCache.get(uid);
    }
    
    /**
     * Получить все уполномоченные органы из кеша
     */
    public static List<AuthorityOption> getAllAuthorities() {
        synchronized (authoritiesCache) {
            return new ArrayList<>(authoritiesCache.values());
        }
    }
    
    // ========== Методы для типов санитарной продукции ==========
    
    public static void clearSanitaryProdTypesCache() {
        synchronized (sanitaryProdTypesCache) {
            sanitaryProdTypesCache.clear();
            sanitaryProdTypesListCache.clear();
            sanitaryProdTypesLoaded = false;
        }
    }
    
    public static void setSanitaryProdTypesCache(List<SanitaryProdTypeOption> types) {
        synchronized (sanitaryProdTypesCache) {
            sanitaryProdTypesCache.clear();
            sanitaryProdTypesListCache.clear();
            for (SanitaryProdTypeOption type : types) {
                sanitaryProdTypesCache.put(type.code, type.name);
                sanitaryProdTypesListCache.add(type);
            }
            sanitaryProdTypesLoaded = true;
        }
    }
    
    public static List<SanitaryProdTypeOption> getSanitaryProdTypesList() {
        synchronized (sanitaryProdTypesCache) {
            return new ArrayList<>(sanitaryProdTypesListCache);
        }
    }
    
    public static String getSanitaryProdTypeName(String code) {
        synchronized (sanitaryProdTypesCache) {
            return sanitaryProdTypesCache.get(code);
        }
    }
    
    public static boolean isSanitaryProdTypeExists(String code) {
        synchronized (sanitaryProdTypesCache) {
            return sanitaryProdTypesCache.containsKey(code);
        }
    }
    
    public static boolean isSanitaryProdTypesLoaded() {
        return sanitaryProdTypesLoaded;
    }
    
    // ========== Методы для единиц измерения ==========
    
    public static void clearMeasurementUnitsCache() {
        synchronized (measurementUnitsCache) {
            measurementUnitsCache.clear();
            measurementUnitsListCache.clear();
            measurementUnitsLoaded = false;
        }
    }
    
    public static void setMeasurementUnitsCache(List<MeasurementUnitOption> units) {
        synchronized (measurementUnitsCache) {
            measurementUnitsCache.clear();
            measurementUnitsListCache.clear();
            for (MeasurementUnitOption unit : units) {
                measurementUnitsCache.put(unit.code, unit);
                measurementUnitsListCache.add(unit);
            }
            measurementUnitsLoaded = true;
        }
    }
    
    public static List<MeasurementUnitOption> getMeasurementUnitsList() {
        synchronized (measurementUnitsCache) {
            return new ArrayList<>(measurementUnitsListCache);
        }
    }
    
    public static MeasurementUnitOption getMeasurementUnitByCode(String code) {
        synchronized (measurementUnitsCache) {
            return measurementUnitsCache.get(code);
        }
    }
    
    public static boolean isMeasurementUnitsLoaded() {
        return measurementUnitsLoaded;
    }
    
    // ========== Методы для видов товаросопроводительных документов ==========
    
    public static void clearShipDocKindsCache() {
        synchronized (shipDocKindsCache) {
            shipDocKindsCache.clear();
            shipDocKindsListCache.clear();
            shipDocKindsLoaded = false;
        }
    }
    
    public static void setShipDocKindsCache(List<ShipDocKindOption> kinds) {
        synchronized (shipDocKindsCache) {
            shipDocKindsCache.clear();
            shipDocKindsListCache.clear();
            for (ShipDocKindOption kind : kinds) {
                shipDocKindsCache.put(kind.code, kind.name);
                shipDocKindsListCache.add(kind);
            }
            shipDocKindsLoaded = true;
        }
    }
    
    public static List<ShipDocKindOption> getShipDocKindsList() {
        synchronized (shipDocKindsCache) {
            return new ArrayList<>(shipDocKindsListCache);
        }
    }
    
    public static String getShipDocKindName(String code) {
        synchronized (shipDocKindsCache) {
            return shipDocKindsCache.get(code);
        }
    }
    
    public static boolean isShipDocKindExists(String code) {
        synchronized (shipDocKindsCache) {
            return shipDocKindsCache.containsKey(code);
        }
    }
    
    public static boolean isShipDocKindsLoaded() {
        return shipDocKindsLoaded;
    }
    
    // ========== Методы для видов участников цепи поставки ==========
    
    public static void clearSupplyChainPartyKindsCache() {
        synchronized (supplyChainPartyKindsCache) {
            supplyChainPartyKindsCache.clear();
            supplyChainPartyKindsListCache.clear();
            supplyChainPartyKindsLoaded = false;
        }
    }
    
    public static void setSupplyChainPartyKindsCache(List<SupplyChainPartyKindOption> kinds) {
        synchronized (supplyChainPartyKindsCache) {
            supplyChainPartyKindsCache.clear();
            supplyChainPartyKindsListCache.clear();
            for (SupplyChainPartyKindOption kind : kinds) {
                supplyChainPartyKindsCache.put(kind.code, kind.name);
                supplyChainPartyKindsListCache.add(kind);
            }
            supplyChainPartyKindsLoaded = true;
        }
    }
    
    public static List<SupplyChainPartyKindOption> getSupplyChainPartyKindsList() {
        synchronized (supplyChainPartyKindsCache) {
            return new ArrayList<>(supplyChainPartyKindsListCache);
        }
    }
    
    public static String getSupplyChainPartyKindName(String code) {
        synchronized (supplyChainPartyKindsCache) {
            return supplyChainPartyKindsCache.get(code);
        }
    }
    
    public static boolean isSupplyChainPartyKindExists(String code) {
        synchronized (supplyChainPartyKindsCache) {
            return supplyChainPartyKindsCache.containsKey(code);
        }
    }
    
    public static boolean isSupplyChainPartyKindsLoaded() {
        return supplyChainPartyKindsLoaded;
    }

    // ========== Методы для видов каналов связи (COMMUNICATIONCHANNEL) ==========

    public static void clearCommunicationChannelsCache() {
        synchronized (communicationChannelsListCache) {
            communicationChannelsListCache.clear();
            communicationChannelsLoaded = false;
        }
    }

    public static void setCommunicationChannelsCache(List<CommunicationChannelOption> list) {
        synchronized (communicationChannelsListCache) {
            communicationChannelsListCache.clear();
            communicationChannelsListCache.addAll(list);
            communicationChannelsLoaded = true;
        }
    }

    public static List<CommunicationChannelOption> getCommunicationChannelsList() {
        synchronized (communicationChannelsListCache) {
            return new ArrayList<>(communicationChannelsListCache);
        }
    }

    public static String getCommunicationChannelName(String code) {
        if (code == null) return null;
        synchronized (communicationChannelsListCache) {
            for (CommunicationChannelOption o : communicationChannelsListCache) {
                if (code.equals(o.code)) return o.name;
            }
        }
        return null;
    }

    public static boolean isCommunicationChannelsLoaded() {
        return communicationChannelsLoaded;
    }
    
    // ========== Методы для технических регламентов ==========
    
    public static void clearTechRegulsCache() {
        synchronized (techRegulsCache) {
            techRegulsCache.clear();
            techRegulsListCache.clear();
            techRegulsLoaded = false;
        }
    }
    
    public static void setTechRegulsCache(List<TechRegulOption> reguls) {
        synchronized (techRegulsCache) {
            techRegulsCache.clear();
            techRegulsListCache.clear();
            for (TechRegulOption regul : reguls) {
                techRegulsCache.put(regul.code, regul.name);
                techRegulsListCache.add(regul);
            }
            techRegulsLoaded = true;
        }
    }
    
    public static List<TechRegulOption> getTechRegulsList() {
        synchronized (techRegulsCache) {
            return new ArrayList<>(techRegulsListCache);
        }
    }
    
    public static String getTechRegulName(String code) {
        synchronized (techRegulsCache) {
            return techRegulsCache.get(code);
        }
    }
    
    public static boolean isTechRegulExists(String code) {
        synchronized (techRegulsCache) {
            return techRegulsCache.containsKey(code);
        }
    }
    
    public static boolean isTechRegulsLoaded() {
        return techRegulsLoaded;
    }
    
    // ========== Методы для видов объектов действия мер ==========
    
    public static void clearSanitaryMeasureObjKindsCache() {
        synchronized (sanitaryMeasureObjKindsCache) {
            sanitaryMeasureObjKindsCache.clear();
            sanitaryMeasureObjKindsListCache.clear();
            sanitaryMeasureObjKindsLoaded = false;
        }
    }
    
    public static void setSanitaryMeasureObjKindsCache(List<SanitaryMeasureObjKindOption> kinds) {
        synchronized (sanitaryMeasureObjKindsCache) {
            sanitaryMeasureObjKindsCache.clear();
            sanitaryMeasureObjKindsListCache.clear();
            for (SanitaryMeasureObjKindOption kind : kinds) {
                sanitaryMeasureObjKindsCache.put(kind.code, kind.name);
                sanitaryMeasureObjKindsListCache.add(kind);
            }
            sanitaryMeasureObjKindsLoaded = true;
        }
    }
    
    public static List<SanitaryMeasureObjKindOption> getSanitaryMeasureObjKindsList() {
        synchronized (sanitaryMeasureObjKindsCache) {
            return new ArrayList<>(sanitaryMeasureObjKindsListCache);
        }
    }
    
    public static String getSanitaryMeasureObjKindName(String code) {
        synchronized (sanitaryMeasureObjKindsCache) {
            return sanitaryMeasureObjKindsCache.get(code);
        }
    }
    
    public static boolean isSanitaryMeasureObjKindExists(String code) {
        synchronized (sanitaryMeasureObjKindsCache) {
            return sanitaryMeasureObjKindsCache.containsKey(code);
        }
    }
    
    public static boolean isSanitaryMeasureObjKindsLoaded() {
        return sanitaryMeasureObjKindsLoaded;
    }
    
    // ========== Методы для санитарных мер ==========
    
    public static void clearSanitaryMeasuresCache() {
        synchronized (sanitaryMeasuresCache) {
            sanitaryMeasuresCache.clear();
            sanitaryMeasuresListCache.clear();
            sanitaryMeasuresLoaded = false;
        }
    }
    
    public static void setSanitaryMeasuresCache(List<SanitaryMeasureOption> measures) {
        synchronized (sanitaryMeasuresCache) {
            sanitaryMeasuresCache.clear();
            sanitaryMeasuresListCache.clear();
            for (SanitaryMeasureOption measure : measures) {
                sanitaryMeasuresCache.put(measure.code, measure.name);
                sanitaryMeasuresListCache.add(measure);
            }
            sanitaryMeasuresLoaded = true;
        }
    }
    
    public static List<SanitaryMeasureOption> getSanitaryMeasuresList() {
        synchronized (sanitaryMeasuresCache) {
            return new ArrayList<>(sanitaryMeasuresListCache);
        }
    }
    
    public static String getSanitaryMeasureName(String code) {
        synchronized (sanitaryMeasuresCache) {
            return sanitaryMeasuresCache.get(code);
        }
    }
    
    public static boolean isSanitaryMeasureExists(String code) {
        synchronized (sanitaryMeasuresCache) {
            return sanitaryMeasuresCache.containsKey(code);
        }
    }
    
    public static boolean isSanitaryMeasuresLoaded() {
        return sanitaryMeasuresLoaded;
    }
    
    // ========== Методы для форматов данных (MEDIATYPE) ==========
    
    public static void setMediaTypesCache(List<MediaTypeOption> mediaTypes) {
        synchronized (mediaTypesCache) {
            mediaTypesCache.clear();
            mediaTypesListCache.clear();
            for (MediaTypeOption mediaType : mediaTypes) {
                mediaTypesCache.put(mediaType.code, mediaType.name);
                mediaTypesListCache.add(mediaType);
            }
            mediaTypesLoaded = true;
        }
    }
    
    public static String getMediaTypeName(String code) {
        synchronized (mediaTypesCache) {
            return mediaTypesCache.get(code);
        }
    }
    
    public static List<MediaTypeOption> getMediaTypesList() {
        synchronized (mediaTypesCache) {
            return new ArrayList<>(mediaTypesListCache);
        }
    }
    
    public static void clearMediaTypesCache() {
        synchronized (mediaTypesCache) {
            mediaTypesCache.clear();
            mediaTypesListCache.clear();
            mediaTypesLoaded = false;
        }
    }
    
    public static boolean isMediaTypesLoaded() {
        return mediaTypesLoaded;
    }
    
    // ========== Методы для подразделений ==========
    
    public static void clearDepOptionsCache() {
        synchronized (depOptionsListCache) {
            depOptionsListCache.clear();
            depOptionsLoaded = false;
        }
    }
    
    public static void setDepOptionsCache(List<DepOption> options) {
        synchronized (depOptionsListCache) {
            depOptionsListCache.clear();
            depOptionsListCache.addAll(options);
            depOptionsLoaded = true;
        }
    }
    
    public static List<DepOption> getDepOptionsList() {
        synchronized (depOptionsListCache) {
            return new ArrayList<>(depOptionsListCache);
        }
    }
    
    public static boolean isDepOptionsLoaded() {
        return depOptionsLoaded;
    }
    
    // ========== Методы для организационно-правовых форм (LEGALFORM) ==========
    
    public static void clearLegalFormsCache() {
        synchronized (legalFormsListCache) {
            legalFormsListCache.clear();
            legalFormsLoaded = false;
        }
    }
    
    public static void setLegalFormsCache(List<LegalFormOption> list) {
        synchronized (legalFormsListCache) {
            legalFormsListCache.clear();
            legalFormsListCache.addAll(list);
            legalFormsLoaded = true;
        }
    }
    
    public static List<LegalFormOption> getLegalFormsList() {
        synchronized (legalFormsListCache) {
            return new ArrayList<>(legalFormsListCache);
        }
    }
    
    public static List<LegalFormOption> getLegalFormsByCountry(String countryCode) {
        if (countryCode == null || countryCode.trim().isEmpty()) {
            return getLegalFormsList();
        }
        String norm = countryCode.trim().toUpperCase();
        List<LegalFormOption> out = new ArrayList<>();
        synchronized (legalFormsListCache) {
            for (LegalFormOption o : legalFormsListCache) {
                if (norm.equals(o.countryCode != null ? o.countryCode.toUpperCase() : "")) {
                    out.add(o);
                }
            }
        }
        return out;
    }
    
    public static boolean isLegalFormsLoaded() {
        return legalFormsLoaded;
    }
    
    // ========== Методы для методов идентификации (BUSENTKIND) ==========
    
    public static void clearIdentificationMethodsCache() {
        synchronized (identificationMethodsListCache) {
            identificationMethodsListCache.clear();
            identificationMethodsLoaded = false;
        }
    }
    
    public static void setIdentificationMethodsCache(List<IdentificationMethodOption> list) {
        synchronized (identificationMethodsListCache) {
            identificationMethodsListCache.clear();
            identificationMethodsListCache.addAll(list);
            identificationMethodsLoaded = true;
        }
    }
    
    public static List<IdentificationMethodOption> getIdentificationMethodsList() {
        synchronized (identificationMethodsListCache) {
            return new ArrayList<>(identificationMethodsListCache);
        }
    }
    
    public static List<IdentificationMethodOption> getIdentificationMethodsByCountry(String countryCode) {
        if (countryCode == null || countryCode.trim().isEmpty()) {
            return getIdentificationMethodsList();
        }
        String norm = countryCode.trim().toUpperCase();
        List<IdentificationMethodOption> out = new ArrayList<>();
        synchronized (identificationMethodsListCache) {
            for (IdentificationMethodOption o : identificationMethodsListCache) {
                if (norm.equals(o.countryCode != null ? o.countryCode.toUpperCase() : "")) {
                    out.add(o);
                }
            }
        }
        return out;
    }
    
    public static boolean isIdentificationMethodsLoaded() {
        return identificationMethodsLoaded;
    }
    
    // ========== Методы для видов документов об оценке соответствия (CONFDOCKIND) ==========
    
    public static void clearConformityDocKindsCache() {
        synchronized (conformityDocKindsListCache) {
            conformityDocKindsListCache.clear();
            conformityDocKindsLoaded = false;
        }
    }
    
    public static void setConformityDocKindsCache(List<ConformityDocKindOption> list) {
        synchronized (conformityDocKindsListCache) {
            conformityDocKindsListCache.clear();
            conformityDocKindsListCache.addAll(list);
            conformityDocKindsLoaded = true;
        }
    }
    
    public static List<ConformityDocKindOption> getConformityDocKindsList() {
        synchronized (conformityDocKindsListCache) {
            return new ArrayList<>(conformityDocKindsListCache);
        }
    }
    
    public static boolean isConformityDocKindsLoaded() {
        return conformityDocKindsLoaded;
    }
    
    // ========== Методы для видов документов, удостоверяющих личность (IDENTITYDOCKIND) ==========
    
    public static void clearIdentityDocKindsCache() {
        synchronized (identityDocKindsListCache) {
            identityDocKindsListCache.clear();
            identityDocKindsLoaded = false;
        }
    }
    
    public static void setIdentityDocKindsCache(List<IdentityDocKindOption> list) {
        synchronized (identityDocKindsListCache) {
            identityDocKindsListCache.clear();
            identityDocKindsListCache.addAll(list);
            identityDocKindsLoaded = true;
        }
    }
    
    public static List<IdentityDocKindOption> getIdentityDocKindsList() {
        synchronized (identityDocKindsListCache) {
            return new ArrayList<>(identityDocKindsListCache);
        }
    }
    
    public static String getIdentityDocKindName(String code) {
        if (code == null) return null;
        synchronized (identityDocKindsListCache) {
            for (IdentityDocKindOption o : identityDocKindsListCache) {
                if (code.equals(o.code)) return o.name;
            }
        }
        return null;
    }
    
    public static boolean isIdentityDocKindsLoaded() {
        return identityDocKindsLoaded;
    }
}

