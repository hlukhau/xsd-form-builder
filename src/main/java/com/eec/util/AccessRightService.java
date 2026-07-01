package com.eec.util;

import java.util.HashSet;
import java.util.Set;
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
    /**
     * Тело объекта up.{section}.{rightKey} (фигурные скобки включительно), например {@code { "522": true }}.
     * @return null, если блок не найден
     */
    private static String extractUpRightObjectBlock(String json, String section, String rightKey) {
        if (json == null || json.trim().isEmpty()) return null;
        int upStart = json.indexOf("\"up\"");
        if (upStart < 0) return null;
        int sectionStart = json.indexOf("\"" + section + "\"", upStart);
        if (sectionStart < 0) return null;
        int colonAfterSection = json.indexOf(':', sectionStart);
        if (colonAfterSection < 0) return null;
        int sectionValueStart = json.indexOf('{', colonAfterSection);
        if (sectionValueStart < 0) return null;
        int depth = 1;
        int i = sectionValueStart + 1;
        while (i < json.length() && depth > 0) {
            char c = json.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') depth--;
            i++;
        }
        int sectionValueEnd = (depth == 0 && i <= json.length()) ? i - 1 : -1;
        if (sectionValueEnd < 0) return null;
        String sectionBody = json.substring(sectionValueStart, sectionValueEnd + 1);
        int rightStart = sectionBody.indexOf("\"" + rightKey + "\"");
        if (rightStart < 0) return null;
        int braceStart = sectionBody.indexOf('{', rightStart);
        if (braceStart < 0) return null;
        depth = 1;
        i = braceStart + 1;
        while (i < sectionBody.length() && depth > 0) {
            char c = sectionBody.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') depth--;
            i++;
        }
        if (depth != 0 || i > sectionBody.length()) return null;
        return sectionBody.substring(braceStart, i);
    }

    private static boolean hasAccessRightInJson(String json, String section, String rightKey) {
        String block = extractUpRightObjectBlock(json, section, rightKey);
        if (block == null || block.isEmpty()) return false;
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(block);
        return keyM.find();
    }

    /**
     * Ключи объекта up.violationDetectedIn.status (идентификаторы подразделений из JSON прав).
     */
    public static Set<String> violationDetectedInStatusDepKeys(String rightsJson) {
        Set<String> keys = new HashSet<>();
        String block = extractUpRightObjectBlock(rightsJson, "violationDetectedIn", "status");
        if (block == null || block.isEmpty()) return keys;
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(block);
        while (keyM.find()) {
            keys.add(keyM.group(1).trim());
        }
        return keys;
    }

    /** Ключи sanitaryMeasureIn.status (DEPID в JSON прав) — для SMR с входящей SMD. */
    public static Set<String> sanitaryMeasureInStatusDepKeys(String rightsJson) {
        return depKeysFromRightsBlock(rightsJson, "sanitaryMeasureIn", "status");
    }

    /** Ключи sanitaryMeasureIn.view. */
    public static Set<String> sanitaryMeasureInViewDepKeys(String rightsJson) {
        return depKeysFromRightsBlock(rightsJson, "sanitaryMeasureIn", "view");
    }

    /** Ключи sanitaryMeasureOut.view. */
    public static Set<String> sanitaryMeasureOutViewDepKeys(String rightsJson) {
        return depKeysFromRightsBlock(rightsJson, "sanitaryMeasureOut", "view");
    }

    /** Ключи sanitaryMeasureDB.view. */
    public static Set<String> sanitaryMeasureDBViewDepKeys(String rightsJson) {
        return depKeysFromRightsBlock(rightsJson, "sanitaryMeasureDB", "view");
    }

    private static Set<String> depKeysFromRightsBlock(String rightsJson, String section, String rightKey) {
        Set<String> keys = new HashSet<>();
        String block = extractUpRightObjectBlock(rightsJson, section, rightKey);
        if (block == null || block.isEmpty()) return keys;
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(block);
        while (keyM.find()) {
            keys.add(keyM.group(1).trim());
        }
        return keys;
    }

    /** Ключи sanitaryMeasureOut.status. */
    public static Set<String> sanitaryMeasureOutStatusDepKeys(String rightsJson) {
        return depKeysFromRightsBlock(rightsJson, "sanitaryMeasureOut", "status");
    }

    /** Ключи sanitaryMeasureOut.edit. */
    public static Set<String> sanitaryMeasureOutEditDepKeys(String rightsJson) {
        return depKeysFromRightsBlock(rightsJson, "sanitaryMeasureOut", "edit");
    }

    /** Ключи объекта up.violationDetectedOut.status (DEPID в JSON прав). */
    public static Set<String> violationDetectedOutStatusDepKeys(String rightsJson) {
        Set<String> keys = new HashSet<>();
        String block = extractUpRightObjectBlock(rightsJson, "violationDetectedOut", "status");
        if (block == null || block.isEmpty()) return keys;
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(block);
        while (keyM.find()) {
            keys.add(keyM.group(1).trim());
        }
        return keys;
    }

    /** Ключи объекта up.violationDetectedOut.edit (DEPID в JSON прав). */
    public static Set<String> violationDetectedOutEditDepKeys(String rightsJson) {
        Set<String> keys = new HashSet<>();
        String block = extractUpRightObjectBlock(rightsJson, "violationDetectedOut", "edit");
        if (block == null || block.isEmpty()) return keys;
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(block);
        while (keyM.find()) {
            keys.add(keyM.group(1).trim());
        }
        return keys;
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

    // ——— SMD (карта сведений о временной санитарной мере): sanitaryMeasureIn / Out / DB

    public static boolean hasSanitaryMeasureInAccess(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "sanitaryMeasureIn", "access");
    }

    public static boolean hasSanitaryMeasureOutAccess(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "sanitaryMeasureOut", "access");
    }

    public static boolean hasSanitaryMeasureDBAccess(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "sanitaryMeasureDB", "access");
    }

    public static boolean hasSanitaryMeasureInStatus(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "sanitaryMeasureIn", "status");
    }

    public static boolean hasSanitaryMeasureInView(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "sanitaryMeasureIn", "view");
    }

    public static boolean hasSanitaryMeasureOutStatus(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "sanitaryMeasureOut", "status");
    }

    public static boolean hasSanitaryMeasureOutSend(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "sanitaryMeasureOut", "send");
    }

    public static boolean hasSanitaryMeasureOutEdit(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "sanitaryMeasureOut", "edit");
    }

    public static boolean hasSanitaryMeasureOutView(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "sanitaryMeasureOut", "view");
    }

    public static boolean hasSanitaryMeasureDBView(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "sanitaryMeasureDB", "view");
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

    /** Ключи (DEPID) объекта up.violationDetectedIn.access. */
    public static Set<String> violationDetectedInAccessDepKeys(String rightsJson) {
        return depKeysFromUpRightBlock(rightsJson, "violationDetectedIn", "access");
    }

    /** Ключи (DEPID) объекта up.violationDetectedOut.access. */
    public static Set<String> violationDetectedOutAccessDepKeys(String rightsJson) {
        return depKeysFromUpRightBlock(rightsJson, "violationDetectedOut", "access");
    }

    /** Ключи (DEPID) объекта up.violationDetectedDB.access. */
    public static Set<String> violationDetectedDBAccessDepKeys(String rightsJson) {
        return depKeysFromUpRightBlock(rightsJson, "violationDetectedDB", "access");
    }

    private static Set<String> depKeysFromUpRightBlock(String rightsJson, String section, String rightKey) {
        Set<String> keys = new HashSet<>();
        String block = extractUpRightObjectBlock(rightsJson, section, rightKey);
        if (block == null || block.isEmpty()) return keys;
        Pattern keyP = Pattern.compile("\"([^\"]+)\"\\s*:");
        Matcher keyM = keyP.matcher(block);
        while (keyM.find()) {
            keys.add(keyM.group(1).trim());
        }
        return keys;
    }

    public static boolean hasViolationDetectedInStatus(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "violationDetectedIn", "status");
    }

    /**
     * Просмотр связанной карты DPR по входящей PPV — violationDetectedIn:view
     * (непустой объект {@code up.violationDetectedIn.view} в JSON прав).
     */
    public static boolean hasViolationDetectedInView(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "violationDetectedIn", "view");
    }

    /** Ключи (DEPID) объекта up.violationDetectedIn.view. */
    public static Set<String> violationDetectedInViewDepKeys(String rightsJson) {
        return depKeysFromUpRightBlock(rightsJson, "violationDetectedIn", "view");
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

    /** Просмотр исходящей карты PPV / связанных данных — {@code up.violationDetectedOut.view}. */
    public static boolean hasViolationDetectedOutView(String rightsJson) {
        return hasAccessRightInJson(rightsJson, "violationDetectedOut", "view");
    }

    /** Ключи (DEPID) объекта up.violationDetectedOut.view. */
    public static Set<String> violationDetectedOutViewDepKeys(String rightsJson) {
        return depKeysFromUpRightBlock(rightsJson, "violationDetectedOut", "view");
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
