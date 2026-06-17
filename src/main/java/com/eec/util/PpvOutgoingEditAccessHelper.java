package com.eec.util;

import com.eec.rights.RightsRegistryProvider;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Set;

/**
 * Редактирование исходящей PPV: {@code violationDetectedOut:edit} ∩ {@code PPVDEPPERMIS},
 * {@code DATASOURCEKINDCODE=2}, статус {@code DRAFT} или {@code NEW}.
 */
public final class PpvOutgoingEditAccessHelper {

    private static final String SQL_PPV_ROW = ""
            + "SELECT TRIM(TO_CHAR(p.DATASOURCEKINDCODE)) AS DSC, "
            + "TRIM(UPPER(NVL(st.PPVSTATUSCODE, ''))) AS STCODE "
            + "FROM PPV p "
            + "LEFT JOIN PPVSTATUS st ON st.PPVSTATUSID = p.PPVSTATUSID "
            + "WHERE p.PPVID = ?";

    public static final class GateResult {
        public final boolean allowed;
        public final String reason;

        private GateResult(boolean allowed, String reason) {
            this.allowed = allowed;
            this.reason = reason;
        }

        public static GateResult ok() {
            return new GateResult(true, null);
        }

        public static GateResult denied(String reason) {
            return new GateResult(false, reason);
        }
    }

    private PpvOutgoingEditAccessHelper() {
    }

    /**
     * @param conn  соединение с БД
     * @param ppvid идентификатор PPV
     * @param guid  GUID пользователя
     */
    public static GateResult evaluateEditGate(Connection conn, long ppvid, String guid) throws SQLException {
        if (guid == null || guid.trim().isEmpty() || ppvid <= 0) {
            return GateResult.denied("Не заданы PPVID или guid");
        }
        guid = guid.trim();
        String dsc = null;
        String statusCode = null;
        try (PreparedStatement ps = conn.prepareStatement(SQL_PPV_ROW)) {
            ps.setLong(1, ppvid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return GateResult.denied("Карта PPV не найдена");
                }
                dsc = rs.getString("DSC");
                statusCode = rs.getString("STCODE");
            }
        }
        if (!"2".equals(dsc != null ? dsc.trim() : "")) {
            return GateResult.denied("Редактирование доступно только для исходящей карты (DATASOURCEKINDCODE=2)");
        }
        if (statusCode == null || statusCode.isEmpty()) {
            return GateResult.denied("Не определён код статуса карты в справочнике PPVSTATUS");
        }
        if (!"DRAFT".equals(statusCode) && !"NEW".equals(statusCode)) {
            return GateResult.denied(
                    "Редактирование доступно только в статусах «Черновик» (DRAFT) и «Новое» (NEW)");
        }
        String rightsJson = RightsRegistryProvider.get().getRightsJson(guid);
        if (rightsJson == null || rightsJson.isEmpty()) {
            return GateResult.denied("Права по GUID не найдены");
        }
        if (!AccessRightService.hasViolationDetectedOutEdit(rightsJson)) {
            return GateResult.denied("Нет права violationDetectedOut:edit");
        }
        Set<String> editKeys = AccessRightService.violationDetectedOutEditDepKeys(rightsJson);
        if (editKeys.isEmpty()) {
            return GateResult.denied("В карте прав не заданы подразделения для violationDetectedOut:edit");
        }
        if (!PpvDepPermisUtil.hasOverlap(conn, ppvid, editKeys)) {
            return GateResult.denied(
                    "Право violationDetectedOut:edit не распространяется ни на одно подразделение "
                            + "из активного доступа к карте (PPVDEPPERMIS)");
        }
        return GateResult.ok();
    }
}
