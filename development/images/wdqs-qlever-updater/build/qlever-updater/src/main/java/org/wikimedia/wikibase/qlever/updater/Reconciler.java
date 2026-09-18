package org.wikimedia.wikibase.qlever.updater;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;

import org.wikimedia.wikibase.qlever.updater.support.Config;
import org.wikimedia.wikibase.qlever.updater.support.EntityIds;
import org.wikimedia.wikibase.qlever.updater.support.RdfGraphs;

/** Verifies all source entities and can repair drift or orphaned graphs. */
final class Reconciler extends Verifier {
    Reconciler(final Config config) {
        super(config);
    }

    void run(final List<String> arguments) throws Exception {
        final boolean repair = arguments.contains("--repair");
        final boolean all = arguments.contains("--all");
        List<String> ids = arguments.stream().filter(argument -> !argument.startsWith("--")).toList();
        if (!all && ids.isEmpty()) {
            throw new IllegalArgumentException("Provide entity IDs or --all");
        }
        if (all) {
            ids = wikibase.allIds(wikibase.namespaces());
        }
        int drifted = reconcileEntities(ids, repair);
        if (all) {
            drifted += reconcileOrphans(Set.copyOf(ids), repair);
        }
        if (drifted > 0 && !repair) {
            throw new IllegalStateException("Entity graph drift detected");
        }
    }

    private int reconcileEntities(final List<String> ids, final boolean repair) throws Exception {
        int drifted = 0;
        for (String id : ids) {
            EntityIds.requireValid(id);
            final String expectedRdf =
                    MungerTransformer.transform(
                            id, wikibase.rdf(id).getBytes(StandardCharsets.UTF_8), config.rdfBase());
            final Set<String> expected = RdfGraphs.normalized(expectedRdf);
            final Set<String> actual =
                    RdfGraphs.withoutUpdaterMetadata(RdfGraphs.normalized(qlever.graph(id)));
            if (expected.equals(actual)) {
                System.out.println(id + " OK");
                continue;
            }
            drifted++;
            System.out.println(
                    id + " DRIFT (expected " + expected.size() + ", got " + actual.size() + ")");
            if (repair) {
                qlever.replace(id, expectedRdf);
                System.out.println(id + " REPAIRED");
            }
        }
        return drifted;
    }

    private int reconcileOrphans(final Set<String> ids, final boolean repair) throws Exception {
        int drifted = 0;
        for (String orphan : qlever.entityGraphs()) {
            if (ids.contains(orphan)) {
                continue;
            }
            drifted++;
            System.out.println(orphan + " ORPHAN");
            if (repair) {
                qlever.delete(orphan);
            }
        }
        return drifted;
    }
}
