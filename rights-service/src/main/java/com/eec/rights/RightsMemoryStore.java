package com.eec.rights;

import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory guid → полный JSON. Очищается при редеплое WAR / рестарте Tomcat.
 */
public final class RightsMemoryStore {

    private static final RightsMemoryStore INSTANCE = new RightsMemoryStore();
    private final ConcurrentHashMap<String, String> map = new ConcurrentHashMap<>();

    private RightsMemoryStore() {}

    public static RightsMemoryStore getInstance() {
        return INSTANCE;
    }

    public void put(String guid, String jsonBody) {
        if (guid == null || guid.isEmpty()) {
            throw new IllegalArgumentException("guid is empty");
        }
        map.put(guid.trim(), jsonBody);
    }

    public String get(String guid) {
        if (guid == null) {
            return null;
        }
        return map.get(guid.trim());
    }

    public boolean contains(String guid) {
        return guid != null && map.containsKey(guid.trim());
    }

    public int size() {
        return map.size();
    }

    public Set<String> keySet() {
        return Collections.unmodifiableSet(map.keySet());
    }
}
