package org.wikimedia.wikibase.qlever.updater;

import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.wikimedia.wikibase.qlever.updater.support.Config;
import org.wikimedia.wikibase.qlever.updater.support.EntityIds;
import org.wikimedia.wikibase.qlever.updater.support.Http;
import org.wikimedia.wikibase.qlever.updater.support.Json;
import org.wikimedia.wikibase.qlever.updater.support.QleverClient;
import org.wikimedia.wikibase.qlever.updater.support.StateFiles;
import org.wikimedia.wikibase.qlever.updater.support.UpdaterMetadata;
import org.wikimedia.wikibase.qlever.updater.support.WikibaseClient;

import de.thetaphi.forbiddenapis.SuppressForbidden;

/** Continuously applies retained Recent Changes to QLever entity graphs. */
final class RecentChangesUpdater {
    private static final DateTimeFormatter MEDIAWIKI_TIMESTAMP =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final Config config;
    private final WikibaseClient wikibase;
    private final QleverClient qlever;

    RecentChangesUpdater(final Config config) {
        this.config = config;
        wikibase = new WikibaseClient(config);
        qlever = new QleverClient(config);
    }

    /**
     * Runs forever, persisting a cursor only after its graph replacement and progress marker succeed.
     */
    @SuppressForbidden
    @SuppressWarnings(
            "IllegalCatch") // The retry boundary must handle every recoverable dependency failure.
    void run() throws Exception {
        RecentChangeCursor cursor = loadCursor();
        final List<Integer> namespaces = wikibase.namespaces();
        int delaySeconds = 5;
        boolean retentionChecked = false;
        boolean pausedForBootstrap = false;
        while (true) {
            try {
                if (Files.exists(StateFiles.BOOTSTRAP_LOCK)) {
                    pausedForBootstrap = true;
                    waitForBootstrap(cursor);
                    continue;
                }
                try (FileChannel updateChannel = StateFiles.openUpdateLock();
                        FileLock updateLock = updateChannel.lock()) {
                    // An exporter may have requested a pause while this updater acquired the lock.
                    if (Files.exists(StateFiles.BOOTSTRAP_LOCK)) {
                        pausedForBootstrap = true;
                        continue;
                    }
                    if (pausedForBootstrap) {
                        cursor = loadCursor();
                        retentionChecked = false;
                        pausedForBootstrap = false;
                    }
                    if (!retentionChecked) {
                        assertCursorIsRetained(cursor, namespaces);
                        retentionChecked = true;
                    }
                    cursor = applyRecentChanges(cursor, namespaces);
                }
                health(cursor, null);
                delaySeconds = 5;
            } catch (Exception error) {
                retentionChecked = false;
                final String message = errorMessage(error);
                System.err.println("qlever updater: " + message);
                health(cursor, message);
                delaySeconds = Math.min(delaySeconds * 2, 60);
            } finally {
                Thread.sleep(delaySeconds * 1000L);
            }
        }
    }

    private RecentChangeCursor loadCursor() throws Exception {
        if (Files.exists(StateFiles.STATE)) {
            return RecentChangeCursor.fromJson(Files.readString(StateFiles.STATE));
        }
        final RecentChangeCursor cursor = RecentChangeCursor.initial();
        saveCursor(cursor);
        return cursor;
    }

    private void saveCursor(final RecentChangeCursor cursor) throws Exception {
        StateFiles.saveText(StateFiles.STATE, cursor.toJson());
    }

    private void waitForBootstrap(final RecentChangeCursor cursor) throws Exception {
        StateFiles.saveText(
                StateFiles.PAUSED,
                Json.write(
                        Map.of("pausedAt", Instant.now().toString(), "pid", ProcessHandle.current().pid())));
        health(cursor, null);
        Thread.sleep(5000);
    }

    private RecentChangeCursor applyRecentChanges(
            RecentChangeCursor cursor, final List<Integer> namespaces) throws Exception {
        final Map<String, Object> response = wikibase.api(recentChangesRequest(cursor, namespaces));
        for (Object rawChange : Json.list(Json.object(response, "query"), "recentchanges")) {
            if (Files.exists(StateFiles.BOOTSTRAP_LOCK)) {
                return cursor;
            }
            final Map<String, Object> change = Json.object(rawChange);
            if (Json.integer(change.get("rcid")) <= cursor.rcid()) {
                continue;
            }
            final String entityId = EntityIds.fromPageTitle(String.valueOf(change.get("title")));
            if (entityId == null) {
                continue;
            }
            replace(entityId);
            cursor =
                    cursor.advancedTo(
                            String.valueOf(change.get("timestamp")), Json.integer(change.get("rcid")));
            qlever.progress(cursor.timestamp(), cursor.rcid());
            saveCursor(cursor);
        }
        return saveContinuation(cursor, response);
    }

