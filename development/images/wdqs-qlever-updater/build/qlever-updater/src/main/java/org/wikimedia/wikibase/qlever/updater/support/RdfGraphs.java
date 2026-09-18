package org.wikimedia.wikibase.qlever.updater.support;

import java.util.HashSet;
import java.util.Set;

/** Comparison helpers that ignore known serialization-only RDF differences. */
public final class RdfGraphs {
    private RdfGraphs() {}

    public static Set<String> normalized(final String rdf) {
        final Set<String> lines = new HashSet<>();
        for (String line : rdf.split("\\R")) {
            if (!line.isBlank()) {
                lines.add(
                        line.trim()
                                .replace(
                                        "<http://www.w3.org/2001/XMLSchema#integer>",
                                        "<http://www.w3.org/2001/XMLSchema#int>")
                                .replaceAll("_:[A-Za-z0-9]+", "_:blank"));
            }
        }
        return lines;
    }

    public static Set<String> difference(final Set<String> left, final Set<String> right) {
        final Set<String> result = new HashSet<>(left);
        result.removeAll(right);
        return result;
    }

    /** Removes triples supplied by the updater, which cannot be reconstructed from EntityData. */
    public static Set<String> withoutUpdaterMetadata(final Set<String> triples) {
        final Set<String> result = new HashSet<>(triples);
        result.removeIf(UpdaterMetadata::isTimestamp);
        return result;
    }
}
