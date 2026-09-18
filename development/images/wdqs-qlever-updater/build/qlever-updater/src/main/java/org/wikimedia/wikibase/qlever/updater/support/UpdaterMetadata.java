package org.wikimedia.wikibase.qlever.updater.support;

import java.util.LinkedHashSet;
import java.util.Set;

/** RDF owned by the updater rather than emitted by Wikibase entity serialization. */
public final class UpdaterMetadata {
    private static final String TIMESTAMP_PREDICATE = "<http://wikiba.se/ontology#timestamp>";
    private static final String DATE_TIME = "<http://www.w3.org/2001/XMLSchema#dateTime>";

    private UpdaterMetadata() {}

    /**
     * Adds timestamps to the changed entity and Lexeme sub-entities in its RDF graph.
     *
     * <p>Mirrors {@code MultiSyncUpdateQueryFactory.buildQuery()}, which combines the changed top
     * entity IDs with {@code RdfRepository.fetchLexemeSubIds()} before its {@code ADD_TIMESTAMPS}
     * step in the Foundation updater.
     */
    public static String withTimestamps(
            final String rdf, final Config config, final String timestamp) {
        final String entityPrefix = "<" + config.rdfBase() + "/entity/";
        final Set<String> ids = new LinkedHashSet<>();
        for (String triple : rdf.split("\\R")) {
            if (!triple.startsWith(entityPrefix)) {
                continue;
            }
            final int subjectEnd = triple.indexOf('>');
            if (subjectEnd > entityPrefix.length()) {
                ids.add(triple.substring(entityPrefix.length(), subjectEnd));
            }
        }
        final StringBuilder result = new StringBuilder(rdf);
        for (String id : ids) {
            result
                    .append(entityPrefix)
                    .append(id)
                    .append("> ")
                    .append(TIMESTAMP_PREDICATE)
                    .append(" \"")
                    .append(timestamp)
                    .append("\"^^")
                    .append(DATE_TIME)
                    .append(" .\n");
        }
        return result.toString();
    }

    /** Produces the deletion tombstone used by the Foundation updater's timestamp step. */
    public static String timestamp(final Config config, final String id, final String timestamp) {
        return "<"
                + config.rdfBase()
                + "/entity/"
                + id
                + "> "
                + TIMESTAMP_PREDICATE
                + " \""
                + timestamp
                + "\"^^"
                + DATE_TIME
                + " .\n";
    }

    /** Identifies the updater-generated timestamp in a normalized N-Triples line. */
    public static boolean isTimestamp(final String triple) {
        return triple.contains(" " + TIMESTAMP_PREDICATE + " ");
    }
}