    private Map<String, String> recentChangesRequest(
            final RecentChangeCursor cursor, final List<Integer> namespaces) {
        final Map<String, String> parameters =
                new HashMap<>(
                        Map.of(
                                "action",
                                "query",
                                "format",
                                "json",
                                "list",
                                "recentchanges",
                                "rcprop",
                                "title|ids|timestamp|loginfo",
                                "rctype",
                                "edit|new|log",
                                "rclogtype",
                                "delete|move|merge",
                                "rcnamespace",
                                WikibaseClient.namespaceSelection(namespaces),
                                "rcdir",
                                "newer",
                                "rclimit",
                                "50"));
        if (cursor.continuation() != null) {
            parameters.put("rccontinue", cursor.continuation());
        } else {
            parameters.put("rcstart", cursor.timestamp());
        }
        return parameters;
    }

    private RecentChangeCursor saveContinuation(
            final RecentChangeCursor cursor, final Map<String, Object> response) throws Exception {
        final String continuation =
                Json.optionalString(Json.object(response, "continue"), "rccontinue");
        if (continuation != null) {
            final RecentChangeCursor continued = cursor.withContinuation(continuation);
            saveCursor(continued);
            return continued;
        }
        if (cursor.continuation() != null) {
            final RecentChangeCursor completed = cursor.withContinuation(null);
            saveCursor(completed);
            return completed;
        }
        return cursor;
    }

    private void replace(final String id) throws Exception {
        final String timestamp = Instant.now().toString();
        try {
            qlever.replace(
                    id,
                    UpdaterMetadata.withTimestamps(
                            MungerTransformer.transform(
                                    id, wikibase.rdf(id).getBytes(StandardCharsets.UTF_8), config.rdfBase()),
                            config,
                            timestamp));
        } catch (Http.HttpException error) {
            if (error.status() == 404) {
                qlever.replace(id, UpdaterMetadata.timestamp(config, id, timestamp));
            } else {
                throw error;
            }
        }
    }

    private void assertCursorIsRetained(
            final RecentChangeCursor cursor, final List<Integer> namespaces) throws Exception {
        final Map<String, Object> response =
                wikibase.api(
                        Map.of(
                                "action",
                                "query",
                                "format",
                                "json",
                                "list",
                                "recentchanges",
                                "rcprop",
                                "ids|timestamp",
                                "rcnamespace",
                                WikibaseClient.namespaceSelection(namespaces),
                                "rcdir",
                                "newer",
                                "rclimit",
                                "1"));
        final List<Object> changes = Json.list(Json.object(response, "query"), "recentchanges");
        if (changes.isEmpty()) {
            return;
        }
        final Map<String, Object> oldest = Json.object(changes.get(0));
        final boolean tooOld =
                cursor.rcid() < Json.integer(oldest.get("rcid"))
                        && parseTimestamp(cursor.timestamp())
                                .isBefore(parseTimestamp(String.valueOf(oldest.get("timestamp"))));
        if (tooOld) {
            throw new IllegalStateException(
                    "Recent Changes retention no longer covers the updater cursor; run a full reconciliation"
                            + " or bootstrap before resuming");
        }
    }

    private static String errorMessage(final Exception error) {
        return error.getMessage() == null || error.getMessage().isBlank()
                ? error.getClass().getSimpleName()
                : error.getMessage();
    }

    private static Instant parseTimestamp(final String timestamp) {
        if (timestamp.matches("\\d{14}")) {
            return LocalDateTime.parse(timestamp, MEDIAWIKI_TIMESTAMP).toInstant(ZoneOffset.UTC);
        }
        return Instant.parse(timestamp);
    }

    private static void health(final RecentChangeCursor cursor, final String error) throws Exception {
        final Map<String, Object> health = new HashMap<>();
        health.put("checkedAt", Instant.now().toString());
        health.put("state", Json.parseObject(cursor.toJson()));
        if (error != null) {
            health.put("error", error);
        }
        StateFiles.saveText(StateFiles.HEALTH, Json.write(health));
    }
}
