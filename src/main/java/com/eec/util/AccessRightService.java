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
     * Ищет в JSON блок up.{section} и внутри него объект с ключом rightKey (например "view", "access"),
     * содержащий хотя бы один ключ. Поиск rightKey ведётся только внутри значения section,
     * чтобы не принять ключ из следующего блока (например "view" из publicHealthIn при проверке publicHealthDB).
     */
    private static boolean hasAccessRightInJson(String json, String section, String rightKey) {
        if (json == null || json.trim().isEmpty()) return false;
        int upStart = json.indexOf("\"up\"");
        if (upStart < 0) return false;
        int sectionStart = json.indexOf("\"" + section + "\"", upStart);
        if (sectionStart < 0) return false;
        // Границы значения section: после "section" идёт ": { ... }" — ищем только внутри этого объекта
        int colonAfterSection = json.indexOf(':', sectionStart);
        if (colonAfterSection < 0) return false;
        int sectionValueStart = json.indexOf('{', colonAfterSection);
        if (sectionValueStart < 0) return false;
        int depth = 1;
        int i = sectionValueStart + 1;
        while (i < json.length() && depth > 0) {
            char c = json.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') depth--;
            i++;
        }
        int sectionValueEnd = (depth == 0 && i <= json.length()) ? i - 1 : -1;
        if (sectionValueEnd < 0) return false;
        String sectionBody = json.substring(sectionValueStart, sectionValueEnd + 1);
        // Ищем rightKey только внутри этого блока
        int rightStart = sectionBody.indexOf("\"" + rightKey + "\"");
        if (rightStart < 0) return false;
        int braceStart = sectionBody.indexOf('{', rightStart);
        if (braceStart < 0) return false;
        depth = 1;
        i = braceStart + 1;
        while (i < sectionBody.length() && depth > 0) {
            char c = sectionBody.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') depth--;
            i++;
        }
        String block = (depth == 0 && i <= sectionBody.length()) ? sectionBody.substring(braceStart, i) : "";
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

    // ——— PPV (карта сведений о выявленных нарушениях): те же роли, блоки JSON violationDetected*

    public static boolean hasViolationDetectedInAccess(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "violationDetectedIn", "access");
    }

    public static boolean hasViolationDetectedOutAccess(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "violationDetectedOut", "access");
    }

    public static boolean hasViolationDetectedDBAccess(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "violationDetectedDB", "access");
    }

    public static boolean hasViolationDetectedInStatus(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "violationDetectedIn", "status");
    }

    public static boolean hasViolationDetectedOutStatus(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "violationDetectedOut", "status");
    }

    public static boolean hasViolationDetectedOutSend(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "violationDetectedOut", "send");
    }

    public static boolean hasViolationDetectedOutEdit(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "violationDetectedOut", "edit");
    }

    // ——— PHA (сведения об обнаружении болезней): просмотр по источнику

    /**
     * Просмотр входящих сведений PHA — publicHealthIn:view.
     */
    public static boolean hasPublicHealthInView(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "publicHealthIn", "view");
    }

    /**
     * Управление статусом входящих сведений PHA — publicHealthIn:status.
     */
    public static boolean hasPublicHealthInStatus(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "publicHealthIn", "status");
    }

    /**
     * Просмотр исходящих сведений PHA — publicHealthOut:view.
     */
    public static boolean hasPublicHealthOutView(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "publicHealthOut", "view");
    }

    /**
     * Управление статусом исходящих сведений PHA — publicHealthOut:status.
     */
    public static boolean hasPublicHealthOutStatus(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "publicHealthOut", "status");
    }

    /**
     * Направление исходящих сведений PHA другим участникам ОП 57 — publicHealthOut:send.
     */
    public static boolean hasPublicHealthOutSend(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "publicHealthOut", "send");
    }

    /**
     * Редактирование / сохранение исходящих сведений PHA — publicHealthOut:edit.
     */
    public static boolean hasPublicHealthOutEdit(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "publicHealthOut", "edit");
    }

    /**
     * Просмотр данных ЕЭК PHA — publicHealthDB:view.
     */
    public static boolean hasPublicHealthDBView(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "publicHealthDB", "view");
    }
}
