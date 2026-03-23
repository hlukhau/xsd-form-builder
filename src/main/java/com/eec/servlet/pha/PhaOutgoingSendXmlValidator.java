package com.eec.servlet.pha;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Контроль XML исходящей карты PHA перед направлением участникам ОП 57 (аналог validatePhaOutgoingCard в TS).
 */
public final class PhaOutgoingSendXmlValidator {

    private PhaOutgoingSendXmlValidator() {
    }

    public static List<String> validate(String xml) {
        List<String> errors = new ArrayList<>();
        if (xml == null || xml.trim().isEmpty()) {
            errors.add("XML карты пуст");
            return errors;
        }
        Document doc;
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            try {
                factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            } catch (Exception ignored) {
                /* не все парсеры поддерживают */
            }
            DocumentBuilder builder = factory.newDocumentBuilder();
            doc = builder.parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            errors.add("Не удалось разобрать XML: " + e.getMessage());
            return errors;
        }
        Element root = doc.getDocumentElement();
        if (root == null) {
            errors.add("Нет корневого элемента XML");
            return errors;
        }

        Element caseBlock = resolveFirstCaseBlock(root);
        if (caseBlock == null) {
            errors.add("Раздел «Уведомление»: не найден блок PublicHealthAlertDetails с данными случая");
            return errors;
        }

        String country = nz(textByLocal(caseBlock, "UnifiedCountryCode"));
        if (country.isEmpty()) {
            errors.add("Уведомление: код страны уполномоченного органа должен быть указан");
        }
        String reg = nz(textByLocal(caseBlock, "IncidentId"));
        if (reg.isEmpty()) {
            errors.add("Уведомление: регистрационный номер должен быть указан");
        }
        String incidentKind = nz(textByLocal(caseBlock, "IncidentKindCode"));
        if (incidentKind.isEmpty()) {
            errors.add("Уведомление: вид уведомления должен быть указан");
        }
        String docCreation = nz(textByLocal(caseBlock, "DocCreationDate"));
        if (docCreation.isEmpty()) {
            errors.add("Уведомление: дата формирования уведомления должна быть указана");
        }

        Element authority = findFirstByLocal(caseBlock, "UnifiedAuthorityDetails");
        if (authority == null) {
            errors.add("Уведомление: сведения об уполномоченном органе должны быть указаны");
        } else {
            if (nz(textByLocal(authority, "UnifiedCountryCode")).isEmpty()) {
                errors.add("Уведомление: страна уполномоченного органа должна быть указана");
            }
            if (nz(textByLocal(authority, "AuthorityName")).isEmpty()) {
                errors.add("Уведомление: наименование уполномоченного органа должно быть указано");
            }
        }

        Element incidentDetails = findFirstByLocal(caseBlock, "PublicHealthIncidentDetails");
        if (incidentDetails == null) {
            errors.add("Раздел «Болезнь»: блок сведений о случае не найден");
        } else {
            Element diseaseBlock = findFirstByLocal(incidentDetails, "DiseaseHealthProblemDetails");
            String dName = diseaseBlock != null ? nz(textByLocal(diseaseBlock, "DiseaseHealthProblemName")) : "";
            if (dName.isEmpty()) {
                errors.add("Болезнь: укажите наименование болезни");
            }
            if (nz(textByLocal(incidentDetails, "EventDate")).isEmpty()) {
                errors.add("Болезнь: дата первого случая должна быть указана");
            }

            List<Element> groupEls = allByLocal(incidentDetails, "PatientGroupDetails");
            if (groupEls.isEmpty()) {
                errors.add("Группа пациентов: добавьте хотя бы одну группу пациентов");
            } else {
                for (int i = 0; i < groupEls.size(); i++) {
                    Element g = groupEls.get(i);
                    String pre = "Группа " + (i + 1) + ": ";
                    if (nz(textByLocal(g, "PersonQuantity")).isEmpty()) {
                        errors.add(pre + "укажите количество человек");
                    }
                    if (nz(textByLocal(g, "AgeGroupCode")).isEmpty()) {
                        errors.add(pre + "укажите возрастную группу");
                    }
                    if (nz(textByLocal(g, "DiseaseOutcomeCode")).isEmpty()) {
                        errors.add(pre + "укажите исход болезни");
                    }
                }
            }

            Element place = findFirstByLocal(incidentDetails, "DetectionPlaceDetails");
            validateDetectionPlace(errors, place, "Место обнаружения");

            Element zone = findFirstByLocal(incidentDetails, "SpreadingZoneDetails");
            validateDetectionPlace(errors, zone, "Зона распространения");
        }

