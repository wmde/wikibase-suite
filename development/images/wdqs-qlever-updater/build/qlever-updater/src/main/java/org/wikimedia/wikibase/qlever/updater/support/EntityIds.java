package org.wikimedia.wikibase.qlever.updater.support;

import java.util.regex.Pattern;

/** Parses and validates Wikibase entity identifiers. */
public final class EntityIds {
    private static final Pattern ENTITY_ID = Pattern.compile("^[A-Za-z][A-Za-z0-9-]*\\d+$");

    private EntityIds() {}

    public static void requireValid(final String id) {
        if (!ENTITY_ID.matcher(id).matches()) {
            throw new IllegalArgumentException("Invalid entity ID: " + id);
        }
    }

    public static String fromPageTitle(final String title) {
        final int colon = title.lastIndexOf(':');
        return colon >= 0 ? title.substring(colon + 1) : null;
    }
}
