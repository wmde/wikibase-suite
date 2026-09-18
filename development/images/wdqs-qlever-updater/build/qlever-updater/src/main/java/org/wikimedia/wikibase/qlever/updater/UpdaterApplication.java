package org.wikimedia.wikibase.qlever.updater;

import java.util.Arrays;
import java.util.List;

import org.wikimedia.wikibase.qlever.updater.support.Config;

import de.thetaphi.forbiddenapis.SuppressForbidden;

/** Coordinates the updater image's commands. */
final class UpdaterApplication {
    private UpdaterApplication() {}

    /** Dispatches the image's operational commands. */
    @SuppressForbidden
    @SuppressWarnings("IllegalCatch") // Command boundary reports every operational failure to stderr.
    static void run(final String[] arguments) {
        final String command = arguments.length == 0 ? "updater" : arguments[0];
        final String[] args =
                Arrays.copyOfRange(arguments, Math.min(arguments.length, 1), arguments.length);
        try {
            final Config config = Config.fromEnvironment();
            switch (command) {
                case "updater" -> new RecentChangesUpdater(config).run();
                case "bootstrap" -> new FullExporter(config).bootstrap();
                case "entity-graph-dump" -> new FullExporter(config).export();
                case "verify" -> new Verifier(config).verify(List.of(args));
                case "reconcile" -> new Reconciler(config).run(List.of(args));
                case "transform" -> transform(args);
                default -> throw new IllegalArgumentException("Unknown updater command: " + command);
            }
        } catch (Exception error) {
            System.err.println("wdqs-qlever-updater: " + error.getMessage());
            error.printStackTrace(System.err);
            System.exit(1);
        }
    }

    /** Runs the Foundation Munger over RDF supplied on standard input. */
    private static void transform(final String[] args) throws Exception {
        if (args.length != 2) {
            throw new IllegalArgumentException("Usage: transform ENTITY-ID RDF-BASE");
        }
        System.out.print(MungerTransformer.transform(args[0], System.in.readAllBytes(), args[1]));
    }
}
