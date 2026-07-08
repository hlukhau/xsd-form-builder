package com.eec.servlet.sma;

/**
 * Вид карты дополнительных сведений: запрос (SMAQ) или ответ (SMAR).
 */
public enum SmaCardKind {
    SMAQ,
    SMAR;

    public String apiName() {
        return name().toLowerCase();
    }

    public static SmaCardKind parse(String raw) {
        if (raw == null) {
            return null;
        }
        String t = raw.trim();
        if (t.isEmpty()) {
            return null;
        }
        if ("smaq".equalsIgnoreCase(t) || "q".equalsIgnoreCase(t)) {
            return SMAQ;
        }
        if ("smar".equalsIgnoreCase(t) || "r".equalsIgnoreCase(t)) {
            return SMAR;
        }
        try {
            return valueOf(t.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
