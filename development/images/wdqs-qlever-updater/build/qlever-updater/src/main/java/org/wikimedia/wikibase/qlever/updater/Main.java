package org.wikimedia.wikibase.qlever.updater;

import de.thetaphi.forbiddenapis.SuppressForbidden;

/** Entry point for the WDQS-compatible QLever updater image. */
public final class Main {
    private Main() {}

    /** Delegates command execution to the updater application. */
    @SuppressForbidden
    public static void main(final String[] arguments) {
        UpdaterApplication.run(arguments);
    }
}
