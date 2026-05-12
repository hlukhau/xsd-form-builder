package com.eec.util;

import com.eec.rights.RightsRegistryProvider;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.Set;

/**
 * Просмотр карты PPV (как в приложении карты нарушений): по {@code DATASOURCEKINDCODE} карты —
 * {@code violationDetectedIn:access}, {@code violationDetectedOut:access} или {@code violationDetectedDB:access},
 * с пересечением ключей JSON с активными {@code PPVDEPPERMIS} ({@code REVOKEDATETIME IS NULL}).
 */
public final class PpvViewAccessHelper {

    private static final String SQL_PPV_DSC = ""
            + "SELECT TRIM(TO_CHAR(DATASOURCEKINDCODE)) AS DSC FROM PPV WHERE PPVID = ?";

    private static final String SQL_DEPS = ""
            + "SELECT TRIM(TO_CHAR(DEPID)) AS DEPID FROM PPVDEPPERMIS WHERE PPVID = ? AND REVOKEDATETIME IS NULL";

    private PpvViewAccessHelper() {
    }

    /**
     * @param conn  соединение с БД (по GUID пользователя)
     * @param ppvid идентификатор PPV
     * @param guid  GUID для JSON прав
     */
    public static boolean canViewPpv(Connection conn, long ppvid, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty() || ppvid <= 0) {
            return false;
        }
        guid = guid.trim();

        String datasourceKind = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_PPV_DSC)) {
            ps.setLong(1, ppvid);
            ResultSet rs = ps.executeQuery();
            if (!rs.next()) {
                return false;
            }
            datasourceKind = rs.getString("DSC");
        }

        Set<String> cardDepIds = new HashSet<>();
        try (PreparedStatement ps = conn.prepareStatement(SQL_DEPS)) {
            ps.setLong(1, ppvid);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                String depId = rs.getString("DEPID");
                if (depId != null && !depId.isEmpty()) {
                    cardDepIds.add(depId.trim());
                }
            }
        }
        if (cardDepIds.isEmpty()) {
            return false;
        }

        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
            return false;
        }

        Set<String> userAccessDepIds;
        boolean hasAccessFlag;
        String dsc = datasourceKind != null ? datasourceKind.trim() : "";
        if ("2".equals(dsc)) {
            hasAccessFlag = AccessRightService.hasViolationDetectedOutAccess(rightsJson);
            userAccessDepIds = AccessRightService.violationDetectedOutAccessDepKeys(rightsJson);
        } else if ("3".equals(dsc)) {
            hasAccessFlag = AccessRightService.hasViolationDetectedDBAccess(rightsJson);
            userAccessDepIds = AccessRightService.violationDetectedDBAccessDepKeys(rightsJson);
        } else {
            hasAccessFlag = AccessRightService.hasViolationDetectedInAccess(rightsJson);
            userAccessDepIds = AccessRightService.violationDetectedInAccessDepKeys(rightsJson);
        }
        if (!hasAccessFlag) {
            return false;
        }
        for (String depId : userAccessDepIds) {
            if (cardDepIds.contains(depId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Просмотр карты DPR, связанной с входящей PPV: обычный {@link #canViewPpv} или
     * {@code violationDetectedIn:view} с пересечением DEPID с {@code PPVDEPPERMIS}.
     */
    public static boolean canViewIncomingPpvForLinkedDpr(Connection conn, long ppvid, String guid) throws SQLException {
        if (canViewPpv(conn, ppvid, guid)) {
            return true;
        }
        if (guid == null || guid.trim().isEmpty() || ppvid <= 0) {
            return false;
        }
        guid = guid.trim();
        String dsc = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_PPV_DSC)) {
            ps.setLong(1, ppvid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return false;
                }
                dsc = rs.getString("DSC");
            }
        }
        if (!"1".equals(dsc != null ? dsc.trim() : "")) {
            return false;
        }
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
            return false;
        }
        if (!AccessRightService.hasViolationDetectedInView(rightsJson)) {
            return false;
        }
        Set<String> viewKeys = AccessRightService.violationDetectedInViewDepKeys(rightsJson);
        if (viewKeys.isEmpty()) {
            return false;
        }
        return PpvDepPermisUtil.hasOverlap(conn, ppvid, viewKeys);
    }
}
