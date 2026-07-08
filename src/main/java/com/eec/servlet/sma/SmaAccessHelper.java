package com.eec.servlet.sma;

import com.eec.util.SmdViewAccessHelper;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Доступ к карте SMAQ/SMAR по связи с {@code SMD} и подразделениям {@code SMDDEPPERMIS}.
 */
public final class SmaAccessHelper {

    private SmaAccessHelper() {
    }

    public static boolean canViewSmaq(Connection conn, long smaqId, String guid) throws SQLException {
        return SmdViewAccessHelper.canViewSmd(conn, loadSmdidBySmaq(conn, smaqId), guid);
    }

    public static boolean canViewSmar(Connection conn, long smarId, String guid) throws SQLException {
        return SmdViewAccessHelper.canViewSmd(conn, loadSmdidBySmar(conn, smarId), guid);
    }

    private static long loadSmdidBySmaq(Connection conn, long smaqId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SmaDbSupport.SQL_SMDID_BY_SMAQ)) {
            ps.setLong(1, smaqId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    long v = rs.getLong("SMDID");
                    return rs.wasNull() ? 0L : v;
                }
            }
        }
        return 0L;
    }

    private static long loadSmdidBySmar(Connection conn, long smarId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SmaDbSupport.SQL_SMDID_BY_SMAR)) {
            ps.setLong(1, smarId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    long v = rs.getLong("SMDID");
                    return rs.wasNull() ? 0L : v;
                }
            }
        }
        return 0L;
    }
}
