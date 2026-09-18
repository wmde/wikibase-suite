package org.wikimedia.wikibase.qlever.updater.support;

import java.io.IOException;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Small JSON conversion helpers for untyped MediaWiki and QLever API responses. */
public final class Json {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private Json() {}

    public static Map<String, Object> parseObject(final String source) throws IOException {
        return MAPPER.readValue(source, new TypeReference<>() {});
    }

    public static String write(final Object value) throws IOException {
        return MAPPER.writeValueAsString(value);
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> object(final Object value) {
        return value == null ? new HashMap<>() : (Map<String, Object>) value;
    }

    public static Map<String, Object> object(final Map<String, Object> value, final String key) {
        return object(value.get(key));
    }

    @SuppressWarnings("unchecked")
    public static List<Object> list(final Map<String, Object> value, final String key) {
        final Object nested = value.get(key);
        return nested instanceof List<?> ? (List<Object>) nested : Collections.emptyList();
    }

    public static int integer(final Object value) {
        return value instanceof Number number
                ? number.intValue()
                : Integer.parseInt(String.valueOf(value));
    }

    public static String optionalString(final Map<String, Object> value, final String key) {
        final Object nested = value.get(key);
        return nested == null ? null : String.valueOf(nested);
    }
}
