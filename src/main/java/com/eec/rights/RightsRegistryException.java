package com.eec.rights;

/**
 * Сбой взаимодействия с удалённым eec-rights-service (сеть, 5xx, неверный ответ).
 */
public class RightsRegistryException extends RuntimeException {

    public RightsRegistryException(String message) {
        super(message);
    }

    public RightsRegistryException(String message, Throwable cause) {
        super(message, cause);
    }
}
