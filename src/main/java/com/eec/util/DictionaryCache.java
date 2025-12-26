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
    
    // Кеш видов уведомлений: код -> название
    private static final Map<String, String> incidentAlertKindsCache = new ConcurrentHashMap<>();
    private static final List<IncidentAlertKindOption> incidentAlertKindsListCache = new ArrayList<>();
    
    // Кеш уполномоченных органов: UID -> данные
    private static final Map<String, AuthorityOption> authoritiesCache = new ConcurrentHashMap<>();
    // Кеш уполномоченных органов по стране: код страны -> список органов
    private static final Map<String, List<AuthorityOption>> authoritiesByCountryCache = new ConcurrentHashMap<>();
    
    // Флаги загрузки
    private static volatile boolean countriesLoaded = false;
    private static volatile boolean incidentAlertKindsLoaded = false;
    
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
     */
    public static class AuthorityOption {
        public String uid;
        public String name;
        public String briefName;
        public String countryCode;
        
        public AuthorityOption(String uid, String name, String briefName, String countryCode) {
            this.uid = uid;
            this.name = name;
            this.briefName = briefName;
            this.countryCode = countryCode;
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
                
                // Группируем по стране
                String countryCode = authority.countryCode != null ? authority.countryCode : "";
                byCountry.computeIfAbsent(countryCode, k -> new ArrayList<>()).add(authority);
            }
            
            // Сохраняем сгруппированные данные
            authoritiesByCountryCache.putAll(byCountry);
        }
    }
    
    public static List<AuthorityOption> getAuthoritiesByCountry(String countryCode) {
        synchronized (authoritiesCache) {
            List<AuthorityOption> cached = authoritiesByCountryCache.get(countryCode);
            return cached != null ? new ArrayList<>(cached) : new ArrayList<>();
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
}

