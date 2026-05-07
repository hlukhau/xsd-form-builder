package com.eec.servlet;

import com.eec.rights.RightsRegistryProvider;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * GET /api/rights?guid=1 — возвращает JSON прав доступа для данного GUID (из карты, сохранённой при открытии формы).
 * В JSON есть department.depid — ЦГЭ специалиста, создавшего карту; используется для списка доступа по умолчанию (исходящие).
 */
public class RightsServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        String guid = request.getParameter("guid");
        if (guid == null || guid.trim().isEmpty()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().print("{\"error\":\"Параметр guid обязателен\"}");
            return;
        }
        guid = guid.trim();
        String json = RightsRegistryProvider.get().getRightsJson(guid);
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        if (json == null || json.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            response.getWriter().print("{\"error\":\"GUID не найден\"}");
            return;
        }
        response.getWriter().print(json);
    }
}
