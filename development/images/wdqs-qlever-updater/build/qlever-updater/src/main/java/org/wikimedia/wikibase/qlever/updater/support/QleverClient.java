package org.wikimedia.wikibase.qlever.updater.support;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Writes and reads entity-owned named graphs through QLever's Graph Store API. */
public final class QleverClient {
    private static final String STATE_GRAPH = "urn:wikibase-suite:wdqs-qlever-updater-state";
    private final Config config;

    public QleverClient(final Config config) {
        this.config = config;
    }

    public void replace(final String id, final String rdf) throws Exception {
        Http.request(graphUrl(id), "PUT", rdf, auth(Map.of("Content-Type", "application/n-triples")));
    }

    public void delete(final String id) throws Exception {
        Http.request(graphUrl(id), "DELETE", null, auth(Map.of()));
    }

    public String graph(final String id) throws Exception {
        return Http.get(graphUrl(id), Map.of("Accept", "application/n-triples"));
    }

    public void progress(final String timestamp, final int rcid) throws Exception {
        // Mirrors RdfRepositoryUpdater.appendEventTime(): WDQS UI and monitoring read this root
        // schema:dateModified marker, while the private cursor remains for durable recovery.
        final String rdf =
                "<"
                        + config.rdfBase()
                        + "> <http://schema.org/dateModified> \""
                        + timestamp
                        + "\"^^<http://www.w3.org/2001/XMLSchema#dateTime> .\n"
                        + "<"
                        + config.rdfBase()
                        + "/entity/QleverUpdater> <http://wikiba.se/ontology#updatesCompleteUntil> \""
                        + timestamp
                        + "\"^^<http://www.w3.org/2001/XMLSchema#dateTime> .\n"
                        + "<"
                        + config.rdfBase()
                        + "/entity/QleverUpdater> <http://wikiba.se/ontology#updateStreamNextOffset> \""
                        + rcid
                        + "\"^^<http://www.w3.org/2001/XMLSchema#integer> .\n";
        final String stateUrl =
                config.qlever() + "/?graph=" + URLEncoder.encode(STATE_GRAPH, StandardCharsets.UTF_8);
        Http.request(stateUrl, "PUT", rdf, auth(Map.of("Content-Type", "application/n-triples")));
    }

    public List<String> entityGraphs() throws Exception {
        final String query = "SELECT DISTINCT ?graph WHERE { GRAPH ?graph { ?s ?p ?o } }";
        final Map<String, Object> root =
                Json.parseObject(
                        Http.get(
                                config.qlever() + "/?query=" + URLEncoder.encode(query, StandardCharsets.UTF_8),
                                Map.of()));
        final String prefix = config.rdfBase() + "/entity/";
        final List<String> ids = new ArrayList<>();
        for (Object binding : Json.list(Json.object(root, "results"), "bindings")) {
            final String graph =
                    Json.optionalString(Json.object(Json.object(binding).get("graph")), "value");
            if (graph != null && graph.startsWith(prefix)) {
                ids.add(graph.substring(prefix.length()));
            }
        }
        return ids;
    }

    private String graphUrl(final String id) {
        return config.qlever()
                + "/?graph="
                + URLEncoder.encode(config.graph(id), StandardCharsets.UTF_8);
    }

    private Map<String, String> auth(final Map<String, String> headers) {
        final Map<String, String> allHeaders = new HashMap<>(headers);
        if (!config.qleverToken().isEmpty()) {
            allHeaders.put("Authorization", "Bearer " + config.qleverToken());
        }
        return allHeaders;
    }
}
