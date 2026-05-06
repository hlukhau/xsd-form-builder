package com.eec.rights;

import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Локальный кэш WAR + HTTP в EEC ({@link HttpRightsRegistry} → WAR {@code card_rigths}).
 * <p><b>Запись (обязательный источник правды — EEC):</b> сначала {@code POST} в EEC; только после
 * успеха — копия в локальный кэш этого WAR. Сбой EEC → {@link RightsRegistryException}, в кэш WAR
 * ничего не пишем.
 * <p><b>Чтение:</b> сначала кэш WAR, иначе GET в EEC и кэширование ответа. При 404 в EEC — пробуем
 * догрузить по гонке (см. реализацию).
 */
public final class CachingHttpRightsRegistry implements RightsRegistry {

    private final RightsRegistry remote;
    private final ConcurrentHashMap<String, String> localCache = new ConcurrentHashMap<>();

    public CachingHttpRightsRegistry(RightsRegistry remote) {
        this.remote = remote;
    }

    @Override
    public String getRightsJson(String guid) {
        if (guid == null) {
            return null;
        }
        String key = guid.trim();
        if (key.isEmpty()) {
            return null;
        }
        String fromLocal = localCache.get(key);
        if (fromLocal != null) {
            return fromLocal;
        }
        try {
            String fromRemote = remote.getRightsJson(key);
            if (fromRemote != null && !fromRemote.trim().isEmpty()) {
                localCache.put(key, fromRemote);
                return fromRemote;
            }
        } catch (RightsRegistryException e) {
            String onlyLocal = localCache.get(key);
            if (onlyLocal != null) {
                return onlyLocal;
            }
            throw e;
        }
        // Сервис вернул 404: к этому моменту в кэше пусто; возможен гонка с put — перечитать
        String raced = localCache.get(key);
        if (raced != null) {
            try {
                remote.putRightsJson(key, raced);
            } catch (RightsRegistryException ex) {
                System.err.println("[CachingHttpRightsRegistry] backfill skip for " + key + ": " + ex.getMessage());
            }
            return raced;
        }
        return null;
    }

    @Override
    public void putRightsJson(String guid, String jsonBody) {
        if (guid == null || jsonBody == null) {
            return;
        }
        String key = guid.trim();
        remote.putRightsJson(key, jsonBody);
        localCache.put(key, jsonBody);
    }

    @Override
    public void putRightsJsonBody(String jsonBody) {
        if (jsonBody == null) {
            return;
        }
        remote.putRightsJsonBody(jsonBody);
        String g = GuidJsonExtractor.extractGuidFromJson(jsonBody);
        if (g != null && !g.trim().isEmpty()) {
            localCache.put(g.trim(), jsonBody);
        }
    }

    @Override
    public boolean containsGuid(String guid) {
        if (guid == null) {
            return false;
        }
        String key = guid.trim();
        if (key.isEmpty()) {
            return false;
        }
        if (localCache.get(key) != null) {
            return true;
        }
        return getRightsJson(key) != null;
    }

    @Override
    public int size() {
        return remote.size();
    }

    @Override
    public Set<String> guidKeySet() {
        return Collections.unmodifiableSet(localCache.keySet());
    }
}
