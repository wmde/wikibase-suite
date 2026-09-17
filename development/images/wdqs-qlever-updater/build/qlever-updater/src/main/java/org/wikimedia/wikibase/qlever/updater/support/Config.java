package org.wikimedia.wikibase.qlever.updater.support;

import java.util.Map;

/** Runtime configuration shared by updater commands. */
public record Config(
        String wikibase,
        String rdfBase,
        String qlever,
        String qleverToken,
        String exportToken,
        int chunkSize) {
    /** Reads configuration from the image's documented environment variables. */
    public static Config fromEnvironment() {
        final Map<String, String> environment = System.getenv();
        final String wikibase = trim(environment.getOrDefault("WIKIBASE_URL", "http://wikibase"));
        final String rdfBase = trim(environment.getOrDefault("WIKIBASE_RDF_BASE", wikibase));
        final int chunkSize =
                Integer.parseInt(environment.getOrDefault("QLEVER_EXPORT_CHUNK_SIZE", "100"));
        if (chunkSize < 1 || chunkSize > 500) {
            throw new IllegalArgumentException("QLEVER_EXPORT_CHUNK_SIZE must be between 1 and 500");
        }
        return new Config(
                wikibase,
                rdfBase,
                trim(environment.getOrDefault("QLEVER_URL", "http://qlever:7001")),
                environment.getOrDefault("QLEVER_ACCESS_TOKEN", ""),
                environment.getOrDefault("QLEVER_EXPORT_TOKEN", ""),
                chunkSize);
    }

    public String graph(final String id) {
        return rdfBase + "/entity/" + id;
    }

    public String api(final Map<String, String> parameters) {
        return wikibase + "/w/api.php?" + Http.query(parameters);
    }

    private static String trim(final String value) {
        return value.replaceFirst("/+$", "");
    }
}
