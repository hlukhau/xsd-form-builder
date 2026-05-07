package com.eec.util;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;

/**
 * Дефолтные записи {@code PPVDEPPERMIS} для входящих PPV и данных ЕЭК (по DEPCODE в {@code TB_DEP}).
 * Для каждого департамента из перечня вставка только при отсутствии активной записи
 * ({@code REVOKEDATETIME IS NULL}) с тем же {@code DEPID}.
 */
public final class PpvIncomingDefaultDepPermis {

    /** Те же коды, что при первом сохранении в {@link com.eec.servlet.ppv.PpvSaveServlet}. */
    private static final String[] DEFAULT_DEP_CODES =
            { "006", "101", "201", "301", "401", "501", "601", "700" };

    private static final String SQL_INSERT_PPVDEPPERMIS =
            "INSERT INTO PPVDEPPERMIS (PPVID, DEPID, GRANTDATETIME) VALUES (?, ?, SYSDATE)";
    private static final String SQL_EXISTS_DEP = "SELECT 1 FROM TB_DEP WHERE DEPID = ?";
    private static final String SQL_DEPID_BY_DEPCODE = "SELECT DEPID FROM TB_DEP WHERE TRIM(DEPCODE) = ? AND ROWNUM = 1";
    private static final String SQL_EXISTS_ACTIVE_PPVDEPPERMIS_PAIR = ""
            + "SELECT 1 FROM PPVDEPPERMIS WHERE PPVID = ? AND DEPID = ? AND REVOKEDATETIME IS NULL";

    private PpvIncomingDefaultDepPermis() {
    }

    /**
     * Добавляет только отсутствующие активные строки доступа (по департаментам из перечня DEPCODE).
     */
    public static void seedDefaultsIfMissing(Connection conn, long ppvid) throws SQLException {
        for (String depCode : DEFAULT_DEP_CODES) {
            String depId = resolveDepIdByDepCode(conn, depCode);
            if (depId == null || depId.trim().isEmpty()) {
                System.out.println("[PpvIncomingDefaultDepPermis] DEPCODE=" + depCode + " not found in TB_DEP, skip PPVDEPPERMIS");
                continue;
            }
            if (!existsDepIdString(conn, depId)) {
                continue;
            }
            if (ppvDepPermisActiveExists(conn, ppvid, depId)) {
                continue;
            }
            insertPpvDepPermisRow(conn, ppvid, depId);
            System.out.println("[PpvIncomingDefaultDepPermis] PPVID=" + ppvid + " added PPVDEPPERMIS DEPID=" + depId + " (DEPCODE=" + depCode + ")");
        }
    }

    private static String resolveDepIdByDepCode(Connection conn, String depCode) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_DEPID_BY_DEPCODE)) {
            ps.setString(1, depCode.trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                return rs.getString(1);
            }
        }
    }

    private static boolean existsDepIdString(Connection conn, String depId) throws SQLException {
        if (depId == null || depId.trim().isEmpty()) {
            return false;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_EXISTS_DEP)) {
            bindDepIdParameter(ps, 1, depId.trim());
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static boolean ppvDepPermisActiveExists(Connection conn, long ppvid, String depId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_EXISTS_ACTIVE_PPVDEPPERMIS_PAIR)) {
            ps.setLong(1, ppvid);
            bindDepIdParameter(ps, 2, depId.trim());
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static void insertPpvDepPermisRow(Connection conn, long ppvid, String depId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_PPVDEPPERMIS)) {
            ps.setLong(1, ppvid);
            bindDepIdParameter(ps, 2, depId.trim());
            ps.executeUpdate();
        }
    }

    private static void bindDepIdParameter(PreparedStatement ps, int index, String depId) throws SQLException {
        if (depId == null || depId.trim().isEmpty()) {
            ps.setNull(index, Types.VARCHAR);
            return;
        }
        String t = depId.trim();
        try {
            long n = Long.parseLong(t);
            ps.setLong(index, n);
        } catch (NumberFormatException e) {
            ps.setString(index, t);
        }
    }
}
