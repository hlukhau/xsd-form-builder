package com.eec.util;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Перевод сообщений Xerces/JAXP при валидации по XSD в формулировки для пользователя
 * (вкладка/блок формы, поля без имён XML-тегов и без кодов cvc).
 */
public final class XsdMessageHumanizer {

    private static final Map<String, String> LABEL = new LinkedHashMap<String, String>();

    /** Сегменты пути «где в форме» по локальным именам контейнеров в XML. */
    private static final Map<String, String> FORM_SECTION = new LinkedHashMap<String, String>();

    static {
        FORM_SECTION.put("NonCompliantSanitaryProductDetails", "вкладка «ТСД»");
        FORM_SECTION.put("NonCompliantSanitaryProductBatchDetails", "партия");
        FORM_SECTION.put("ShippingDocumentDetails", "товаросопроводительный документ");
        FORM_SECTION.put("RequirementViolationDetails", "вкладка «Нарушения»");
        FORM_SECTION.put("RequirementsDocDetails", "нарушенное требование");
        FORM_SECTION.put("DocStructuralElementDetails", "структурный элемент документа");
        FORM_SECTION.put("DiscrepancyOfQualityIndexDetails", "показатель по нарушению");
        FORM_SECTION.put("DetectionPlaceDetails", "вкладка «Место обнаружения»");
        FORM_SECTION.put("BorderCheckpointDetails", "пункт пропуска");
        FORM_SECTION.put("OrganizationDetails", "организация");
        FORM_SECTION.put("SanitaryMeasureBaseDetails", "вкладка «Меры»");
        FORM_SECTION.put("SanitaryMeasureDetails", "вкладка «Меры»");
        FORM_SECTION.put("MeasureImplementationDetails", "реализация меры");
        FORM_SECTION.put("MeasurePlaceDetails", "место реализации меры");
        FORM_SECTION.put("SubjectDetails", "субъект");
        FORM_SECTION.put("ConformityDocDetails", "документ соответствия");
        FORM_SECTION.put("DangerousProductAlertDetails", "уведомление");
        FORM_SECTION.put("PublicHealthAlertDetails", "уведомление PHA");
        FORM_SECTION.put("PublicHealthIncidentDetails", "нежелательная ситуация");
        FORM_SECTION.put("DiseaseHealthProblemDetails", "болезнь");
        FORM_SECTION.put("SupplyChainPartyDetails", "участник цепи поставки");

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
        LABEL.put("SupplyChainPartyDetails", "участник цепи поставки");
        LABEL.put("SupplyChainPartyKindCode", "код вида участника цепи поставки");
        LABEL.put("EventDate", "дата первого случая");
        LABEL.put("EndDate", "дата окончания");
        LABEL.put("BusinessEntityId", "идентификатор хозяйствующего субъекта (ОГРН/ИНН и т.п.)");
        LABEL.put("BusinessEntityName", "полное наименование хозяйствующего субъекта");
        LABEL.put("BusinessEntityBriefName", "краткое наименование хозяйствующего субъекта");
        LABEL.put("SubjectName", "наименование субъекта");
        LABEL.put("SubjectBriefName", "краткое наименование субъекта");
    }

    private XsdMessageHumanizer() {
    }

    /**
     * Локальное имя элемента: {@code {uri}ProductDetails} или {@code smcdo:ProductDetails} → {@code ProductDetails}.
     */
    private static String elementLocalName(String raw) {
        if (raw == null) {
            return "";
        }
        String s = raw.trim();
        if (s.startsWith("{")) {
            int br = s.indexOf('}');
            if (br > 0 && br + 1 < s.length()) {
                return s.substring(br + 1);
            }
            return s;
        }
        int colon = s.indexOf(':');
        if (colon > 0 && colon < s.length() - 1) {
            return s.substring(colon + 1);
        }
        return s;
    }

    private static String label(String elementRef) {
        String key = elementLocalName(elementRef);
        if (key.isEmpty()) {
            return "данные";
        }
        String v = LABEL.get(key);
        if (v != null) {
            return v;
        }
        return "элемент «" + key + "»";
    }

