package com.eec.rights;

import java.util.Set;

/**
 * Реестр JSON-прав по GUID. Реализация: {@link CachingHttpRightsRegistry} → {@link HttpRightsRegistry} (eec-rights-service).
 */
public interface RightsRegistry {

    String getRightsJson(String guid);

    void putRightsJson(String guid, String jsonBody);

    void putRightsJsonBody(String jsonBody);

    boolean containsGuid(String guid);

    int size();

    /**
     * Для отладочных логов. Удалённый реестр может вернуть пустое множество.
     */
    Set<String> guidKeySet();
}
