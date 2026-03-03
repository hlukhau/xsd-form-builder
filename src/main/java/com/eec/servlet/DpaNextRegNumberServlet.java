package com.eec.servlet;

import com.eec.util.DatabaseUtil;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * GET /api/dpa/next-registration-number?country=BY
 * Возвращает следующий уникальный регистрационный номер для страны в формате XX-DPNNNNN-YY (год — текущий).
 * Нет совпадений с уже существующими в DPA.
 */
public class DpaNextRegNumberServlet extends HttpServlet {

    private static final String SQL_COUNTRY_ID = "SELECT COUNTRYID FROM SESINT.COUNTRY WHERE UPPER(TRIM(COUNTRYCODE)) = ? AND COUNTRYSDATE <= SYSDATE AND COUNTRYEDATE >= SYSDATE";
    /** Максимальный порядковый номер в году для страны; INCIDENTID формата XX-DPNNNNN-YY */
    private static final String SQL_MAX_SERIAL = "SELECT NVL(MAX(TO_NUMBER(REGEXP_SUBSTR(INCIDENTID, 'DP([0-9]{5})', 1, 1, NULL, 1))), 0) + 1 AS NEXTSERIAL FROM SESINT.DPA WHERE ALERTCOUNTRYID = ? AND INCIDENTID LIKE ?";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String countryCode = request.getParameter("country");
        if (countryCode == null || countryCode.trim().isEmpty()) {
            countryCode = "BY";
        }
        countryCode = countryCode.trim().toUpperCase();
        if (countryCode.length() > 2) {
            countryCode = countryCode.substring(0, 2);
        }
        String year2 = String.valueOf(java.time.Year.now().getValue()).substring(2);
        String pattern = countryCode + "-DP%-" + year2;

        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnection();
            Integer countryId = resolveCountryId(conn, countryCode);
            if (countryId == null) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                response.getWriter().print("{\"error\":\"Неизвестный код страны: " + countryCode.replace("\"", "\\\"") + "\"}");
                return;
            }
            int nextSerial;
            try (PreparedStatement ps = conn.prepareStatement(SQL_MAX_SERIAL)) {
                ps.setInt(1, countryId);
                ps.setString(2, pattern);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        nextSerial = rs.getInt(1);
                    } else {
                        nextSerial = 1;
                    }
                }
            }
            String serialStr = String.format("%05d", nextSerial);
            String registrationNumber = countryCode + "-DP" + serialStr + "-" + year2;
            response.setStatus(HttpServletResponse.SC_OK);
            response.getWriter().print("{\"registrationNumber\":\"" + registrationNumber.replace("\\", "\\\\").replace("\"", "\\\"") + "\"}");
        } catch (SQLException e) {
            System.err.println("[DpaNextRegNumberServlet] " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print("{\"error\":\"Ошибка БД\"}");
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static Integer resolveCountryId(Connection conn, String countryCode) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_COUNTRY_ID)) {
            ps.setString(1, countryCode);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt("COUNTRYID");
            }
        }
        return null;
    }
}