    /**
     * Сообщение без номера строки (устаревший префикс «Строка N: » из входа удаляется).
     */
    public static String humanizeFull(String raw) {
        return humanizeFull(raw, -1, null, null);
    }

    /**
     * @param rawMessage   текст ошибки валидатора
     * @param lineNumber   номер строки XML (1-based), -1 если неизвестен
     * @param documentXml  полный XML для контекста вкладки/блока
     * @param docType      {@code dpa} или {@code pha}
     */
    public static String humanizeFull(String rawMessage, int lineNumber, String documentXml, String docType) {
        if (rawMessage == null || rawMessage.isEmpty()) {
            return "";
        }
        String body = rawMessage;
        Matcher legacyLine = Pattern.compile("^Строка\\s+\\d+:\\s*").matcher(body);
        if (legacyLine.find()) {
            body = body.substring(legacyLine.end());
        }
        String human = humanizeBody(body);
        human = stripNamespaces(human);
        human = human.replaceAll("\\s{2,}", " ").trim();

        String hint = "";
        if (lineNumber > 0 && documentXml != null && !documentXml.isEmpty()) {
            String prefix = xmlPrefixBeforeLine(documentXml, lineNumber);
            hint = formLocationHint(prefix);
        }
        if (hint.isEmpty()) {
            return human;
        }
        // Путь по форме без префикса «Где смотреть: карта ДПА →» — только цепочка вкладок/блоков
        return human + " (" + hint + ")";
    }

    /** Строки XML с 1 по (lineNumber − 1), без строки с ошибкой — предки элемента. */
    private static String xmlPrefixBeforeLine(String xml, int lineNumber) {
        String[] lines = xml.split("\r\n|\n|\r", -1);
        StringBuilder sb = new StringBuilder();
        int last = Math.min(lineNumber - 1, lines.length);
        for (int i = 0; i < last; i++) {
            if (i > 0) {
                sb.append('\n');
            }
            sb.append(lines[i]);
        }
        return sb.toString();
    }

    private static void closeStack(List<String> stack, String local) {
        while (!stack.isEmpty()) {
            String top = stack.get(stack.size() - 1);
            if (top.equals(local)) {
                stack.remove(stack.size() - 1);
                return;
            }
            stack.remove(stack.size() - 1);
        }
    }

    private static String parseTagLocalName(String tagFull, boolean closing) {
        String s = tagFull.trim();
        if (s.startsWith("<")) {
            s = s.substring(1);
        }
        if (closing && s.startsWith("/")) {
            s = s.substring(1);
        }
        s = s.trim();
        int end = 0;
        while (end < s.length()) {
            char ch = s.charAt(end);
            if (Character.isWhitespace(ch) || ch == '/' || ch == '>') {
                break;
            }
            end++;
        }
        String name = s.substring(0, end);
        return elementLocalName(name);
    }

    /**
     * Упрощённый разбор тегов до позиции ошибки: стек открытых локальных имён.
     */
    private static List<String> buildElementStack(String prefixXml) {
        List<String> stack = new ArrayList<String>();
        if (prefixXml == null || prefixXml.isEmpty()) {
            return stack;
        }
        int n = prefixXml.length();
        int i = 0;
        while (i < n) {
            int lt = prefixXml.indexOf('<', i);
            if (lt < 0) {
                break;
            }
            int gt = prefixXml.indexOf('>', lt);
            if (gt < 0) {
                break;
            }
            String tagFull = prefixXml.substring(lt, gt + 1);
            if (tagFull.startsWith("<!--")) {
                int endComment = prefixXml.indexOf("-->", lt + 4);
                i = endComment >= 0 ? endComment + 3 : gt + 1;
                continue;
            }
            if (tagFull.startsWith("<?") || tagFull.startsWith("<!")) {
                i = gt + 1;
                continue;
            }
            if (tagFull.startsWith("</")) {
                String local = parseTagLocalName(tagFull, true);
                if (!local.isEmpty()) {
                    closeStack(stack, local);
                }
                i = gt + 1;
                continue;
            }
            String local = parseTagLocalName(tagFull, false);
            boolean selfClosing = tagFull.trim().endsWith("/>");
            if (!local.isEmpty() && !selfClosing) {
                stack.add(local);
            }
            i = gt + 1;
        }
        return stack;
    }

