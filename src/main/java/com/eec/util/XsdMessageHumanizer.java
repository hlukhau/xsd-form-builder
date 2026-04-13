package com.eec.util;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Перевод сообщений Xerces/JAXP при валидации по XSD в короткие формулировки для пользователя
 * (сущности и разделы карты, без имён XML-тегов и без кодов cvc).
 */
public final class XsdMessageHumanizer {

    private static final Map<String, String> LABEL = new LinkedHashMap<String, String>();

    static {
        // Продукция / ТСД
        LABEL.put("ProductDetails", "сведения о продукции");
        LABEL.put("ProductId", "идентификатор продукции");
        LABEL.put("ProductName", "наименование продукции");
        LABEL.put("SanitaryProductTypeName", "наименование вида продукции");
        LABEL.put("CommodityCode", "код ТН ВЭД");
        LABEL.put("UnifiedCountryCode", "код страны");
        LABEL.put("UnifiedMeasurementUnitCode", "код единицы измерения");
        LABEL.put("BatchId", "номер серии");
        LABEL.put("ConsignmentId", "номер товарной партии");
        LABEL.put("ManufactureDate", "дата производства");
        LABEL.put("ProductShelfLifeEndDate", "дата окончания срока годности");
        LABEL.put("ShippingDocumentDetails", "товаросопроводительный документ");
        LABEL.put("ConformityDocDetails", "документ соответствия");
        LABEL.put("NonCompliantSanitaryProductBatchDetails", "партия с нарушениями");
        LABEL.put("RequirementViolationDetails", "сведения о нарушении");
        LABEL.put("RequirementsDocDetails", "нарушенное требование");
        LABEL.put("DiscrepancyOfQualityIndexDetails", "показатель по нарушению");
        LABEL.put("DocStructuralElementDetails", "структурный элемент документа");
        LABEL.put("DocStructuralElementName", "вид структурного документа");
        LABEL.put("DocStructuralElementId", "номер структурного элемента");
        LABEL.put("DangerousProductAlertDetails", "сведения об опасной продукции");
        LABEL.put("IncidentId", "идентификатор инцидента");
        LABEL.put("IncidentKindCode", "вид уведомления");
        LABEL.put("DocCreationDate", "дата документа");
        LABEL.put("DocName", "наименование документа");
        LABEL.put("DocId", "номер документа");
        LABEL.put("DescriptionText", "текстовое описание");
        LABEL.put("TechnicalRegulationId", "номер техрегламента");
        LABEL.put("DetectionPlaceDetails", "место обнаружения");
        LABEL.put("BorderCheckpointCode", "код пункта пропуска");
        LABEL.put("BorderCheckpointName", "наименование пункта пропуска");
        LABEL.put("OrganizationDetails", "организация");
        LABEL.put("AddressDetails", "адрес");
        LABEL.put("SanitaryMeasureDetails", "санитарная мера");
        LABEL.put("MeasureCode", "код меры");
        LABEL.put("MeasureName", "наименование меры");
        LABEL.put("MeasureDocDetails", "сведения о документе меры");
        LABEL.put("MeasureAffectedObjectKindCode", "код вида объекта действия меры");
        LABEL.put("MeasureJustificationText", "обоснование меры");
        LABEL.put("PublicHealthAlertDetails", "сведения о случае обнаружения болезни");
        LABEL.put("PublicHealthIncidentDetails", "сведения о нежелательной ситуации");
        LABEL.put("DiseaseHealthProblemDetails", "сведения о болезни");
        LABEL.put("PatientGroupDetails", "группа пациентов");
        LABEL.put("SpreadingZoneDetails", "зона распространения");
        LABEL.put("PathogenDetails", "возбудитель");
        LABEL.put("IncidentAlertIdDetails", "причинное уведомление");
        LABEL.put("UnifiedAuthorityDetails", "уполномоченный орган");
        LABEL.put("AuthorityName", "наименование органа");
        LABEL.put("AuthorityId", "идентификатор органа");
        LABEL.put("EventDate", "дата первого случая");
        LABEL.put("EndDate", "дата окончания");
    }

    private XsdMessageHumanizer() {
    }

    private static String label(String elementLocalName) {
        if (elementLocalName == null) {
            return "данные";
        }
        String v = LABEL.get(elementLocalName);
        if (v != null) {
            return v;
        }
        // Не подставляем имя XML-элемента в текст для пользователя
        return "реквизит по структуре формы";
    }

    /**
     * Полное сообщение для отчёта (сохраняет префикс «Строка N: », если был).
     */
    public static String humanizeFull(String raw) {
        if (raw == null || raw.isEmpty()) {
            return "";
        }
        Matcher lineM = Pattern.compile("^(Строка\\s+\\d+:\\s*)(.*)$", Pattern.DOTALL).matcher(raw);
        String prefix = "";
        String body = raw;
        if (lineM.matches()) {
            prefix = lineM.group(1);
            body = lineM.group(2);
        }
        String out = humanizeBody(body);
        out = stripNamespaces(out);
        out = out.replaceAll("\\s{2,}", " ").trim();
        return prefix + out;
    }

