package com.eec.servlet;

import com.eec.util.XsdMessageHumanizer;
import org.xml.sax.ErrorHandler;
import org.xml.sax.SAXException;
import org.xml.sax.SAXParseException;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.xml.XMLConstants;
import javax.xml.transform.stream.StreamSource;
import javax.xml.validation.Schema;
import javax.xml.validation.SchemaFactory;
import javax.xml.validation.Validator;
import java.io.IOException;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.PrintWriter;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Валидация тела XML по XSD ЕЭК (DPA / PHA / DPR).
 * POST /api/xml/validate-schema
 * Заголовок X-Document-Type: dpa | pha | ppv | smd | dpr (ppv — та же XSD, что и dpa).
 * Тело: application/xml (сырой XML документа).
 * Ответ: application/json UTF-8 — {"errors":["…"]} (пустой массив при успехе).
 * Ошибки в блоках ccdo:EDocHeader и ccdo:ResourceItemStatusDetails в ответ не включаются.
 */
public class XmlSchemaValidateServlet extends HttpServlet {

    private static final String HDR_TYPE = "X-Document-Type";

    private volatile Schema schemaDpa;
    private volatile Schema schemaPha;
    private volatile Schema schemaDpr;
    private volatile Schema schemaSmd;

    @Override
    public void init() throws ServletException {
        super.init();
        try {
            schemaDpa = loadSchema("EEC_R_SM_SS_08_DangerousProductAlert_v1.0.0.xsd");
            schemaPha = loadSchema("EEC_R_SM_SS_08_PublicHealthAlert_v1.0.0.xsd");
            System.out.println("[XmlSchemaValidateServlet] XSD schemas loaded (DPA, PHA)");
        } catch (Exception e) {
            throw new ServletException("Failed to load EEC XSD from classpath eec-xsd/", e);
        }
        try {
            schemaDpr = loadSchema("EEC_R_SM_SS_08_DangerousProductAlertResponse_v1.0.0.xsd");
            System.out.println("[XmlSchemaValidateServlet] XSD schema loaded (DPR)");
        } catch (Exception e) {
            schemaDpr = null;
            System.err.println("[XmlSchemaValidateServlet] DPR XSD not loaded: " + e.getMessage());
        }
        try {
            schemaSmd = loadSchema("EEC_R_SM_SS_09_SanitaryMeasureDetails_v1.0.0.xsd");
            System.out.println("[XmlSchemaValidateServlet] XSD schema loaded (SMD)");
        } catch (Exception e) {
            schemaSmd = null;
            System.err.println("[XmlSchemaValidateServlet] SMD XSD not loaded: " + e.getMessage());
        }
    }

