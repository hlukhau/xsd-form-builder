package com.eec.util;

import javax.servlet.http.HttpServletRequest;

/**
 * Извлечение GUID из запроса API карты (для {@link DatabaseUtil#getConnectionForRequest}).
 * Порядок: query {@code guid} → attribute {@code guid} → заголовки X-GUID / X-Guid.
 */
public final class ServletRequestGuid {

    private ServletRequestGuid() {
    }

    public static String resolve(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String guid = normalize(request.getParameter("guid"));
        if (guid != null) {
            return guid;
        }
        Object attr = request.getAttribute("guid");
        if (attr != null) {
            guid = normalize(String.valueOf(attr));
            if (guid != null) {
                return guid;
            }
        }
        guid = normalize(request.getHeader("X-GUID"));
        if (guid != null) {
            return guid;
        }
        return normalize(request.getHeader("X-Guid"));
    }

    private static String normalize(String guid) {
        if (guid == null) {
            return null;
        }
        String trimmed = guid.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
