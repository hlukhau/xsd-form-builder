package com.eec.rights;

/**
 * Делегат реестра (задаётся в {@link RightsRegistryContextListener}).
 */
public final class RightsRegistryProvider {

    private static RightsRegistry instance;

    private RightsRegistryProvider() {}

    public static RightsRegistry get() {
        if (instance == null) {
            throw new IllegalStateException(
                    "RightsRegistry not initialized: RightsRegistryContextListener must run first (eec-rights-service URL via eec.rights.service.baseUrl)");
        }
        return instance;
    }

    public static void set(RightsRegistry registry) {
        instance = registry;
    }
}
