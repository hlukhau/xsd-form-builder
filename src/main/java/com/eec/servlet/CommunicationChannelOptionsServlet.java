package com.eec.servlet;

import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.CommunicationChannelOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * Сервлет для получения списка видов каналов связи (SESINT.COMMUNICATIONCHANNEL).
 * GET /api/communication-channels/options
 */
public class CommunicationChannelOptionsServlet extends HttpServlet {

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[CommunicationChannelOptionsServlet] Initialized");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        PrintWriter out = null;
        try {
            out = response.getWriter();
        } catch (IOException e) {
            System.err.println("[CommunicationChannelOptionsServlet] Cannot get writer: " + e.getMessage());
            return;
        }

        try {
            DictionaryInitializerListener loader = DictionaryInitializerListener.getInstance();
            if (loader != null) loader.ensureCommunicationChannelsLoaded(request.getParameter("guid"));

            List<CommunicationChannelOption> list = DictionaryCache.getCommunicationChannelsList();
            out.print("[");
            boolean first = true;
            for (CommunicationChannelOption option : list) {
                if (!first) out.print(",");
                first = false;
                out.print("{\"code\":\"" + escapeJson(option.code) + "\",\"name\":\"" + escapeJson(option.name) + "\"}");
            }
            out.print("]");
        } catch (Exception e) {
            System.err.println("[CommunicationChannelOptionsServlet] ERROR: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            if (out != null) {
                out.print("{\"error\":\"Ошибка: " + escapeJson(e.getMessage()) + "\"}");
            }
        } finally {
            if (out != null) out.close();
        }
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ");
    }
}
