package com.eec.util;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Доступ к карте DPR: по связи {@code DPR.PPVID} (предпочтительно) или по {@code INCIDENTID} → PPV.
 * <ul>
 *   <li>входящая DPR + исходящая PPV — {@link PpvViewAccessHelper#canViewOutgoingPpvForLinkedIncomingDpr}
 *       ({@code violationDetectedOut:view} ∩ PPVDEPPERMIS);</li>
 *   <li>входящая PPV — {@link PpvViewAccessHelper#canViewIncomingPpvForLinkedDpr};</li>
 *   <li>прочие — {@link PpvViewAccessHelper#canViewPpv}.</li>
 * </ul>
 */
public final class DprAccessHelper {

    private static final String SQL_PPVID_BY_DPR = "SELECT PPVID FROM DPR WHERE DPRID = ?";

    private static final String SQL_DPR_DSC = ""
            + "SELECT TRIM(TO_CHAR(DATASOURCEKINDCODE)) AS DSC FROM DPR WHERE DPRID = ?";

    private static final String SQL_INCIDENT = "SELECT TRIM(vw.INCIDENTID) AS INCIDENTID FROM VW_DPR vw WHERE vw.DPRID = ?";

    private static final String SQL_PPV_BY_INCIDENT = ""
            + "SELECT p.PPVID FROM PPV p WHERE TRIM(p.INCIDENTID) = TRIM(?) AND ROWNUM = 1";

    private static final String SQL_PPV_DSC = "SELECT TRIM(TO_CHAR(DATASOURCEKINDCODE)) AS DSC FROM PPV WHERE PPVID = ?";

    private DprAccessHelper() {
    }

    /**
     * @param conn   соединение с БД (уже по GUID пользователя)
     * @param dprId  идентификатор DPR
     * @param guid   GUID для JSON прав; null — нет доступа
     */
    public static boolean canViewDpr(Connection conn, long dprId, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty()) {
            return false;
        }
        guid = guid.trim();

        long ppvid = 0L;
        try (PreparedStatement ps = conn.prepareStatement(SQL_PPVID_BY_DPR)) {
            ps.setLong(1, dprId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    long v = rs.getLong("PPVID");
                    if (!rs.wasNull() && v > 0) {
                        ppvid = v;
                    }
                }
            }
        } catch (SQLException e) {
            String m = e.getMessage() != null ? e.getMessage() : "";
            if (!m.contains("ORA-00904") && !m.contains("invalid identifier")) {
                throw e;
            }
            ppvid = 0L;
        }

        if (ppvid > 0) {
            return canViewDprForPpvid(conn, dprId, ppvid, guid);
        }

        String incidentId = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_INCIDENT)) {
            ps.setLong(1, dprId);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                incidentId = rs.getString("INCIDENTID");
            }
        }
        if (incidentId == null || incidentId.isEmpty()) {
            return false;
        }

        long ppvidByInc = 0L;
        try (PreparedStatement ps = conn.prepareStatement(SQL_PPV_BY_INCIDENT)) {
            ps.setString(1, incidentId);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                ppvidByInc = rs.getLong("PPVID");
            }
        }
        if (ppvidByInc <= 0) {
            return false;
        }

        return canViewDprForPpvid(conn, dprId, ppvidByInc, guid);
    }

    private static boolean canViewDprForPpvid(Connection conn, long dprId, long ppvid, String guid)
            throws SQLException {
        String ppvDsc = loadPpvDatasourceKind(conn, ppvid);
        if (ppvDsc == null) {
            return false;
        }
        String dprDsc = loadDprDatasourceKind(conn, dprId);
        if ("1".equals(dprDsc) && "2".equals(ppvDsc)) {
            return PpvViewAccessHelper.canViewOutgoingPpvForLinkedIncomingDpr(conn, ppvid, guid);
        }
        if ("1".equals(ppvDsc)) {
            return PpvViewAccessHelper.canViewIncomingPpvForLinkedDpr(conn, ppvid, guid);
        }
        return PpvViewAccessHelper.canViewPpv(conn, ppvid, guid);
    }

    private static String loadPpvDatasourceKind(Connection conn, long ppvid) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_PPV_DSC)) {
            ps.setLong(1, ppvid);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getString("DSC");
                }
            }
        }
        return null;
    }

    private static String loadDprDatasourceKind(Connection conn, long dprId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_DPR_DSC)) {
            ps.setLong(1, dprId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getString("DSC");
                }
            }
        }
        return null;
    }
}
