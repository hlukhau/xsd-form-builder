package com.eec.servlet.sma;

import com.eec.util.DatabaseUtil;
import com.eec.util.SmaCreateSupport;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * Удаление черновика исходящей SMAQ/SMAR.
 * POST /api/sma/delete-draft
 */
public class SmaDeleteDraftServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String body = SmaServletUtil.readBody(request);
        String guid = SmaServletUtil.jsonStringField(body, "guid");
        SmaCardKind kind = SmaServletUtil.parseKindFromJson(body);
        String idStr = SmaServletUtil.jsonStringField(body, "id");
        if (guid == null || guid.isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid в теле запроса");
            return;
        }
        if (kind == null) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите kind: smaq или smar");
            return;
        }
        if (idStr == null || idStr.isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите id в теле запроса");
            return;
        }
        long cardId;
        try {
            cardId = Long.parseLong(idStr.trim());
        } catch (NumberFormatException e) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный id");
            return;
        }

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            SmaCreateSupport.GateResult gate = kind == SmaCardKind.SMAQ
                    ? SmaCreateSupport.evaluateSmaqDeleteGate(conn, cardId, guid)
                    : SmaCreateSupport.evaluateSmarDeleteGate(conn, cardId, guid);
            if (!gate.allowed) {
                sendErr(response, HttpServletResponse.SC_FORBIDDEN,
                        gate.reason != null ? gate.reason : "Удаление черновика недоступно");
                return;
            }

            conn.setAutoCommit(false);
            try {
                if (kind == SmaCardKind.SMAQ) {
                    execDelete(conn, "DELETE FROM SMAQSTATUSHIST WHERE SMAQID = ?", cardId);
                    execDelete(conn, "DELETE FROM SMAQXML WHERE SMAQID = ?", cardId);
                    execDelete(conn, "DELETE FROM SMAQ WHERE SMAQID = ?", cardId, true);
                } else {
                    execDelete(conn, "DELETE FROM SMARSTATUSHIST WHERE SMARID = ?", cardId);
                    execDelete(conn, "DELETE FROM SMARXML WHERE SMARID = ?", cardId);
                    execDelete(conn, "DELETE FROM SMAR WHERE SMARID = ?", cardId, true);
                }
                conn.commit();
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(true);
            }

            PrintWriter out = response.getWriter();
            response.setStatus(HttpServletResponse.SC_OK);
            out.print("{\"ok\":true}");
            out.flush();
        } catch (SQLException e) {
            try {
                if (conn != null && !conn.getAutoCommit()) {
                    conn.rollback();
                }
            } catch (SQLException ignored) {
            }
            sendErr(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static void execDelete(Connection conn, String sql, long id) throws SQLException {
        execDelete(conn, sql, id, false);
    }

    private static void execDelete(Connection conn, String sql, long id, boolean requireOneRow) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            int n = ps.executeUpdate();
            if (requireOneRow && n != 1) {
                throw new SQLException("DELETE: ожидалась одна удалённая строка, удалено " + n);
            }
        }
    }

    private static void sendErr(HttpServletResponse response, int status, String msg) throws IOException {
        response.setStatus(status);
        PrintWriter out = response.getWriter();
        out.print("{\"error\":" + SmaServletUtil.quote(msg) + "}");
        out.flush();
    }
}
