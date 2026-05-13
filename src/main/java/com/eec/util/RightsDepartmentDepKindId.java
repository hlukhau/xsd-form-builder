package com.eec.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Идентификатор вида подразделения из JSON карты прав ({@code department.depkindid}):
 * 72 — районный ЦГЭ, 73 — областной, 74 — республиканский (по ТЗ на исходящие DPR/PPV).
 */
public final class RightsDepartmentDepKindId {

    private RightsDepartmentDepKindId() {
    }

    /**
     * Ищет в JSON первое вхождение {@code "depkindid"} (без учёта регистра ключа) со значением числа.
     */
    public static Integer parseFromRights(String rightsJson) {
        if (rightsJson == null || rightsJson.isEmpty()) {
            return null;
        }
        Matcher m = Pattern.compile("\"depkindid\"\\s*:\\s*(-?\\d+)", Pattern.CASE_INSENSITIVE).matcher(rightsJson);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        m = Pattern.compile("\"depkindid\"\\s*:\\s*\"(-?\\d+)\"", Pattern.CASE_INSENSITIVE).matcher(rightsJson);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
