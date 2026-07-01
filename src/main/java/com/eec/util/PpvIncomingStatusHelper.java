package com.eec.util;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;

/**
 * Статусы входящей PPV ({@code DATASOURCEKINDCODE = 1}) из справочника {@code PPVSTATUS}.
 */
public final class PpvIncomingStatusHelper {

    public static final String DATASOURCE_INCOMING = "1";

    private static final String SQL_RESOLVE = ""
            + "SELECT PPVSTATUSID FROM PPVSTATUS "
            + "WHERE TRIM(UPPER(PPVSTATUSCODE)) = TRIM(UPPER(?)) "
            + "AND TRIM(TO_CHAR(DATASOURCEKINDCODE)) = ? "
            + "AND PPVSTATUSACTFL = 1 AND ROWNUM = 1";

    private static final String SQL_CURRENT_STATUS = "SELECT PPVSTATUSID FROM PPV WHERE PPVID = ?";

    /** Как в {@code PpvStatusChangeServlet.applyIncomingCompleteToProcessed}: только PPVID + ожидаемый статус. */
    private static final String SQL_UPDATE_PROCESSING_TO_PROCESSED = ""
            + "UPDATE PPV SET PPVSTATUSID = ?, MODIFICATIONDATETIME = SYSDATE "
            + "WHERE PPVID = ? AND PPVSTATUSID = ?";

    private static final String SQL_INSERT_HIST = ""
            + "INSERT INTO PPVSTATUSHIST (PPVID, PPVSTATUSID, PPVSTATUSDATETIME, USERID) "
            + "VALUES (?, ?, SYSDATE, ?)";

    private PpvIncomingStatusHelper() {
    }

    /** @return {@code PPVSTATUSID} или {@code null}, если строка справочника не найдена */
    public static Integer resolveIncomingStatusId(Connection conn, String ppvStatusCode) throws SQLException {
        if (ppvStatusCode == null || ppvStatusCode.trim().isEmpty()) {
            return null;
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_RESOLVE)) {
            ps.setString(1, ppvStatusCode.trim());
            ps.setString(2, DATASOURCE_INCOMING);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                int id = rs.getInt("PPVSTATUSID");
                return rs.wasNull() ? null : id;
            }
        }
    }

    /**
     * При направлении исходящей DPR: если связанная входящая PPV в статусе PROCESSING,
     * переводит её в PROCESSED и пишет {@code PPVSTATUSHIST}.
     *
     * @return {@code true}, если переход выполнен; {@code false}, если PPV не в PROCESSING (шаг пропускается)
     */
    public static boolean applyProcessingToProcessedIfApplicable(Connection conn, long ppvid, Integer userId)
            throws SQLException {
        if (ppvid <= 0) {
            return false;
        }
        Integer processingId = resolveIncomingStatusId(conn, "PROCESSING");
        Integer processedId = resolveIncomingStatusId(conn, "PROCESSED");
        if (processingId == null) {
            throw new SQLException(
                    "В справочнике PPVSTATUS не найден статус PROCESSING для входящих (DATASOURCEKINDCODE=1)");
        }
        if (processedId == null) {
            throw new SQLException(
                    "В справочнике PPVSTATUS не найден статус PROCESSED для входящих (DATASOURCEKINDCODE=1)");
        }
        Integer currentStatusId = loadCurrentStatusId(conn, ppvid);
        if (currentStatusId == null || !currentStatusId.equals(processingId)) {
            return false;
        }
        int updated;
        try (PreparedStatement ps = conn.prepareStatement(SQL_UPDATE_PROCESSING_TO_PROCESSED)) {
            ps.setInt(1, processedId);
            ps.setLong(2, ppvid);
            ps.setInt(3, processingId);
            updated = ps.executeUpdate();
        }
        if (updated == 0) {
            throw new SQLException(
                    "Не удалось перевести связанную карту PPV (PPVID=" + ppvid + ") из «В обработке» в «Обработано»");
        }
        try (PreparedStatement ps = conn.prepareStatement(SQL_INSERT_HIST)) {
            ps.setLong(1, ppvid);
            ps.setInt(2, processedId);
            if (userId != null) {
                ps.setInt(3, userId);
            } else {
                ps.setNull(3, Types.INTEGER);
            }
            ps.executeUpdate();
        }
        return true;
    }

    private static Integer loadCurrentStatusId(Connection conn, long ppvid) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(SQL_CURRENT_STATUS)) {
            ps.setLong(1, ppvid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                int id = rs.getInt("PPVSTATUSID");
                return rs.wasNull() ? null : id;
            }
        }
    }
}
