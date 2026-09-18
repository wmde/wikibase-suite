package org.wikimedia.wikibase.qlever.updater;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;

import org.wikimedia.wikibase.qlever.updater.support.Config;
import org.wikimedia.wikibase.qlever.updater.support.EntityIds;
import org.wikimedia.wikibase.qlever.updater.support.QleverClient;
import org.wikimedia.wikibase.qlever.updater.support.RdfGraphs;
import org.wikimedia.wikibase.qlever.updater.support.WikibaseClient;

/** Compares selected source entities with their QLever named graphs. */
class Verifier {
    final Config config;
    final WikibaseClient wikibase;
    final QleverClient qlever;

    Verifier(final Config config) {
        this.config = config;
        wikibase = new WikibaseClient(config);
        qlever = new QleverClient(config);
    }

    /** Fails when a selected graph does not exactly match its transformed source. */
    void verify(final List<String> ids) throws Exception {
        if (ids.isEmpty()) {
            throw new IllegalArgumentException("Provide at least one entity ID");
        }
        for (String id : ids) {
            EntityIds.requireValid(id);
            final Set<String> expected =
                    RdfGraphs.normalized(
                            MungerTransformer.transform(
                                    id, wikibase.rdf(id).getBytes(StandardCharsets.UTF_8), config.rdfBase()));
            final Set<String> actual =
                    RdfGraphs.withoutUpdaterMetadata(RdfGraphs.normalized(qlever.graph(id)));
            if (!expected.equals(actual)) {
                throw new IllegalStateException(
                        id
                                + " differs: missing="
                                + RdfGraphs.difference(expected, actual).size()
                                + ", unexpected="
                                + RdfGraphs.difference(actual, expected).size());
            }
            System.out.println(id + " OK (" + actual.size() + " triples)");
        }
    }
}
