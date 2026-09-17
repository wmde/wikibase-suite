package org.wikimedia.wikibase.qlever.updater;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;

import org.wikimedia.wikibase.qlever.updater.support.Json;

/** Durable position in the Wikibase Recent Changes stream. */
record RecentChangeCursor(String timestamp, int rcid, String continuation) {
    static RecentChangeCursor initial() {
        return new RecentChangeCursor(
                Instant.now().truncatedTo(ChronoUnit.SECONDS).toString(), 0, null);
    }

    static RecentChangeCursor fromJson(final String source) throws Exception {
        final Map<String, Object> state = Json.parseObject(source);
        return new RecentChangeCursor(
                String.valueOf(state.get("timestamp")),
                Json.integer(state.get("rcid")),
                Json.optionalString(state, "continue"));
    }

    RecentChangeCursor advancedTo(final String nextTimestamp, final int nextRcid) {
        // The continuation is for one response page only. Persisting it alongside a newly handled
        // change could resume part way through a different page after an interruption.
        return new RecentChangeCursor(nextTimestamp, nextRcid, null);
    }

    RecentChangeCursor withContinuation(final String nextContinuation) {
        return new RecentChangeCursor(timestamp, rcid, nextContinuation);
    }

    String toJson() throws Exception {
        final Map<String, Object> value = new HashMap<>();
        value.put("timestamp", timestamp);
        value.put("rcid", rcid);
        if (continuation != null) {
            value.put("continue", continuation);
        }
        return Json.write(value);
    }
}