    private static String stripNamespaces(String s) {
        if (s == null) {
            return "";
        }
        String t = s.replaceAll("\\{\"urn:[^\"]+\"\\s*:\\s*", "{");
        t = t.replaceAll("\\{urn:[^}]+\\}", "");
        t = t.replaceAll("\"urn:[^\"]+\"\\s*:\\s*", "");
        t = t.replaceAll("(?i)\\b(csdo|smcdo|smsdo|ccdo|doc|bdt):", "");
        return t;
    }

    private static String humanizeBody(String s) {
        if (s == null || s.isEmpty()) {
            return "";
        }
        // --- Конкретные шаблоны Xerces ---
        Matcher m24b = Pattern.compile(
                "cvc-complex-type\\.2\\.4\\.b:\\s*The content of element '([^']+)' is not complete\\.\\s*One of '([^']+)'\\s+is expected\\.",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL)
                .matcher(s);
        if (m24b.find()) {
            String el = m24b.group(1);
            String choices = m24b.group(2);
            return "Неполный блок «" + label(el) + "»: по схеме должны быть заданы обязательные поля, например: "
                    + humanizeChoiceList(choices) + ".";
        }

        Matcher m24d = Pattern.compile(
                "cvc-complex-type\\.2\\.4\\.d:\\s*Invalid content was found starting with element '([^']+)'\\.\\s*No child element is expected at this point\\.",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL)
                .matcher(s);
        if (m24d.find()) {
            return "В этом месте структуры данных схема не ожидает дочерних элементов; начинается лишний или смещённый блок «"
                    + label(m24d.group(1)) + "» (часто это нарушение порядка полей).";
        }

        Matcher m24a = Pattern.compile(
                "cvc-complex-type\\.2\\.4\\.a:\\s*Invalid content was found starting with element '([^']+)'\\.\\s*One of '([^']+)'\\s+is expected\\.",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL)
                .matcher(s);
        if (m24a.find()) {
            return "Вместо или перед «" + label(m24a.group(1)) + "» в этом месте должны идти данные вида: "
                    + humanizeChoiceList(m24a.group(2)) + ".";
        }

        Matcher m311 = Pattern.compile(
                "cvc-type\\.3\\.1\\.1:\\s*Element '([^']+)' is a simple type, so it cannot have attributes,.*",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL)
                .matcher(s);
        if (m311.find()) {
            return "Для «" + label(m311.group(1))
                    + "» указан атрибут (например привязка к справочнику), а по схеме допустимо только текстовое значение без таких атрибутов.";
        }

        // Общий случай: убрать коды cvc и заменить element '…'
        String t = s.replaceAll("(?i)cvc-[a-z0-9.-]+:\\s*", "");
        t = t.replaceAll("(?i)However, the attribute[^.]+\\.", "");
        t = replaceQuotedElements(t);
        return t.trim();
    }

    private static String humanizeChoiceList(String rawChoices) {
        if (rawChoices == null) {
            return "";
        }
        List<String> parts = new ArrayList<String>();
        Matcher urn = Pattern.compile("\"urn:[^\"]+\"\\s*:\\s*(\\w+)").matcher(rawChoices);
        while (urn.find()) {
            parts.add(label(urn.group(1)));
        }
        if (parts.isEmpty()) {
            Matcher m = Pattern.compile(":\\s*(\\w+)\\s*([,}])").matcher(rawChoices);
            while (m.find()) {
                parts.add(label(m.group(1)));
            }
        }
        if (parts.isEmpty()) {
            Matcher m2 = Pattern.compile("(\\w+)(?=\\s*[,}])").matcher(rawChoices);
            while (m2.find()) {
                String w = m2.group(1);
                if (w.length() > 2 && Character.isUpperCase(w.charAt(0))) {
                    parts.add(label(w));
                }
            }
        }
        if (parts.isEmpty()) {
            return "см. требования схемы к обязательным полям";
        }
        return joinUnique(parts);
    }

    private static String joinUnique(List<String> parts) {
        List<String> out = new ArrayList<String>();
        for (String p : parts) {
            if (!out.contains(p)) {
                out.add(p);
            }
        }
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < out.size(); i++) {
            if (i > 0) {
                b.append(i == out.size() - 1 ? " или " : ", ");
            }
            b.append(out.get(i));
        }
        return b.toString();
    }

    private static String replaceQuotedElements(String s) {
        Matcher m = Pattern.compile("element '([^']+)'").matcher(s);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            m.appendReplacement(sb, Matcher.quoteReplacement("блок «" + label(m.group(1)) + "»"));
        }
        m.appendTail(sb);
        return sb.toString();
    }
}
