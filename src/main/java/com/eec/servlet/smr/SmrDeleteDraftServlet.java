package com.eec.servlet.smr;

import com.eec.util.DatabaseUtil;
import com.eec.util.SmrCreateSupport;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Удаление черновика исходящей SMR (одна транзакция): SMRSTATUSHIST, SMRRESOLUTION, SMRACTOR, SMRXML, SMR.
 * POST /api/smr/delete-draft — тело JSON: {@code guid}, {@code smrId}.
 */
public class SmrDeleteDraftServlet extends HttpServlet {

    private static final String SQL_DELETE_HIST = "DELETE FROM SMRSTATUSHIST WHERE SMRID = ?";
    private static final String SQL_DELETE_RESOLUTION = "DELETE FROM SMRRESOLUTION WHERE SMRID = ?";
    private static final String SQL_DELETE_ACTOR = "DELETE FROM SMRACTOR WHERE SMRID = ?";
    private static final String SQL_DELETE_XML = "DELETE FROM SMRXML WHERE SMRID = ?";
    private static final String SQL_DELETE_SMR = "DELETE FROM SMR WHERE SMRID = ?";

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String body = readBody(request);
        String guid = jsonStringField(body, "guid");
        String smrIdStr = jsonStringField(body, "smrId");
        if (guid == null || guid.isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid в теле запроса");
            return;
        }
        if (smrIdStr == null || smrIdStr.isEmpty()) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите smrId в теле запроса");
            return;
        }
        long smrId;
        try {
            smrId = Long.parseLong(smrIdStr.trim());
        } catch (NumberFormatException e) {
            sendErr(response, HttpServletResponse.SC_BAD_REQUEST, "Некорректный smrId");
            return;
        }

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            SmrCreateSupport.GateResult gate = SmrCreateSupport.evaluateDeleteDraftGate(conn, smrId, guid);
            if (!gate.allowed) {
                sendErr(response, HttpServletResponse.SC_FORBIDDEN,
                        gate.reason != null ? gate.reason : "Удаление черновика недоступно");
                return;
            }

            conn.setAutoCommit(false);
            try {
                execDelete(conn, SQL_DELETE_HIST, smrId);
                execDelete(conn, SQL_DELETE_RESOLUTION, smrId);
                execDeleteOptional(conn, SQL_DELETE_ACTOR, smrId);
                execDelete(conn, SQL_DELETE_XML, smrId);
                try (PreparedStatement ps = conn.prepareStatement(SQL_DELETE_SMR)) {
                    ps.setLong(1, smrId);
                    int n = ps.executeUpdate();
                    if (n != 1) {
                        throw new SQLException("DELETE DPR: ожидалась одна удалённая строка, удалено " + n);
                    }
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

    private static void execDelete(Connection conn, String sql, long smrId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, smrId);
            ps.executeUpdate();
        }
    }

    /** Таблица может отсутствовать в части стендов — тогда пропускаем (ORA-00942). */
    private static void execDeleteOptional(Connection conn, String sql, long smrId) throws SQLException {
        try {
            execDelete(conn, sql, smrId);
        } catch (SQLException e) {
            String m = e.getMessage() != null ? e.getMessage() : "";
            if (m.contains("ORA-00942") || m.toLowerCase().contains("does not exist")) {
                return;
            }
            throw e;
        }
    }

    private static String readBody(HttpServletRequest request) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = request.getReader()) {
            char[] buf = new char[8192];
            int n;
            while ((n = r.read(buf)) >= 0) {
                sb.append(buf, 0, n);
            }
        }
        return sb.toString();
    }

    private static String jsonStringField(String json, String field) {
        if (json == null) {
            return null;
        }
        Pattern p = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher m = p.matcher(json);
        if (m.find()) {
            return m.group(1);
        }
        Pattern pNum = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*(-?\\d+)");
        Matcher m2 = pNum.matcher(json);
        if (m2.find()) {
            return m2.group(1);
        }
        return null;
    }

    private static void sendErr(HttpServletResponse response, int status, String msg) throws IOException {
        response.setStatus(status);
        PrintWriter out = response.getWriter();
        out.print("{\"error\":" + quote(msg) + "}");
        out.flush();
    }

    private static String quote(String s) {
        if (s == null) {
            return "null";
        }
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }
}
