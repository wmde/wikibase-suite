package org.wikimedia.wikibase.qlever.updater.support;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Reads entity metadata and RDF exports from the Wikibase API. */
public final class WikibaseClient {
    private final Config config;

    public WikibaseClient(final Config config) {
        this.config = config;
    }

    public Map<String, Object> api(final Map<String, String> parameters) throws Exception {
        final Map<String, Object> response =
                Json.parseObject(Http.get(config.api(parameters), Map.of()));
        final Map<String, Object> error = Json.object(response, "error");
        if (!error.isEmpty()) {
            throw new IllegalStateException(
                    "Wikibase API error "
                            + Json.optionalString(error, "code")
                            + ": "
                            + Json.optionalString(error, "info"));
        }
        return response;
    }

    public String rdf(final String id) throws Exception {
        return Http.get(config.wikibase() + "/wiki/Special:EntityData/" + id + ".nt", Map.of());
    }

    public List<Integer> namespaces() throws Exception {
        final String override = System.getenv().getOrDefault("WIKIBASE_ENTITY_NAMESPACES", "").trim();
        if (!override.isEmpty()) {
            return Arrays.stream(override.split(","))
                    .map(String::trim)
                    .map(WikibaseClient::namespaceId)
                    .toList();
        }
        final Map<String, Object> root =
                api(
                        Map.of(
                                "action", "query", "format", "json", "meta", "siteinfo", "siprop", "namespaces"));
        final Map<String, Object> namespaces = Json.object(Json.object(root, "query"), "namespaces");
        final Set<String> entityModels =
                Set.of(
                        "wikibase-item",
                        "wikibase-property",
                        "wikibase-lexeme",
                        "wikibase-mediainfo",
                        "EntitySchema");
        final List<Integer> result = new ArrayList<>();
        for (Object rawNamespace : namespaces.values()) {
            final Map<String, Object> namespace = Json.object(rawNamespace);
            final Object model = namespace.getOrDefault("defaultcontentmodel", namespace.get("content"));
            if (model instanceof String && entityModels.contains(model)) {
                result.add(Json.integer(namespace.get("id")));
            }
        }
        if (result.isEmpty()) {
            throw new IllegalStateException(
                    "Could not discover Wikibase entity namespaces; set WIKIBASE_ENTITY_NAMESPACES"
                            + " explicitly");
        }
        return result;
    }

    public List<String> allIds(final List<Integer> namespaces) throws Exception {
        final List<String> ids = new ArrayList<>();
        for (Integer namespace : namespaces) {
            String continuation = null;
            do {
                final Map<String, String> parameters =
                        new HashMap<>(
                                Map.of(
                                        "action",
                                        "query",
                                        "format",
                                        "json",
                                        "list",
                                        "allpages",
                                        "apnamespace",
                                        namespace.toString(),
                                        "aplimit",
                                        "500"));
                if (continuation != null) {
                    parameters.put("apcontinue", continuation);
                }
                final Map<String, Object> response = api(parameters);
                for (Object rawPage : Json.list(Json.object(response, "query"), "allpages")) {
                    final String entityId =
                            EntityIds.fromPageTitle(String.valueOf(Json.object(rawPage).get("title")));
                    if (entityId != null) {
                        ids.add(entityId);
                    }
                }
                continuation = Json.optionalString(Json.object(response, "continue"), "apcontinue");
            } while (continuation != null);
        }
        return ids;
    }

    public static String namespaceSelection(final List<Integer> values) {
        return values.stream()
                .map(String::valueOf)
                .reduce((left, right) -> left + "|" + right)
                .orElse("");
    }

    private static Integer namespaceId(final String value) {
        if (!value.matches("-?\\d+")) {
            throw new IllegalArgumentException(
                    "WIKIBASE_ENTITY_NAMESPACES must be a comma-separated list of namespace IDs");
        }
        return Integer.valueOf(value);
    }
}
