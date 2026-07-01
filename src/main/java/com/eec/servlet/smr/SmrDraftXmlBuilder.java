package com.eec.servlet.smr;

import java.sql.Date;
import java.util.UUID;

/**
 * Минимальный XML карты SMR (черновик) по схеме EEC_R_SM_SS_09_SanitaryMeasureConsideration_v1.0.0.
 */
public final class SmrDraftXmlBuilder {

    private SmrDraftXmlBuilder() {
    }

    public static String buildDraftXml(
            String docId,
            String docCountryCode,
            String messageCode,
            Date docCreationDate,
            String authorityId,
            String authorityName,
            String authorityBriefName,
            String descriptionText
    ) {
        String docDateIso = docCreationDate != null ? docCreationDate.toLocalDate().toString() : "";
        String edocId = UUID.randomUUID().toString();
        String nowIso = java.time.OffsetDateTime.now().toString();
        String incCountry = escapeXml(docCountryCode != null ? docCountryCode.trim().toUpperCase() : "");
        String incId = escapeXml(trimToEmpty(docId));
        String kind = escapeXml(trimToEmpty(messageCode));
        String authId = escapeXml(trimToEmpty(authorityId));
        String authName = escapeXml(trimToEmpty(authorityName));
        String authBrief = escapeXml(trimToEmpty(authorityBriefName));
        String desc = descriptionText != null && !descriptionText.trim().isEmpty()
                ? "<csdo:DescriptionText>" + escapeXml(descriptionText.trim()) + "</csdo:DescriptionText>"
                : "";

        StringBuilder authBlock = new StringBuilder();
        authBlock.append("    <ccdo:UnifiedAuthorityDetails>\n");
        authBlock.append("        <csdo:UnifiedCountryCode codeListId=\"2021\">BY</csdo:UnifiedCountryCode>\n");
        if (!authId.isEmpty()) {
            authBlock.append("        <csdo:AuthorityId>").append(authId).append("</csdo:AuthorityId>\n");
        }
        if (!authName.isEmpty()) {
            authBlock.append("        <csdo:AuthorityName>").append(authName).append("</csdo:AuthorityName>\n");
        }
        if (!authBrief.isEmpty()) {
            authBlock.append("        <csdo:AuthorityBriefName>").append(authBrief).append("</csdo:AuthorityBriefName>\n");
        }
        authBlock.append("    </ccdo:UnifiedAuthorityDetails>\n");

        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<doc:SanitaryMeasureConsiderationDetails xmlns:ccdo=\"urn:EEC:M:ComplexDataObjects:v0.4.12\"\n"
                + " xmlns:csdo=\"urn:EEC:M:SimpleDataObjects:v0.4.12\"\n"
                + " xmlns:smcdo=\"urn:EEC:M:SM:ComplexDataObjects:v0.3.9\"\n"
                + " xmlns:smsdo=\"urn:EEC:M:SM:SimpleDataObjects:v0.3.9\"\n"
                + " xmlns:doc=\"urn:EEC:R:SM:SS:09:SanitaryMeasureConsideration:v1.0.0\"\n"
                + " xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n"
                + " xsi:schemaLocation=\"urn:EEC:R:SM:SS:09:SanitaryMeasureConsideration:v1.0.0 "
                + "EEC_R_SM_SS_09_SanitaryMeasureConsideration_v1.0.0.xsd\">\n"
                + "    <ccdo:EDocHeader>\n"
                + "        <csdo:InfEnvelopeCode>P.SS.09.MSG.018</csdo:InfEnvelopeCode>\n"
                + "        <csdo:EDocCode>R.SM.SS.09.003</csdo:EDocCode>\n"
                + "        <csdo:EDocId>" + escapeXml(edocId) + "</csdo:EDocId>\n"
                + "        <csdo:EDocDateTime>" + escapeXml(nowIso) + "</csdo:EDocDateTime>\n"
                + "        <csdo:LanguageCode>ru</csdo:LanguageCode>\n"
                + "    </ccdo:EDocHeader>\n"
                + authBlock
                + "    <smcdo:MeasureDocDetails>\n"
                + "        <csdo:UnifiedCountryCode codeListId=\"2021\">" + incCountry + "</csdo:UnifiedCountryCode>\n"
                + "        <smsdo:DocId>" + incId + "</smsdo:DocId>\n"
                + "        <smsdo:MessageCode>" + kind + "</smsdo:MessageCode>\n"
                + "        <csdo:DocCreationDate>" + escapeXml(docDateIso) + "</csdo:DocCreationDate>\n"
                + "    </smcdo:MeasureDocDetails>\n"
                + desc + "\n"
                + "</doc:SanitaryMeasureConsiderationDetails>\n";
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