        List<Element> measureCodes = allByLocal(caseBlock, "MeasureCode");
        List<Element> measureNames = allByLocal(caseBlock, "MeasureName");
        if (measureCodes.isEmpty() && measureNames.isEmpty()) {
            errors.add("Санитарные меры: добавьте хотя бы одну санитарную меру");
        }

        return errors;
    }

    private static void validateDetectionPlace(List<String> errors, Element place, String label) {
        if (place == null) {
            errors.add(label + ": раздел не заполнен");
            return;
        }
        Element org = findFirstByLocal(place, "OrganizationDetails");
        if (org == null) {
            errors.add(label + ": организация не указана");
            return;
        }
        if (nz(textByLocal(org, "UnifiedCountryCode")).isEmpty()) {
            errors.add(label + " → организация: укажите страну");
        }
        boolean hasAddr =
                findFirstByLocal(org, "RegistrationAddressDetails") != null
                        || findFirstByLocal(org, "ActualAddressDetails") != null
                        || findFirstByLocal(org, "MailingAddressDetails") != null
                        || findFirstByLocal(org, "ObjectAddressDetails") != null
                        || findFirstByLocal(place, "ObjectAddressDetails") != null;
        if (!hasAddr) {
            errors.add(label + " → организация: укажите хотя бы один адрес");
        }
    }

    private static Element resolveFirstCaseBlock(Element root) {
        List<Element> blocks = allByLocal(root, "PublicHealthAlertDetails");
        if (blocks.isEmpty()) {
            return null;
        }
        if (blocks.size() > 1) {
            return blocks.get(1);
        }
        return blocks.get(0);
    }

    private static String nz(String s) {
        return s == null ? "" : s.trim();
    }

    private static String textByLocal(Element parent, String localName) {
        Element el = findFirstByLocal(parent, localName);
        if (el == null) {
            return "";
        }
        String t = el.getTextContent();
        return t != null ? t.trim() : "";
    }

    private static Element findFirstByLocal(Element parent, String localName) {
        if (parent == null) {
            return null;
        }
        String want = localName.toLowerCase();
        NodeList all = parent.getElementsByTagName("*");
        for (int i = 0; i < all.getLength(); i++) {
            Node n = all.item(i);
            if (!(n instanceof Element)) {
                continue;
            }
            Element el = (Element) n;
            if (localNameMatch(el, want)) {
                return el;
            }
        }
        return null;
    }

    private static List<Element> allByLocal(Element parent, String localName) {
        List<Element> out = new ArrayList<>();
        if (parent == null) {
            return out;
        }
        String want = localName.toLowerCase();
        NodeList all = parent.getElementsByTagName("*");
        for (int i = 0; i < all.getLength(); i++) {
            Node n = all.item(i);
            if (!(n instanceof Element)) {
                continue;
            }
            Element el = (Element) n;
            if (localNameMatch(el, want)) {
                out.add(el);
            }
        }
        return out;
    }

    private static boolean localNameMatch(Element el, String wantLower) {
        String local = el.getLocalName();
        if (local == null || local.isEmpty()) {
            String tag = el.getTagName();
            if (tag != null && tag.contains(":")) {
                local = tag.substring(tag.indexOf(':') + 1);
            } else {
                local = tag;
            }
        }
        return local != null && wantLower.equals(local.toLowerCase());
    }
}
