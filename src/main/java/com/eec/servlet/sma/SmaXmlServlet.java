package com.eec.servlet.sma;

import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.Reader;
import java.sql.Clob;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * XML карты SMAQ/SMAR.
 * GET /api/sma/xml/{kind}/{id}?guid=...
 */
public class SmaXmlServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        SmaPathIds ids = SmaServletUtil.parseKindAndId(request.getPathInfo());
        if (ids == null) {
            sendPlainError(response, HttpServletResponse.SC_BAD_REQUEST,
                    "Укажите вид и идентификатор: /api/sma/xml/{smaq|smar}/{id}");
            return;
        }
        String guid = request.getParameter("guid");
        if (guid != null) {
            guid = guid.trim();
        }
        if (guid == null || guid.isEmpty()) {
            sendPlainError(response, HttpServletResponse.SC_BAD_REQUEST, "Укажите guid");
            return;
        }

        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        Connection conn = null;
        Reader reader = null;
        try {
            conn = DatabaseUtil.getConnectionForRequest(request, guid);
            if (!canView(conn, ids.kind, ids.id, guid)) {
                sendPlainError(response, HttpServletResponse.SC_FORBIDDEN, "Нет доступа к просмотру карты.");
                return;
            }

            String sql = ids.kind == SmaCardKind.SMAQ
                    ? SmaDbSupport.SQL_SMAQ_XML
                    : SmaDbSupport.SQL_SMAR_XML;
            String col = ids.kind == SmaCardKind.SMAQ ? "SMAQXMLBODY" : "SMARXMLBODY";

            response.setContentType("application/xml;charset=UTF-8");
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setLong(1, ids.id);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        sendPlainError(response, HttpServletResponse.SC_NOT_FOUND,
                                "XML для " + ids.kind + " ID " + ids.id + " не найден.");
                        return;
                    }
                    Clob clob = rs.getClob(col);
                    if (clob == null) {
                        response.getWriter().write("<?xml version=\"1.0\" encoding=\"UTF-8\"?><empty/>");
                        return;
                    }
                    reader = clob.getCharacterStream();
                    char[] buf = new char[8192];
                    int n;
                    while ((n = reader.read(buf)) >= 0) {
                        response.getWriter().write(buf, 0, n);
                    }
                }
            }
        } catch (SQLException e) {
            sendPlainError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Ошибка БД: " + e.getMessage());
        } finally {
            if (reader != null) {
                try {
                    reader.close();
                } catch (IOException ignored) {
                }
            }
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static boolean canView(Connection conn, SmaCardKind kind, long id, String guid) throws SQLException {
        return kind == SmaCardKind.SMAQ
                ? SmaAccessHelper.canViewSmaq(conn, id, guid)
                : SmaAccessHelper.canViewSmar(conn, id, guid);
    }

    private static void sendPlainError(HttpServletResponse response, int status, String msg) throws IOException {
        response.setStatus(status);
        response.setContentType("text/plain;charset=UTF-8");
        response.getWriter().print(msg);
    }
}