    /**
     * Загружает корневую схему из classpath (eec-xsd/…).
     * Не используем {@link java.io.File}: при деплое WAR без распаковки URL имеет вид {@code jar:file:…}, и {@code new File(uri)} падает.
     */
    private static Schema loadSchema(String rootFileName) throws SAXException, IOException {
        String path = "eec-xsd/" + rootFileName;
        URL rootUrl = XmlSchemaValidateServlet.class.getClassLoader().getResource(path);
        if (rootUrl == null) {
            throw new IOException("Classpath resource not found: " + path + " (run Maven process-resources)");
        }
        SchemaFactory factory = SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI);
        try {
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        } catch (SAXException ignored) {
            // старые парсеры
        }
        // При FSP=true JDK по умолчанию блокирует file: для xs:import — без явного разрешения локальные EEC_*.xsd не подгружаются.
        applyExternalAccessPolicy(factory);
        try (InputStream in = rootUrl.openStream()) {
            StreamSource src = new StreamSource(in, rootUrl.toExternalForm());
            return factory.newSchema(src);
        }
    }

    /**
     * Разрешает чтение связанных схем с диска / из того же JAR (Tomcat/JDK часто задают пустое accessExternalSchema при secure processing).
     */
    private static void applyExternalAccessPolicy(SchemaFactory factory) {
        final String[] candidates = new String[] { "all", "file", "jar,file", "http,https,file,jar" };
        for (String v : candidates) {
            try {
                factory.setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA, v);
                factory.setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, v);
                return;
            } catch (SAXException | IllegalArgumentException ignored) {
                // пробуем следующий вариант
            }
        }
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");

        try {
            doPostValidated(request, response);
        } catch (Throwable t) {
            t.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.setContentType("application/json;charset=UTF-8");
            String detail = t.getMessage() != null ? t.getMessage() : t.getClass().getSimpleName();
            writeJsonErrors(response.getWriter(), Collections.singletonList(
                    "Внутренняя ошибка при проверке XSD: " + detail));
        }
    }

    private void doPostValidated(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String docType = request.getHeader(HDR_TYPE);
        if (docType == null) {
            docType = "";
        }
        docType = docType.trim().toLowerCase(Locale.ROOT);
        Schema schema;
        if ("dpa".equals(docType) || "ppv".equals(docType)) {
            schema = schemaDpa;
        } else if ("pha".equals(docType)) {
            schema = schemaPha;
        } else if ("dpr".equals(docType)) {
            schema = schemaDpr;
        } else if ("smd".equals(docType)) {
            schema = schemaSmd;
        } else {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json;charset=UTF-8");
            writeJsonErrors(response.getWriter(), Collections.singletonList(
                    "Укажите заголовок " + HDR_TYPE + ": dpa, pha, ppv, smd или dpr"));
            return;
        }
        if (schema == null) {
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            response.setContentType("application/json;charset=UTF-8");
            writeJsonErrors(response.getWriter(), Collections.singletonList("Схема XSD не загружена на сервере"));
            return;
        }

        String xml = readBody(request);
        if (xml == null || xml.trim().isEmpty()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json;charset=UTF-8");
            writeJsonErrors(response.getWriter(), Collections.singletonList("Пустое тело запроса (ожидается XML)"));
            return;
        }

        int[][] skipRanges = computeExcludedLineRanges(xml);
        final List<Integer> errorLines = new ArrayList<Integer>();
        final List<String> errorMsgs = new ArrayList<String>();
        Validator validator = schema.newValidator();
        validator.setErrorHandler(new ErrorHandler() {
            @Override
            public void warning(SAXParseException e) {
                addIfNeeded(e, false);
            }

            @Override
            public void error(SAXParseException e) {
                addIfNeeded(e, false);
            }

            @Override
            public void fatalError(SAXParseException e) {
                addIfNeeded(e, true);
            }

            private void addIfNeeded(SAXParseException e, boolean fatal) {
                int line = e.getLineNumber();
                String msg = e.getMessage();
                if (msg == null) {
                    msg = fatal ? "Критическая ошибка разбора XML" : "Ошибка валидации";
                }
                if (shouldSkipValidationMessage(msg, line, skipRanges)) {
                    return;
                }
                errorLines.add(line > 0 ? line : 0);
                errorMsgs.add(msg);
            }
        });
        try {
            validator.validate(new StreamSource(new java.io.StringReader(xml)));
        } catch (SAXException e) {
            if (errorMsgs.isEmpty()) {
                errorLines.add(0);
                String em = e.getMessage();
                errorMsgs.add(em != null ? em : "Ошибка валидации XML");
            }
        }

        List<String> out = new ArrayList<>();
        for (int i = 0; i < errorMsgs.size(); i++) {
            int ln = errorLines.get(i);
            String h = XsdMessageHumanizer.humanizeFull(errorMsgs.get(i), ln, xml, docType);
            if (!shouldSkipValidationMessage(h, -1, skipRanges) && !out.contains(h)) {
                out.add(h);
            }
        }
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType("application/json;charset=UTF-8");
        writeJsonErrors(response.getWriter(), out);
    }


    private static String readBody(HttpServletRequest request) throws IOException {
        try (InputStream in = request.getInputStream()) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] b = new byte[8192];
            int n;
            while ((n = in.read(b)) >= 0) {
                buf.write(b, 0, n);
            }
            return buf.toString(StandardCharsets.UTF_8.name());
        }
    }

    /**
     * Диапазоны номеров строк (1-based), где находятся исключаемые из отчёта блоки.
     */
    private static int[][] computeExcludedLineRanges(String xml) {
        List<int[]> ranges = new ArrayList<>();
        addBlockRanges(xml, "EDocHeader", ranges);
        addBlockRanges(xml, "ResourceItemStatusDetails", ranges);
        return ranges.toArray(new int[ranges.size()][]);
    }

    private static void addBlockRanges(String xml, String localName, List<int[]> ranges) {
        Pattern open = Pattern.compile("<(\\w+:)?" + Pattern.quote(localName) + "\\b[^>]*>");
        Pattern close = Pattern.compile("</(\\w+:)?" + Pattern.quote(localName) + "\\s*>");
        String[] lines = xml.split("\r\n|\n|\r", -1);
        int depth = 0;
        int startLine = -1;
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            Matcher mo = open.matcher(line);
            while (mo.find()) {
                if (depth == 0) {
                    startLine = i + 1;
                }
                depth++;
            }
            Matcher mc = close.matcher(line);
            while (mc.find()) {
                depth--;
                if (depth <= 0) {
                    depth = 0;
                    if (startLine >= 0) {
                        ranges.add(new int[]{startLine, i + 1});
                    }
                    startLine = -1;
                }
            }
        }
    }

    private static boolean shouldSkipValidationMessage(String message, int lineNumber, int[][] skipRanges) {
        if (message == null) {
            return false;
        }
        String m = message.toLowerCase(Locale.ROOT);
        if (m.contains("edocheader")) {
            return true;
        }
        if (m.contains("resourceitemstatusdetails")) {
            return true;
        }
        if (lineNumber > 0 && skipRanges != null) {
            for (int[] r : skipRanges) {
                if (r.length == 2 && lineNumber >= r[0] && lineNumber <= r[1]) {
                    return true;
                }
            }
        }
        return false;
    }

    private static void writeJsonErrors(PrintWriter w, List<String> errors) {
        w.print("{\"errors\":[");
        for (int i = 0; i < errors.size(); i++) {
            if (i > 0) {
                w.print(',');
            }
            w.print('"');
            w.print(escapeJson(errors.get(i)));
            w.print('"');
        }
        w.print("]}");
    }

    private static String escapeJson(String s) {
        if (s == null) {
            return "";
        }
        StringBuilder b = new StringBuilder(s.length() + 16);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\':
                    b.append("\\\\");
                    break;
                case '"':
                    b.append("\\\"");
                    break;
                case '\n':
                    b.append("\\n");
                    break;
                case '\r':
                    b.append("\\r");
                    break;
                case '\t':
                    b.append("\\t");
                    break;
                default:
                    if (c < 0x20) {
                        b.append(String.format("\\u%04x", (int) c));
                    } else {
                        b.append(c);
                    }
            }
        }
        return b.toString();
    }
}
