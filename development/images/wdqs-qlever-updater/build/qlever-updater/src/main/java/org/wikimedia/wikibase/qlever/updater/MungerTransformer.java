package org.wikimedia.wikibase.qlever.updater;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.eclipse.rdf4j.model.Statement;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.eclipse.rdf4j.rio.RDFHandler;
import org.eclipse.rdf4j.rio.RDFParser;
import org.eclipse.rdf4j.rio.Rio;
import org.eclipse.rdf4j.rio.helpers.AbstractRDFHandler;
import org.eclipse.rdf4j.rio.ntriples.NTriplesWriter;
import org.wikidata.query.rdf.common.uri.UrisSchemeFactory;
import org.wikidata.query.rdf.tool.rdf.Munger;

/**
 * Applies the Foundation Munger to a single Wikibase entity RDF document.
 *
 * <p>WDQS exposes Wikibase {@code somevalue} snaks as blank nodes. Because the updater replaces a
 * complete entity-owned graph, their lifecycle is safe without skolemization and this preserves
 * observable WDQS RDF behavior.
 */
final class MungerTransformer {
    private MungerTransformer() {}

    /** Converts a raw MediaWiki N-Triples export into WDQS-compatible RDF. */
    static String transform(final String id, final byte[] raw, final String rdfBase)
            throws Exception {
        final List<Statement> statements = new ArrayList<>();
        final RDFParser parser = Rio.createParser(RDFFormat.NTRIPLES);

        parser.setRDFHandler(
                new AbstractRDFHandler() {
                    @Override
                    public void handleStatement(final Statement statement) {
                        statements.add(statement);
                    }
                });
        parser.parse(new ByteArrayInputStream(raw), rdfBase);

        final Munger munger =
                Munger.builder(UrisSchemeFactory.forWikidata(URI.create(rdfBase)))
                        .convertBNodesToSkolemIRIs(false)
                        .build();
        munger.munge(id, statements);

        final ByteArrayOutputStream output = new ByteArrayOutputStream();
        final RDFHandler writer = new NTriplesWriter(output);
        writer.startRDF();
        for (Statement statement : statements) {
            writer.handleStatement(statement);
        }
        writer.endRDF();

        return output.toString(StandardCharsets.UTF_8);
    }
}
