package com.eec.servlet.smd;

import java.sql.SQLException;

/**
 * Общие SQL и проверки для сервлетов SMD.
 */
final class SmdDbSupport {

    /** Только колонки VW_SMD — без join в запросе (все поля шапки есть в представлении). */
    static final String SQL_METADATA_VW = ""
            + "SELECT vw.DOCCOUNTRYNAME, vw.DOCCOUNTRYID, "
            + "       CAST(NULL AS VARCHAR2(10)) AS DOCCOUNTRYCODE, "
            + "       vw.DOCID, vw.DOCCREATIONDATE, vw.SMDVERSION, "
            + "       TRIM(TO_CHAR(vw.DATASOURCEKINDCODE)) AS DATASOURCEKINDCODE, "
            + "       CAST(NULL AS VARCHAR2(4000)) AS DATASOURCEKINDNAME, "
            + "       vw.CREATIONDATETIME, vw.MODIFICATIONDATETIME, "
            + "       vw.SMDSTATUSNAME, TRIM(UPPER(NVL(vw.SMDSTATUSCODE, ''))) AS SMDSTATUSCODE, "
            + "       vw.SMASTATUSDESC, vw.SMRSTATUSDESC, "
            + "       vw.MESSAGENAME, TRIM(vw.MESSAGECODE) AS MESSAGECODE "
            + "FROM VW_SMD vw WHERE vw.SMDID = ?";

    /** То же, если синоним VW_SMD не создан, но есть SELECT на SESINT.VW_SMD. */
    static final String SQL_METADATA_VW_SESINT = ""
            + "SELECT vw.DOCCOUNTRYNAME, vw.DOCCOUNTRYID, "
            + "       CAST(NULL AS VARCHAR2(10)) AS DOCCOUNTRYCODE, "
            + "       vw.DOCID, vw.DOCCREATIONDATE, vw.SMDVERSION, "
            + "       TRIM(TO_CHAR(vw.DATASOURCEKINDCODE)) AS DATASOURCEKINDCODE, "
            + "       CAST(NULL AS VARCHAR2(4000)) AS DATASOURCEKINDNAME, "
            + "       vw.CREATIONDATETIME, vw.MODIFICATIONDATETIME, "
            + "       vw.SMDSTATUSNAME, TRIM(UPPER(NVL(vw.SMDSTATUSCODE, ''))) AS SMDSTATUSCODE, "
            + "       vw.SMASTATUSDESC, vw.SMRSTATUSDESC, "
            + "       vw.MESSAGENAME, TRIM(vw.MESSAGECODE) AS MESSAGECODE "
            + "FROM SESINT.VW_SMD vw WHERE vw.SMDID = ?";

    /** Резерв: таблица SMD (без MESSAGE — наименование вида сообщения может быть пустым). */
    static final String SQL_METADATA_SMD = ""
            + "SELECT t1.COUNTRYNAME AS DOCCOUNTRYNAME, t0.DOCCOUNTRYID, t1.COUNTRYCODE AS DOCCOUNTRYCODE, "
            + "       t0.DOCID, t0.DOCCREATIONDATE, t0.SMDVERSION, "
            + "       TRIM(TO_CHAR(t0.DATASOURCEKINDCODE)) AS DATASOURCEKINDCODE, dk.DATASOURCEKINDNAME, "
            + "       t0.CREATIONDATETIME, t0.MODIFICATIONDATETIME, "
            + "       st.SMDSTATUSNAME, TRIM(UPPER(NVL(st.SMDSTATUSCODE, ''))) AS SMDSTATUSCODE, "
            + "       CAST(NULL AS VARCHAR2(4000)) AS SMASTATUSDESC, "
            + "       CAST(NULL AS VARCHAR2(4000)) AS SMRSTATUSDESC, "
            + "       CAST(NULL AS VARCHAR2(4000)) AS MESSAGENAME, "
            + "       TRIM(t0.MESSAGECODE) AS MESSAGECODE "
            + "FROM SMD t0 "
            + "LEFT JOIN COUNTRY t1 ON t0.DOCCOUNTRYID = t1.COUNTRYID "
            + "LEFT JOIN SMDSTATUS st ON t0.SMDSTATUSID = st.SMDSTATUSID "
            + "LEFT JOIN DATASOURCEKIND dk ON t0.DATASOURCEKINDCODE = dk.DATASOURCEKINDCODE "
            + "WHERE t0.SMDID = ?";

    static final String SQL_COUNTRY_CODE = ""
            + "SELECT c.COUNTRYCODE FROM COUNTRY c WHERE c.COUNTRYID = ? AND ROWNUM = 1";

    static final String SQL_DATASOURCE_NAME = ""
            + "SELECT t.DATASOURCEKINDNAME FROM DATASOURCEKIND t "
            + "WHERE TRIM(TO_CHAR(t.DATASOURCEKINDCODE)) = TRIM(?) AND ROWNUM = 1";

    static final String SQL_XML_SMDXML = "SELECT SMDXMLBODY FROM SMDXML WHERE SMDID = ?";

    static final String SQL_XML_SMDXML_SESINT = "SELECT SMDXMLBODY FROM SESINT.SMDXML WHERE SMDID = ?";

    /** История статусов (синонимы SMDSTATUSHIST / SMDSTATUS). */
    static final String SQL_STATUS_HISTORY = ""
            + "SELECT st.SMDSTATUSNAME, hs.SMDSTATUSDATETIME, ep.EMPCODE "
            + "FROM SMDSTATUSHIST hs "
            + "JOIN SMDSTATUS st ON st.SMDSTATUSID = hs.SMDSTATUSID "
            + "LEFT JOIN TB_USER us ON hs.USERID = us.USERID "
            + "LEFT JOIN TB_EMP ep ON ep.EMPID = us.EMPID "
            + "WHERE hs.SMDID = ? "
            + "ORDER BY 2";

    /** Таблицы в схеме SESINT; пользователи — SESDEV (см. FK SMDSTATUSHIST_FK3). */
    static final String SQL_STATUS_HISTORY_SESINT = ""
            + "SELECT st.SMDSTATUSNAME, hs.SMDSTATUSDATETIME, ep.EMPCODE "
            + "FROM SESINT.SMDSTATUSHIST hs "
            + "JOIN SESINT.SMDSTATUS st ON st.SMDSTATUSID = hs.SMDSTATUSID "
            + "LEFT JOIN SESDEV.TB_USER us ON hs.USERID = us.USERID "
            + "LEFT JOIN SESDEV.TB_EMP ep ON ep.EMPID = us.EMPID "
            + "WHERE hs.SMDID = ? "
            + "ORDER BY 2";

    /** Без join к TB_USER/TB_EMP, если нет прав на SESDEV. */
    static final String SQL_STATUS_HISTORY_SESINT_MINIMAL = ""
            + "SELECT st.SMDSTATUSNAME, hs.SMDSTATUSDATETIME, CAST(NULL AS VARCHAR2(100)) AS EMPCODE "
            + "FROM SESINT.SMDSTATUSHIST hs "
            + "JOIN SESINT.SMDSTATUS st ON st.SMDSTATUSID = hs.SMDSTATUSID "
            + "WHERE hs.SMDID = ? "
            + "ORDER BY 2";

    private SmdDbSupport() {
    }

    static boolean isMissingObject(SQLException e) {
        if (e == null) {
            return false;
        }
        String msg = e.getMessage();
        if (msg != null && (msg.contains("ORA-00942") || msg.contains("invalid object name"))) {
            return true;
        }
        Throwable cause = e.getCause();
        return cause != e && cause instanceof SQLException && isMissingObject((SQLException) cause);
    }
}
