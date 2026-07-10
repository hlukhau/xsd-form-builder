package com.eec.servlet.sma;

import java.sql.Date;
import java.util.UUID;

/**
 * Минимальный XML карты SMAQ/SMAR (черновик) по схеме EEC_R_SM_SS_09_AdditionalInfoDetails_v1.0.0.
 */
public final class SmaDraftXmlBuilder {

    private static final String EDOCCODE_SMAQ = "R.SM.SS.09.002";
    private static final String EDOCCODE_SMAR_INFO = "R.SM.SS.09.002";
    private static final String EDOCCODE_SMAR_ABSENT = "R.006";
    private static final String INF_ENVELOPE = "P.SS.09.MSG.019";

    private SmaDraftXmlBuilder() {
    }

    public static String buildSmaqDraftXml(
            String docCountryCode,
            String docId,
            Date docCreationDate,
            String authorityId,
            String authorityName,
            String authorityBriefName,
            String descriptionText
    ) {
        return buildDraftXml(EDOCCODE_SMAQ, docCountryCode, docId, docCreationDate,
                authorityId, authorityName, authorityBriefName, descriptionText, true);
    }

    public static String buildSmarInfoDraftXml(
            String docCountryCode,
            String docId,
            Date docCreationDate,
            String authorityId,
            String authorityName,
            String authorityBriefName,
            String descriptionText
    ) {
        return buildDraftXml(EDOCCODE_SMAR_INFO, docCountryCode, docId, docCreationDate,
                authorityId, authorityName, authorityBriefName, descriptionText, true);
    }

    public static String buildSmarAbsentDraftXml(String descriptionText) {
        String desc = descriptionText != null && !descriptionText.trim().isEmpty()
                ? "    <csdo:DescriptionText>" + escapeXml(descriptionText.trim()) + "</csdo:DescriptionText>\n"
                : "";
        String edocId = UUID.randomUUID().toString();
        String nowIso = java.time.OffsetDateTime.now().toString();
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<doc:ProcessingResultDetails xmlns:ccdo=\"urn:EEC:M:ComplexDataObjects:v0.4.12\"\n"
                + " xmlns:csdo=\"urn:EEC:M:SimpleDataObjects:v0.4.12\"\n"
                + " xmlns:doc=\"urn:EEC:R:ProcessingResultDetails:v1.0.7\"\n"
                + " xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n"
                + " xsi:schemaLocation=\"urn:EEC:R:ProcessingResultDetails:v1.0.7 "
                + "EEC_R_ProcessingResultDetails_v1.0.7.xsd\">\n"
                + "    <ccdo:EDocHeader>\n"
                + "        <csdo:InfEnvelopeCode>" + INF_ENVELOPE + "</csdo:InfEnvelopeCode>\n"
                + "        <csdo:EDocCode>" + EDOCCODE_SMAR_ABSENT + "</csdo:EDocCode>\n"
                + "        <csdo:EDocId>" + escapeXml(edocId) + "</csdo:EDocId>\n"
                + "        <csdo:EDocDateTime>" + escapeXml(nowIso) + "</csdo:EDocDateTime>\n"
                + "        <csdo:LanguageCode>ru</csdo:LanguageCode>\n"
                + "    </ccdo:EDocHeader>\n"
                + "    <csdo:EventDateTime>" + escapeXml(nowIso) + "</csdo:EventDateTime>\n"
                + "    <csdo:ProcessingResultV2Code>1</csdo:ProcessingResultV2Code>\n"
                + desc
                + "</doc:ProcessingResultDetails>\n";
    }

