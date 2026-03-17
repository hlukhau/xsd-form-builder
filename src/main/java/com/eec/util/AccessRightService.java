package com.eec.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Проверка прав доступа по JSON карты прав (up.dangerousProductIn.access и т.д.).
 * Для проверок по источнику сведений вызывающий код передаёт JSON прав по GUID.
 * Параметр id в методах может быть null (для обратной совместимости API).
 */
public final class AccessRightService {

    private AccessRightService() {
    }

    /**
     * Проверить наличие непустого объекта access в блоке up.dangerousProductIn.
     * Право: управление доступом к входящим сведениям об опасной продукции — dangerousProductIn:access.
     *
     * @param rightsJson JSON прав (по GUID); null или пустая строка — нет права
     * @return true — в JSON есть up.dangerousProductIn.access с хотя бы одним ключом
     */
    public static boolean hasDangerousProductInAccess(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "dangerousProductIn", "access");
    }

    /**
     * Проверить наличие непустого объекта access в блоке up.dangerousProductOut.
     * Право: управление доступом к исходящим сведениям — dangerousProductOut:access.
     *
     * @param rightsJson JSON прав (по GUID); null или пустая строка — нет права
     * @return true — в JSON есть up.dangerousProductOut.access с хотя бы одним ключом
     */
    public static boolean hasDangerousProductOutAccess(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "dangerousProductOut", "access");
    }

    /**
     * Проверить наличие непустого объекта access в блоке up.dangerousProductDB.
     * Право: управление доступом к сведениям из БД ЕЭК — dangerousProductDB:access.
     *
     * @param rightsJson JSON прав (по GUID); null или пустая строка — нет права
     * @return true — в JSON есть up.dangerousProductDB.access с хотя бы одним ключом
     */
    public static boolean hasDangerousProductDBAccess(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "dangerousProductDB", "access");
    }

    /**
     * Ищет в JSON блок up.{section} и внутри него объект с ключом "access", содержащий хотя бы один ключ.
     */
    private static boolean hasAccessRightInJson(String json, String section, String rightKey) {
        if (json == null || json.trim().isEmpty()) return false;
        int upStart = json.indexOf("\"up\"");
        if (upStart < 0) return false;
        int sectionStart = json.indexOf("\"" + section + "\"", upStart);
        if (sectionStart < 0) return false;
        int rightStart = json.indexOf("\"" + rightKey + "\"", sectionStart);
        if (rightStart < 0) return false;
        int braceStart = json.indexOf('{', rightStart);
        if (braceStart < 0) return false;
        int depth = 1;
        int i = braceStart + 1;
        while (i < json.length() && depth > 0) {
            char c = json.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') depth--;
            i++;
        }
        String block = (depth == 0 && i <= json.length()) ? json.substring(braceStart, i) : "";
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(block);
        return keyM.find();
    }

    /**
     * Проверить, есть ли доступ для данной сущности/действия.
     *
     * @param id идентификатор (например, DPAID, код операции); может быть null
     * @return true — доступ разрешён (пока всегда), false — запрещён
     */
    public static boolean hasAccess(String id) {
        // TODO: реализовать проверку по внутренней карте прав
        return true;
    }

    /**
     * Проверить право на просмотр карты/реестра по id.
     *
     * @param id идентификатор (может быть null)
     * @return true — просмотр разрешён
     */
    public static boolean canView(String id) {
        // TODO: реализовать
        return true;
    }

    /**
     * Проверить право на редактирование по id.
     *
     * @param id идентификатор (может быть null)
     * @return true — редактирование разрешено
     */
    public static boolean canEdit(String id) {
        // TODO: реализовать
        return true;
    }

    /**
     * Управление статусом входящих сведений — dangerousProductIn:status.
     * Проверка по JSON прав (по GUID).
     */
    public static boolean hasDangerousProductInStatus(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "dangerousProductIn", "status");
    }

    /**
     * Управление статусом исходящих сведений — dangerousProductOut:status.
     * Проверка по JSON прав (по GUID).
     */
    public static boolean hasDangerousProductOutStatus(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "dangerousProductOut", "status");
    }

    /**
     * Направление исходящих сведений другим участникам — dangerousProductOut:send.
     * Проверка по JSON прав (по GUID).
     */
    public static boolean hasDangerousProductOutSend(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "dangerousProductOut", "send");
    }

    /**
     * Редактирование / сохранение исходящих сведений — dangerousProductOut:edit.
     * Проверка по JSON прав (по GUID).
     */
    public static boolean hasDangerousProductOutEdit(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "dangerousProductOut", "edit");
    }
}
