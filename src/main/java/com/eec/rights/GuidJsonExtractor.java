package com.eec.rights;

/**
 * Извлекает GUID из JSON (правила как в {@link com.eec.servlet.XsdFormBuilderServlet}).
 */
public final class GuidJsonExtractor {

    private GuidJsonExtractor() {}

    public static String extractGuidFromJson(String json) {
        if (json == null || json.isEmpty()) {
            return null;
        }
        json = json.trim();
        if (json.startsWith("{") && json.endsWith("}")) {
            json = json.substring(1, json.length() - 1).trim();
        }
        String[] patterns = {"\"guid\"", "\"GUID\"", "'guid'", "'GUID'"};
        for (String pattern : patterns) {
            int keyIndex = json.toLowerCase().indexOf(pattern.toLowerCase());
            if (keyIndex >= 0) {
                int colonIndex = json.indexOf(':', keyIndex);
                if (colonIndex >= 0) {
                    String valuePart = json.substring(colonIndex + 1).trim();
                    if (valuePart.startsWith("\"")) {
                        int endQuote = valuePart.indexOf('"', 1);
                        if (endQuote > 0) {
                            return valuePart.substring(1, endQuote);
                        }
                    } else if (valuePart.startsWith("'")) {
                        int endQuote = valuePart.indexOf('\'', 1);
                        if (endQuote > 0) {
                            return valuePart.substring(1, endQuote);
                        }
                    } else {
                        int commaIndex = valuePart.indexOf(',');
                        if (commaIndex > 0) {
                            return valuePart.substring(0, commaIndex).trim();
                        }
                        return valuePart.trim();
                    }
                }
            }
        }
        return null;
    }
}
