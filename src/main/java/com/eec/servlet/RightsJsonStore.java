package com.eec.servlet;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Общее хранилище JSON прав по GUID (заполняется XsdFormBuilderServlet, читается RightsServlet).
 * Используется для получения department.depid при «Определить доступ» для исходящих.
 */
public final class RightsJsonStore {
    public static final ConcurrentHashMap<String, String> guidMap = new ConcurrentHashMap<>();

    private RightsJsonStore() {}
}