    private static int batchIndexInPrefix(String prefixXml) {
        Pattern openP = Pattern.compile("<(?:[\\w.-]+:)?NonCompliantSanitaryProductBatchDetails\\b");
        Pattern closeP = Pattern.compile("</(?:[\\w.-]+:)?NonCompliantSanitaryProductBatchDetails\\s*>");
        int opens = 0;
        Matcher mo = openP.matcher(prefixXml);
        while (mo.find()) {
            opens++;
        }
        int closes = 0;
        Matcher mc = closeP.matcher(prefixXml);
        while (mc.find()) {
            closes++;
        }
        if (opens > closes) {
            return closes + 1;
        }
        return 0;
    }

    private static int shippingDocIndexInPrefix(String prefixXml) {
        Pattern openP = Pattern.compile("<(?:[\\w.-]+:)?ShippingDocumentDetails\\b");
        Pattern closeP = Pattern.compile("</(?:[\\w.-]+:)?ShippingDocumentDetails\\s*>");
        int opens = 0;
        Matcher mo = openP.matcher(prefixXml);
        while (mo.find()) {
            opens++;
        }
        int closes = 0;
        Matcher mc = closeP.matcher(prefixXml);
        while (mc.find()) {
            closes++;
        }
        if (opens > closes) {
            return closes + 1;
        }
        return 0;
    }

    /**
     * В UI: сведения о продукции по XSD либо на вкладке «Продукция» карты, либо в ТСД — только внутри детализации
     * товаросопроводительного документа (кнопка «Детализация» → панель «Продукция»).
     */
    private static String segmentForProductDetailsInContext(List<String> stack) {
        if (stack == null || stack.isEmpty()) {
            return "вкладка «Продукция»";
        }
        if (stack.contains("ShippingDocumentDetails")) {
            return "детализация ТСД → панель «Продукция» в товаросопроводительном документе";
        }
        return "вкладка «Продукция» карты (не раздел партий ТСД)";
    }

    private static int measureIndexInPrefix(String prefixXml) {
        Pattern openP = Pattern.compile("<(?:[\\w.-]+:)?SanitaryMeasureBaseDetails\\b");
        Pattern closeP = Pattern.compile("</(?:[\\w.-]+:)?SanitaryMeasureBaseDetails\\s*>");
        int opens = 0;
        Matcher mo = openP.matcher(prefixXml);
        while (mo.find()) {
            opens++;
        }
        int closes = 0;
        Matcher mc = closeP.matcher(prefixXml);
        while (mc.find()) {
            closes++;
        }
        if (opens > closes) {
            return closes + 1;
        }
        return 0;
    }

    private static String formLocationHint(String prefixXml) {
        if (prefixXml == null || prefixXml.isEmpty()) {
            return "";
        }
        List<String> stack = buildElementStack(prefixXml);
        List<String> segments = new ArrayList<String>();
        String prev = null;
        for (String el : stack) {
            String seg;
            if ("ProductDetails".equals(el)) {
                seg = segmentForProductDetailsInContext(stack);
            } else {
                seg = FORM_SECTION.get(el);
            }
            if (seg != null && (prev == null || !seg.equals(prev))) {
                segments.add(seg);
                prev = seg;
            }
        }
        if (segments.isEmpty()) {
            return "";
        }
        int bi = batchIndexInPrefix(prefixXml);
        int si = shippingDocIndexInPrefix(prefixXml);
        int mi = measureIndexInPrefix(prefixXml);
        for (int k = 0; k < segments.size(); k++) {
            if ("партия".equals(segments.get(k)) && bi > 0) {
                segments.set(k, "партия №" + bi);
            }
            if (segments.get(k).contains("товаросопроводительный документ") && si > 0) {
                segments.set(k, "товаросопроводительный документ №" + si);
            }
            if (segments.get(k).contains("Меры»") && mi > 0) {
                segments.set(k, "вкладка «Меры», запись №" + mi);
            }
        }
        return joinArrow(segments);
    }

