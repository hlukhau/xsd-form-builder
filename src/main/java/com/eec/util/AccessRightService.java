package com.eec.util;

/**
 * Проверка прав доступа (внутренняя карта с правами).
 * Пока все методы возвращают true; реализация — отдельно.
 * Параметр id может быть null.
 */
public final class AccessRightService {

    private AccessRightService() {
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
     * Управление доступом к входящим сведениям — dangerousProductIn:access.
     */
    public static boolean hasDangerousProductInAccess(String id) {
        // TODO: проверка по внутренней карте прав
        return true;
    }

    /**
     * Управление доступом к исходящим сведениям — dangerousProductOut:access.
     */
    public static boolean hasDangerousProductOutAccess(String id) {
        // TODO: проверка по внутренней карте прав
        return true;
    }

    /**
     * Управление доступом к сведениям из БД ЕЭК — dangerousProductDB:access.
     */
    public static boolean hasDangerousProductDBAccess(String id) {
        // TODO: проверка по внутренней карте прав
        return true;
    }
}
