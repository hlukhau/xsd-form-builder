package com.eec.servlet;

import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.AuthorityOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Сервлет для получения списка уполномоченных органов (AUTHORITY) для выпадающего списка
 * GET /api/authorities/options?countryCode=RU
 * Регистрируется в web.xml
 */
public class AuthorityOptionsServlet extends HttpServlet {
    
    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[AuthorityOptionsServlet] Initialized");
        System.out.println("[AuthorityOptionsServlet] Ready to serve authorities from cache");
    }
    
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        
        String countryCode = request.getParameter("countryCode");
        String authorityIdsParam = request.getParameter("authorityIds");
        System.out.println("[AuthorityOptionsServlet] Loading authorities from cache, countryCode: " + countryCode + ", authorityIds: " + authorityIdsParam);
        
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        
        PrintWriter out = null;
        
        try {
            out = response.getWriter();
        } catch (IOException e) {
            System.err.println("[AuthorityOptionsServlet] Cannot get writer: " + e.getMessage());
            return;
        }
        
        try {
            // Проверяем, загружен ли кеш
            List<AuthorityOption> allAuthorities = DictionaryCache.getAllAuthorities();
            System.out.println("[AuthorityOptionsServlet] Total authorities in cache: " + allAuthorities.size());
            
            if (allAuthorities.isEmpty()) {
                System.out.println("[AuthorityOptionsServlet] WARNING: Authorities cache is empty, returning 503");
                response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                out.print("{\"error\":\"Справочник уполномоченных органов не загружен\"}");
                return;
            }
            
            // Разрешённые AUTHORITYID из карты прав (dangerousProductOut.create) — только эти УО показывать в списке
            Set<Integer> allowedAuthorityIds = null;
            if (authorityIdsParam != null) {
                String trimmed = authorityIdsParam.trim();
                if (trimmed.isEmpty()) {
                    allowedAuthorityIds = Collections.emptySet();
                    System.out.println("[AuthorityOptionsServlet] Filter by create rights, allowedAuthorityIds: (empty)");
                } else {
                    allowedAuthorityIds = Arrays.stream(trimmed.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .map(s -> {
                            try { return Integer.valueOf(s); } catch (NumberFormatException e) { return null; }
                        })
                        .filter(id -> id != null)
                        .collect(Collectors.toSet());
                    System.out.println("[AuthorityOptionsServlet] Filter by create rights, allowedAuthorityIds: " + allowedAuthorityIds);
                }
            }
            
            // Получаем данные из кеша
            List<AuthorityOption> authorities;
            
            if (countryCode != null && !countryCode.trim().isEmpty()) {
                String normalizedCountryCode = countryCode.trim().toUpperCase();
                System.out.println("[AuthorityOptionsServlet] Requested countryCode: '" + countryCode + "' -> normalized: '" + normalizedCountryCode + "'");
                // Фильтруем по стране
                authorities = DictionaryCache.getAuthoritiesByCountry(normalizedCountryCode);
                System.out.println("[AuthorityOptionsServlet] Filtering by countryCode: " + normalizedCountryCode + ", found: " + authorities.size());
            } else {
                // Возвращаем все органы (из всех стран)
                authorities = new ArrayList<>(allAuthorities);
                // Сортируем по стране и названию
                authorities.sort((a1, a2) -> {
                    int countryCompare = (a1.countryCode != null ? a1.countryCode : "").compareTo(a2.countryCode != null ? a2.countryCode : "");
                    if (countryCompare != 0) return countryCompare;
                    return (a1.name != null ? a1.name : "").compareTo(a2.name != null ? a2.name : "");
                });
                System.out.println("[AuthorityOptionsServlet] Returning all authorities: " + authorities.size());
            }
            
            // Ограничение по карте прав create: только УО с AUTHORITYID из списка
            final Set<Integer> allowedIds = allowedAuthorityIds;
            if (allowedIds != null) {
                if (allowedIds.isEmpty()) {
                    authorities = Collections.emptyList();
                } else {
                    authorities = authorities.stream()
                        .filter(a -> a.authorityId != null && allowedIds.contains(a.authorityId))
                        .collect(Collectors.toList());
                }
                System.out.println("[AuthorityOptionsServlet] After filter by create: " + authorities.size());
            }
            
            out.print("[");
            boolean first = true;
            int count = 0;
            
            for (AuthorityOption authority : authorities) {
                if (!first) {
                    out.print(",");
                }
                first = false;
                count++;
                
                String uid = authority.uid != null ? authority.uid : "";
                String name = fixUtf8MojibakeIfNeeded(authority.name != null ? authority.name : "");
                String briefName = fixUtf8MojibakeIfNeeded(authority.briefName != null ? authority.briefName : "");
                String code = authority.countryCode != null ? authority.countryCode : "";
                
                // Экранируем кавычки
                uid = uid.replace("\\", "\\\\").replace("\"", "\\\"");
                name = name.replace("\\", "\\\\").replace("\"", "\\\"");
                briefName = briefName.replace("\\", "\\\\").replace("\"", "\\\"");
                code = code.replace("\\", "\\\\").replace("\"", "\\\"");
                
                out.print("{\"uid\":\"" + uid + "\",\"name\":\"" + name + "\",\"briefName\":\"" + briefName + "\",\"countryCode\":\"" + code + "\"}");
            }
            
            out.print("]");
            System.out.println("[AuthorityOptionsServlet] Loaded " + count + " authorities from cache");
            
        } catch (Exception e) {
            System.err.println("[AuthorityOptionsServlet] ERROR: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            
            if (out == null) {
                try {
                    out = response.getWriter();
                } catch (IOException ioException) {
                    System.err.println("[AuthorityOptionsServlet] Cannot get writer for error response");
                    return;
                }
            }
            
            String errorMsg = e.getMessage();
            if (errorMsg != null) {
                errorMsg = errorMsg.replace("\\", "\\\\");
                errorMsg = errorMsg.replace("\"", "\\\"");
                errorMsg = errorMsg.replace("\n", " ");
                errorMsg = errorMsg.replace("\r", " ");
            } else {
                errorMsg = "Unknown error";
            }
            out.print("{\"error\":\"Ошибка: " + errorMsg + "\"}");
        } catch (Throwable t) {
            System.err.println("[AuthorityOptionsServlet] FATAL ERROR: " + t.getMessage());
            t.printStackTrace();
            if (response.getStatus() == HttpServletResponse.SC_OK) {
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            }
        } finally {
            if (out != null) {
                out.close();
            }
        }
    }

    /**
     * Исправляет искажение «UTF-8 прочитан как Latin-1» (например из Oracle) только если строка похожа на битую:
     * содержит типичные байты (Ð 0xD0, Ñ 0xD1) и при этом не содержит кириллицы. Корректные строки не трогаем.
     */
    private static String fixUtf8MojibakeIfNeeded(String s) {
        if (s == null || s.isEmpty()) return s;
        boolean hasMojibakeBytes = false;
        boolean hasCyrillic = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c >= 0x0400 && c <= 0x04FF) hasCyrillic = true;
            if (c == 0xD0 || c == 0xD1) hasMojibakeBytes = true;
        }
        if (!hasMojibakeBytes || hasCyrillic) return s;
        try {
            byte[] asLatin1 = s.getBytes(StandardCharsets.ISO_8859_1);
            String decoded = new String(asLatin1, StandardCharsets.UTF_8);
            if (decoded.contains("\uFFFD")) return s;
            return decoded;
        } catch (Exception e) {
            return s;
        }
    }
}