    private static String buildDraftXml(
            String edocCode,
            String docCountryCode,
            String docId,
            Date docCreationDate,
            String authorityId,
            String authorityName,
            String authorityBriefName,
            String descriptionText,
            boolean includeMeasureDoc
    ) {
        String docDateIso = docCreationDate != null ? docCreationDate.toLocalDate().toString() : "";
        String edocId = UUID.randomUUID().toString();
        String nowIso = java.time.OffsetDateTime.now().toString();
        String incCountry = escapeXml(docCountryCode != null ? docCountryCode.trim().toUpperCase() : "");
        String incId = escapeXml(trimToEmpty(docId));
        String authName = escapeXml(trimToEmpty(authorityName));
        String authBrief = escapeXml(trimToEmpty(authorityBriefName));
        String desc = descriptionText != null && !descriptionText.trim().isEmpty()
                ? "<csdo:DescriptionText>" + escapeXml(descriptionText.trim()) + "</csdo:DescriptionText>"
                : "";

        StringBuilder authBlock = new StringBuilder();
        authBlock.append("    <ccdo:UnifiedAuthorityDetails>\n");
        authBlock.append("        <csdo:UnifiedCountryCode codeListId=\"2021\">BY</csdo:UnifiedCountryCode>\n");
        if (!authName.isEmpty()) {
            authBlock.append("        <csdo:AuthorityName>").append(authName).append("</csdo:AuthorityName>\n");
        }
        if (!authBrief.isEmpty()) {
            authBlock.append("        <csdo:AuthorityBriefName>").append(authBrief).append("</csdo:AuthorityBriefName>\n");
        }
        authBlock.append("    </ccdo:UnifiedAuthorityDetails>\n");

        StringBuilder measureBlock = new StringBuilder();
        if (includeMeasureDoc && (!incCountry.isEmpty() || !incId.isEmpty() || !docDateIso.isEmpty())) {
            measureBlock.append("    <smcdo:MeasureDocReferenceDetails>\n");
            if (!incCountry.isEmpty()) {
                measureBlock.append("        <csdo:UnifiedCountryCode codeListId=\"2021\">")
                        .append(incCountry).append("</csdo:UnifiedCountryCode>\n");
            }
            if (!incId.isEmpty()) {
                measureBlock.append("        <smsdo:DocId>").append(incId).append("</smsdo:DocId>\n");
            }
            if (!docDateIso.isEmpty()) {
                measureBlock.append("        <csdo:DocCreationDate>")
                        .append(escapeXml(docDateIso)).append("</csdo:DocCreationDate>\n");
            }
            measureBlock.append("    </smcdo:MeasureDocReferenceDetails>\n");
        }

        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<doc:AdditionalInfoDetails xmlns:ccdo=\"urn:EEC:M:ComplexDataObjects:v0.4.12\"\n"
                + " xmlns:csdo=\"urn:EEC:M:SimpleDataObjects:v0.4.12\"\n"
                + " xmlns:smcdo=\"urn:EEC:M:SM:ComplexDataObjects:v0.3.9\"\n"
                + " xmlns:smsdo=\"urn:EEC:M:SM:SimpleDataObjects:v0.3.9\"\n"
                + " xmlns:doc=\"urn:EEC:R:SM:SS:09:AdditionalInfoDetails:v1.0.0\"\n"
                + " xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n"
                + " xsi:schemaLocation=\"urn:EEC:R:SM:SS:09:AdditionalInfoDetails:v1.0.0 "
                + "EEC_R_SM_SS_09_AdditionalInfoDetails_v1.0.0.xsd\">\n"
                + "    <ccdo:EDocHeader>\n"
                + "        <csdo:InfEnvelopeCode>" + INF_ENVELOPE + "</csdo:InfEnvelopeCode>\n"
                + "        <csdo:EDocCode>" + escapeXml(edocCode) + "</csdo:EDocCode>\n"
                + "        <csdo:EDocId>" + escapeXml(edocId) + "</csdo:EDocId>\n"
                + "        <csdo:EDocDateTime>" + escapeXml(nowIso) + "</csdo:EDocDateTime>\n"
                + "        <csdo:LanguageCode>ru</csdo:LanguageCode>\n"
                + "    </ccdo:EDocHeader>\n"
                + authBlock
                + measureBlock
                + desc + "\n"
                + "</doc:AdditionalInfoDetails>\n";
    }

    private static String trimToEmpty(String s) {
        return s == null ? "" : s.trim();
    }

    private static String escapeXml(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
