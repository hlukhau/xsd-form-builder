package com.eec.servlet;

import com.eec.util.DatabaseUtil;
import com.eec.util.DictionaryCache;
import com.eec.util.DictionaryCache.CountryOption;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/**
 * Сервлет для получения списка стран для выпадающего списка.
 * GET /api/countries/options — все актуальные страны (кеш).
 * GET /api/countries/options?group=EAUE — страны ЕАЭС (COUNTRYGRSET.COUNTRYGRCODE = 'EAUE').
 */
public class CountriesOptionsServlet extends HttpServlet {

    private static final String SQL_EAUE = ""
            + "SELECT TRIM(c.COUNTRYCODE) AS COUNTRYCODE, TRIM(c.COUNTRYNAME) AS COUNTRYNAME "
            + "FROM COUNTRY c "
            + "JOIN COUNTRYGRSET cg ON cg.COUNTRYID = c.COUNTRYID "
            + "  AND cg.COUNTRYGRCODE = 'EAUE' AND cg.COUNTRYGRSETACTFL = 1 "
            + "WHERE c.COUNTRYSDATE <= SYSDATE AND c.COUNTRYEDATE >= SYSDATE "
            + "ORDER BY c.COUNTRYNAME";

    @Override
    public void init() throws ServletException {
        super.init();
        System.out.println("[CountriesOptionsServlet] Initialized");
        System.out.println("[CountriesOptionsServlet] Ready to serve countries from cache");
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        String group = request.getParameter("group");
        boolean eaueOnly = group != null && "EAUE".equalsIgnoreCase(group.trim());

        System.out.println("[CountriesOptionsServlet] Loading countries"
                + (eaueOnly ? " (EAUE group)" : " from cache") + "...");

        PrintWriter out;
        try {
            out = response.getWriter();
        } catch (IOException e) {
            System.err.println("[CountriesOptionsServlet] Cannot get writer: " + e.getMessage());
            return;
        }

        try {
            List<CountryOption> countries;
            if (eaueOnly) {
                countries = loadEaueCountries(request.getParameter("guid"));
            } else {
                DictionaryInitializerListener loader = DictionaryInitializerListener.getInstance();
                if (loader != null) {
                    loader.ensureCountriesLoaded(request.getParameter("guid"));
                }
                countries = DictionaryCache.getCountriesList();
            }

            writeCountryOptionsJson(out, countries);
            System.out.println("[CountriesOptionsServlet] Loaded " + countries.size() + " countries"
                    + (eaueOnly ? " (EAUE)" : " from cache"));

        } catch (Exception e) {
            System.err.println("[CountriesOptionsServlet] ERROR: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            out.print("{\"error\":\"Ошибка: " + escapeJson(e.getMessage()) + "\"}");
        } finally {
            out.close();
        }
    }

    private static List<CountryOption> loadEaueCountries(String guid) throws SQLException {
        Connection conn = null;
        try {
            conn = DatabaseUtil.getConnectionForGuid(guid);
            try (PreparedStatement ps = conn.prepareStatement(SQL_EAUE);
                 ResultSet rs = ps.executeQuery()) {
                List<CountryOption> countries = new ArrayList<>();
                while (rs.next()) {
                    String code = rs.getString("COUNTRYCODE");
                    String name = rs.getString("COUNTRYNAME");
                    if (code != null && !code.trim().isEmpty()) {
                        countries.add(new CountryOption(code.trim(), name != null ? name.trim() : ""));
                    }
                }
                return countries;
            }
        } finally {
            DatabaseUtil.closeConnection(conn);
        }
    }

    private static void writeCountryOptionsJson(PrintWriter out, List<CountryOption> countries) {
        out.print("[");
        boolean first = true;
        for (CountryOption country : countries) {
            if (!first) {
                out.print(",");
            }
            first = false;
            String code = country.code != null ? country.code : "";
            String name = country.name != null ? country.name : "";
            out.print("{\"code\":\"" + escapeJson(code) + "\",\"name\":\"" + escapeJson(name) + "\"}");
        }
        out.print("]");
    }

    private static String escapeJson(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", " ")
                .replace("\r", " ");
    }
}
