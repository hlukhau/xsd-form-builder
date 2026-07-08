package com.eec.servlet.sma;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class SmaPathIds {
    final SmaCardKind kind;
    final long id;

    SmaPathIds(SmaCardKind kind, long id) {
        this.kind = kind;
        this.id = id;
    }
}

final class SmaServletUtil {

    private SmaServletUtil() {
    }

    static SmaPathIds parseKindAndId(String pathInfo) {
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            return null;
        }
        String trimmed = pathInfo.startsWith("/") ? pathInfo.substring(1) : pathInfo;
        String[] parts = trimmed.split("/");
        if (parts.length < 2) {
            return null;
        }
        SmaCardKind kind = SmaCardKind.parse(parts[0]);
        if (kind == null) {
            return null;
        }
        try {
            long id = Long.parseLong(parts[1].trim());
            if (id <= 0) {
                return null;
            }
            return new SmaPathIds(kind, id);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    static SmaEligibilityTarget parseEligibilityPath(String pathInfo) {
        if (pathInfo == null || pathInfo.isEmpty() || "/".equals(pathInfo)) {
            return null;
        }
        String trimmed = pathInfo.startsWith("/") ? pathInfo.substring(1) : pathInfo;
        String[] parts = trimmed.split("/");
        if (parts.length < 2) {
            return null;
        }
        String scope = parts[0].trim().toLowerCase();
        try {
            long id = Long.parseLong(parts[1].trim());
            if (id <= 0) {
                return null;
            }
            if ("smd".equals(scope)) {
                return new SmaEligibilityTarget(SmaCardKind.SMAQ, id, 0L);
            }
            if ("smaq".equals(scope)) {
                return new SmaEligibilityTarget(SmaCardKind.SMAR, 0L, id);
            }
        } catch (NumberFormatException ignored) {
        }
        return null;
    }

    static String tsToIso(java.sql.Timestamp ts) {
        if (ts == null) {
            return null;
        }
        return ts.toInstant().toString();
    }

    static String quote(String s) {
        if (s == null) {
            return "null";
        }
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", " ").replace("\r", " ") + "\"";
    }

    static void sendError(HttpServletResponse response, int status, String msg) throws IOException {
        response.setStatus(status);
        PrintWriter out = response.getWriter();
        out.print("{\"error\":" + quote(msg) + "}");
        out.flush();
    }

    static String readBody(HttpServletRequest request) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = request.getReader()) {
            char[] buf = new char[8192];
            int n;
            while ((n = r.read(buf)) >= 0) {
                sb.append(buf, 0, n);
            }
        }
        return sb.toString();
    }

    static String jsonStringField(String json, String field) {
        if (json == null) {
            return null;
        }
        Pattern p = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher m = p.matcher(json);
        if (m.find()) {
            return m.group(1);
        }
        Pattern pNum = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*(-?\\d+)");
        Matcher m2 = pNum.matcher(json);
        if (m2.find()) {
            return m2.group(1);
        }
        return null;
    }

    static Integer getUserIdFromRightsByGuid(String guid) {
        if (guid == null || guid.isEmpty()) {
            return null;
        }
        String rightsJson = com.eec.rights.RightsRegistryProvider.get().getRightsJson(guid.trim());
        if (rightsJson == null || rightsJson.isEmpty()) {
            return null;
        }
        Matcher m = Pattern.compile("\"userId\"\\s*:\\s*(-?\\d+)").matcher(rightsJson);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        m = Pattern.compile("\"userId\"\\s*:\\s*\"(-?\\d+)\"").matcher(rightsJson);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    static SmaCardKind parseKindFromJson(String body) {
        return SmaCardKind.parse(jsonStringField(body, "kind"));
    }
}

final class SmaEligibilityTarget {
    final SmaCardKind createKind;
    final long smdid;
    final long smaqid;

    SmaEligibilityTarget(SmaCardKind createKind, long smdid, long smaqid) {
        this.createKind = createKind;
        this.smdid = smdid;
        this.smaqid = smaqid;
    }
}