    private static String joinArrow(List<String> parts) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < parts.size(); i++) {
            if (i > 0) {
                b.append(" → ");
            }
            b.append(parts.get(i));
        }
        return b.toString();
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
        Matcher attrRequired = Pattern.compile(
                "cvc-complex-type\\.4:\\s*Attribute\\s+'([^']+)'\\s+must\\s+appear\\s+on\\s+element\\s+'([^']+)'\\.",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL)
                .matcher(s);
        if (attrRequired.find()) {
            String attr = attrRequired.group(1);
            String el = attrRequired.group(2);
            String elLabel = label(el);
            if ("kindId".equalsIgnoreCase(attr) && "BusinessEntityId".equals(elementLocalName(el))) {
                return "Для «" + elLabel + "» в XML обязателен атрибут kindId (метод идентификации). "
                        + "В карте ДПА укажите поле «Метод идентификации» для субъекта или участника цепи поставки, если задан идентификатор (ОГРН/ИНН и т.п.).";
            }
            return "Для элемента «" + elLabel + "» по схеме обязателен атрибут «" + attr + "».";
        }

        Matcher m24b = Pattern.compile(
                "cvc-complex-type\\.2\\.4\\.b:\\s*The content of element '([^']+)' is not complete\\.\\s*One of '([^']+)'\\s+is expected\\.",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL)
                .matcher(s);
        if (m24b.find()) {
            String container = elementLocalName(m24b.group(1));
            // SupplyChainPartyDetails extends BusinessEntityDetailsType + обязательный csdo:SupplyChainPartyKindCode;
            // сообщение Xerces «один из …» смешивает опциональные поля базового типа с обязательным кодом вида.
            if ("SupplyChainPartyDetails".equalsIgnoreCase(container)) {
                return "В блоке «" + label(m24b.group(1))
                        + "» по схеме обязателен код вида участника цепи поставки (элемент «SupplyChainPartyKindCode»). "
                        + "Остальные реквизиты хозяйствующего субъекта указываются при необходимости.";
            }
            String choices = humanizeChoiceList(m24b.group(2));
            return "В блоке «" + label(m24b.group(1)) + "» не хватает обязательных данных по схеме. Укажите одно из: "
                    + choices + ".";
        }

        Matcher m24d = Pattern.compile(
                "cvc-complex-type\\.2\\.4\\.d:\\s*Invalid content was found starting with element '([^']+)'\\.\\s*No child element is expected at this point\\.",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL)
                .matcher(s);
        if (m24d.find()) {
            return "Поле «" + label(m24d.group(1))
                    + "» здесь лишнее или стоит не в том порядке: вложенные элементы на этой позиции схема не предусматривает.";
        }

        Matcher m24a = Pattern.compile(
                "cvc-complex-type\\.2\\.4\\.a:\\s*Invalid content was found starting with element '([^']+)'\\.\\s*One of '([^']+)'\\s+is expected\\.",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL)
                .matcher(s);
        if (m24a.find()) {
            return "Поле «" + label(m24a.group(1)) + "» не подходит для этой позиции. Должно быть: "
                    + humanizeChoiceList(m24a.group(2)) + ".";
        }

        Matcher m311 = Pattern.compile(
                "cvc-type\\.3\\.1\\.1:\\s*Element '([^']+)' is a simple type, so it cannot have attributes,.*",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL)
                .matcher(s);
        if (m311.find()) {
            return "Для поля «" + label(m311.group(1))
                    + "» в XML передано значение с атрибутом, а по схеме допустим только текст элемента без атрибутов.";
        }

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
            return "обязательные поля по структуре схемы";
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
