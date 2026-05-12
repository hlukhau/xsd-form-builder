package com.eec.util;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Карта DPR связана с PPV по {@code INCIDENTID} → та же проверка доступа, что и при просмотре связанной PPV:
 * {@link PpvViewAccessHelper#canViewPpv(Connection, long, String)}.
 */
public final class DprAccessHelper {

    private static final String SQL_INCIDENT = "SELECT TRIM(vw.INCIDENTID) AS INCIDENTID FROM VW_DPR vw WHERE vw.DPRID = ?";

    private static final String SQL_PPV_BY_INCIDENT = ""
            + "SELECT p.PPVID FROM PPV p WHERE TRIM(p.INCIDENTID) = TRIM(?) AND ROWNUM = 1";

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

        long ppvid = 0L;
        try (PreparedStatement ps = conn.prepareStatement(SQL_PPV_BY_INCIDENT)) {
            ps.setString(1, incidentId);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                ppvid = rs.getLong("PPVID");
            }
        }
        if (ppvid <= 0) {
            return false;
        }

        return PpvViewAccessHelper.canViewPpv(conn, ppvid, guid);
    }
}
