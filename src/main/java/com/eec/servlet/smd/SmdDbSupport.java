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
            + "ORDER BY hs.SMDSTATUSDATETIME";

    /** Таблицы в схеме SESINT; пользователи — SESDEV (см. FK SMDSTATUSHIST_FK3). */
    static final String SQL_STATUS_HISTORY_SESINT = ""
            + "SELECT st.SMDSTATUSNAME, hs.SMDSTATUSDATETIME, ep.EMPCODE "
            + "FROM SESINT.SMDSTATUSHIST hs "
            + "JOIN SESINT.SMDSTATUS st ON st.SMDSTATUSID = hs.SMDSTATUSID "
            + "LEFT JOIN SESDEV.TB_USER us ON hs.USERID = us.USERID "
            + "LEFT JOIN SESDEV.TB_EMP ep ON ep.EMPID = us.EMPID "
            + "WHERE hs.SMDID = ? "
            + "ORDER BY hs.SMDSTATUSDATETIME";

    /** Без join к TB_USER/TB_EMP, если нет прав на SESDEV. */
    static final String SQL_STATUS_HISTORY_SESINT_MINIMAL = ""
            + "SELECT st.SMDSTATUSNAME, hs.SMDSTATUSDATETIME, CAST(NULL AS VARCHAR2(100)) AS EMPCODE "
            + "FROM SESINT.SMDSTATUSHIST hs "
            + "JOIN SESINT.SMDSTATUS st ON st.SMDSTATUSID = hs.SMDSTATUSID "
            + "WHERE hs.SMDID = ? "
            + "ORDER BY hs.SMDSTATUSDATETIME";

    /** Запросы дополнительных сведений (SMAQ) и ответы (SMAR) по карте SMD. */
    static final String SQL_INFO_REQUESTS = ""
            + "SELECT SQ.SMDID, SQ.SMAQID, "
            + "       NVL(C.COUNTRYNAME, 'Комиссия') AS COUNTRYNAME, "
            + "       SQ.CREATIONDATETIME, SQ.SMAQVERSION, STQ.SMAQSTATUSNAME, "
            + "       SR.SMARID, SR.SMARVERSION, SR.CREATIONDATETIME AS RCREATIONDATETIME, "
            + "       STR.SMARSTATUSNAME, SRX.EDOCCODE "
            + "FROM SMAQ SQ "
            + "JOIN SMAQSTATUS STQ ON STQ.SMAQSTATUSID = SQ.SMAQSTATUSID "
            + "LEFT JOIN COUNTRY C ON C.COUNTRYID = SQ.REQUESTCOUNTRYID "
            + "LEFT JOIN SMAR SR ON SQ.SMAQID = SR.SMAQID "
            + "LEFT JOIN SMARSTATUS STR ON STR.SMARSTATUSID = SR.SMARSTATUSID "
            + "LEFT JOIN SMARXML SRX ON SRX.SMARID = SR.SMARID "
            + "WHERE SQ.SMDID = ? "
            + "ORDER BY SQ.SMAQID, SR.SMARID NULLS LAST";

    /** То же при отсутствии синонимов SMAQ/SMAR (схема SESINT). */
    static final String SQL_INFO_REQUESTS_SESINT = ""
            + "SELECT SQ.SMDID, SQ.SMAQID, "
            + "       NVL(C.COUNTRYNAME, 'Комиссия') AS COUNTRYNAME, "
            + "       SQ.CREATIONDATETIME, SQ.SMAQVERSION, STQ.SMAQSTATUSNAME, "
            + "       SR.SMARID, SR.SMARVERSION, SR.CREATIONDATETIME AS RCREATIONDATETIME, "
            + "       STR.SMARSTATUSNAME, SRX.EDOCCODE "
            + "FROM SESINT.SMAQ SQ "
            + "JOIN SESINT.SMAQSTATUS STQ ON STQ.SMAQSTATUSID = SQ.SMAQSTATUSID "
            + "LEFT JOIN SESINT.COUNTRY C ON C.COUNTRYID = SQ.REQUESTCOUNTRYID "
            + "LEFT JOIN SESINT.SMAR SR ON SQ.SMAQID = SR.SMAQID "
            + "LEFT JOIN SESINT.SMARSTATUS STR ON STR.SMARSTATUSID = SR.SMARSTATUSID "
            + "LEFT JOIN SESINT.SMARXML SRX ON SRX.SMARID = SR.SMARID "
            + "WHERE SQ.SMDID = ? "
            + "ORDER BY SQ.SMAQID, SR.SMARID NULLS LAST";

    /** Результаты рассмотрения меры (SMR) по карте SMD. */
    static final String SQL_REVIEW_RESULTS = ""
            + "SELECT SMR.SMDID, COUNTRY.COUNTRYCODE, COUNTRY.COUNTRYNAME, "
            + "       SMR.SMRID, SMR.CREATIONDATETIME, SMRSTATUS.SMRSTATUSNAME "
            + "FROM SMR "
            + "JOIN COUNTRY ON COUNTRY.COUNTRYID = SMR.RESPONSECOUNTRYID "
            + "JOIN SMRSTATUS ON SMRSTATUS.SMRSTATUSID = SMR.SMRSTATUSID "
            + "WHERE SMR.SMDID = ? "
            + "ORDER BY SMR.CREATIONDATETIME DESC NULLS LAST, SMR.SMRID DESC";

    static final String SQL_REVIEW_RESULTS_SESINT = ""
            + "SELECT SMR.SMDID, COUNTRY.COUNTRYCODE, COUNTRY.COUNTRYNAME, "
            + "       SMR.SMRID, SMR.CREATIONDATETIME, SMRSTATUS.SMRSTATUSNAME "
            + "FROM SESINT.SMR SMR "
            + "JOIN SESINT.COUNTRY COUNTRY ON COUNTRY.COUNTRYID = SMR.RESPONSECOUNTRYID "
            + "JOIN SESINT.SMRSTATUS SMRSTATUS ON SMRSTATUS.SMRSTATUSID = SMR.SMRSTATUSID "
            + "WHERE SMR.SMDID = ? "
            + "ORDER BY SMR.CREATIONDATETIME DESC NULLS LAST, SMR.SMRID DESC";

    static final String SQL_SMD_DATASOURCE = ""
            + "SELECT TRIM(TO_CHAR(DATASOURCEKINDCODE)) AS DSC FROM SMD WHERE SMDID = ?";

    static final String SQL_SMR_COUNT = "SELECT COUNT(*) AS CNT FROM SMR WHERE SMDID = ?";

    /** Связанная карта SMR отправлена (код статуса SENT/DELIVERED). */
    static final String SQL_SMR_REVIEW_OUTCOME_SENT_BY_STATUS = ""
            + "SELECT 1 FROM SMR smr "
            + "JOIN SMRSTATUS st ON st.SMRSTATUSID = smr.SMRSTATUSID "
            + "WHERE smr.SMDID = ? "
            + "AND TRIM(UPPER(st.SMRSTATUSCODE)) IN ('SENT', 'DELIVERED') "
            + "AND ROWNUM = 1";

    /** Связанная карта SMR отправлена (привязан электронный документ). */
    static final String SQL_SMR_REVIEW_OUTCOME_SENT_BY_EDOC = ""
            + "SELECT 1 FROM SMR smr "
            + "JOIN SMRXML x ON x.SMRID = smr.SMRID "
            + "WHERE smr.SMDID = ? "
            + "AND x.EDOCID IS NOT NULL AND LENGTH(TRIM(TO_CHAR(x.EDOCID))) > 0 "
            + "AND ROWNUM = 1";

    static final String SQL_SMD_STATUS_ROW = ""
            + "SELECT TRIM(UPPER(NVL(st.SMDSTATUSCODE, ''))) AS STATUSCODE, "
            + "       TRIM(TO_CHAR(s.DATASOURCEKINDCODE)) AS DSC "
            + "FROM SMD s "
            + "LEFT JOIN SMDSTATUS st ON st.SMDSTATUSID = s.SMDSTATUSID "
            + "WHERE s.SMDID = ?";

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
