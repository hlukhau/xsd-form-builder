package com.eec.servlet.dpr;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.StringReader;
import java.io.StringWriter;

/**
 * Точечное обновление XML DPR: уполномоченный орган и текст описания результатов (csdo:DescriptionText).
 */
public final class DprXmlPatcher {

    private static final String NS_DOC = "urn:EEC:R:SM:SS:08:DangerousProductAlertResponse:v1.0.0";
    private static final String NS_CCDO = "urn:EEC:M:ComplexDataObjects:v0.4.12";
    private static final String NS_CSDO = "urn:EEC:M:SimpleDataObjects:v0.4.12";

    private DprXmlPatcher() {
    }

    public static String patchAuthorityAndDescription(
            String xmlBody,
            String authorityId,
            String authorityName,
            String authorityBriefName,
            String descriptionText
    ) throws Exception {
        if (xmlBody == null || xmlBody.trim().isEmpty()) {
            throw new IllegalArgumentException("Пустой XML");
        }
        DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
        f.setNamespaceAware(true);
        DocumentBuilder b = f.newDocumentBuilder();
        Document doc = b.parse(new org.xml.sax.InputSource(new StringReader(xmlBody)));

        Element root = findRoot(doc);
        if (root == null) {
            throw new IllegalArgumentException("Не найден корень DangerousProductAlertResponseDetails");
        }

        Element auth = findFirstChildElement(root, "UnifiedAuthorityDetails");
        if (auth == null) {
            throw new IllegalArgumentException("В XML карты отсутствует блок UnifiedAuthorityDetails");
        }
        setOrCreateChildText(doc, auth, NS_CSDO, "AuthorityId", authorityId);
        setOrCreateChildText(doc, auth, NS_CSDO, "AuthorityName", authorityName);
        setOrCreateChildText(doc, auth, NS_CSDO, "AuthorityBriefName", authorityBriefName);

        String desc = descriptionText != null ? descriptionText.trim() : "";
        Element descEl = findFirstChildElement(root, "DescriptionText");
        if (desc.isEmpty()) {
            if (descEl != null) {
                root.removeChild(descEl);
            }
        } else {
            if (descEl == null) {
                descEl = doc.createElementNS(NS_CSDO, "DescriptionText");
                appendDescriptionAfterIncident(root, descEl);
            }
            descEl.setTextContent(desc);
        }

        TransformerFactory tf = TransformerFactory.newInstance();
        Transformer tr = tf.newTransformer();
        tr.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "no");
        tr.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
        tr.setOutputProperty(OutputKeys.INDENT, "no");
        StringWriter sw = new StringWriter();
        tr.transform(new DOMSource(doc), new StreamResult(sw));
        return sw.toString();
    }

    private static Element findRoot(Document doc) {
        NodeList all = doc.getElementsByTagNameNS(NS_DOC, "DangerousProductAlertResponseDetails");
        if (all.getLength() > 0) {
            return (Element) all.item(0);
        }
        NodeList star = doc.getElementsByTagNameNS("*", "DangerousProductAlertResponseDetails");
        if (star.getLength() > 0) {
            return (Element) star.item(0);
        }
        return null;
    }

    private static Element findFirstChildElement(Element parent, String localName) {
        String want = localName.toLowerCase();
        NodeList nl = parent.getChildNodes();
        for (int i = 0; i < nl.getLength(); i++) {
            Node n = nl.item(i);
            if (n instanceof Element) {
                Element el = (Element) n;
                String ln = el.getLocalName();
                if (ln == null) {
                    String tag = el.getTagName();
                    int c = tag.indexOf(':');
                    ln = c >= 0 ? tag.substring(c + 1) : tag;
                }
                if (ln != null && want.equals(ln.toLowerCase())) {
                    return el;
                }
            }
        }
        return null;
    }

    private static void setOrCreateChildText(Document doc, Element parent, String ns, String local, String value) {
        Element child = findFirstChildElement(parent, local);
        String v = value != null ? value.trim() : "";
        if (child == null) {
            if (v.isEmpty()) {
                return;
            }
            child = doc.createElementNS(ns, local);
            parent.appendChild(child);
        }
        child.setTextContent(v);
    }

    /** Вставить DescriptionText после IncidentAlertIdDetails, иначе в конец корня. */
    private static void appendDescriptionAfterIncident(Element root, Element descEl) {
        Element inc = findFirstChildElement(root, "IncidentAlertIdDetails");
        if (inc != null) {
            Node next = inc.getNextSibling();
            while (next != null && next.getNodeType() != Node.ELEMENT_NODE) {
                next = next.getNextSibling();
            }
            if (next != null) {
                root.insertBefore(descEl, next);
            } else {
                root.appendChild(descEl);
            }
        } else {
            root.appendChild(descEl);
        }
    }
}
