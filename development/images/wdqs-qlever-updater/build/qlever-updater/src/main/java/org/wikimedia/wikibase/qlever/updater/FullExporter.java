package org.wikimedia.wikibase.qlever.updater;

import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.channels.OverlappingFileLockException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.wikimedia.wikibase.qlever.updater.support.Config;
import org.wikimedia.wikibase.qlever.updater.support.Http;
import org.wikimedia.wikibase.qlever.updater.support.Json;
import org.wikimedia.wikibase.qlever.updater.support.StateFiles;
import org.wikimedia.wikibase.qlever.updater.support.WikibaseClient;

import de.thetaphi.forbiddenapis.SuppressForbidden;

/** Creates a resumable, Munger-compatible full export for QLever indexing. */
final class FullExporter {
    private final Config config;
    private final WikibaseClient wikibase;

    FullExporter(final Config config) {
        this.config = config;
        wikibase = new WikibaseClient(config);
    }

    /** Skips the expensive export when QLever already has bootstrap metadata. */
    void bootstrap() throws Exception {
        if (Files.exists(StateFiles.DATA.resolve("wikibase.meta-data.json"))
                && !"true".equals(System.getenv("BOOTSTRAP_FORCE"))) {
            System.err.println("QLever index already exists; skipping bootstrap dump");
            return;
        }
        export();
    }

    /** Exports entity graphs in checkpoints so interrupted full index builds can resume. */
    @SuppressForbidden
    void export() throws Exception {
        if (config.exportToken().isEmpty()) {
            throw new IllegalStateException("Missing QLever export token");
        }
        final Path chunks = StateFiles.DATA.resolve("qlever-export-chunks");
        final Path checkpointFile = StateFiles.DATA.resolve("qlever-export-checkpoint.json");
        Files.createDirectories(chunks);
        try (BootstrapLock ignored = BootstrapLock.acquire();
                FileChannel updateChannel = StateFiles.openUpdateLock();
                FileLock updateLock = updateChannel.lock()) {
            Map<String, Object> checkpoint = loadCheckpoint(checkpointFile);
            while (true) {
                final Map<String, Object> response = exportPage(checkpoint);
                final List<Object> entities = Json.list(response, "entities");
                if (!entities.isEmpty()) {
                    checkpoint = writeChunk(chunks, checkpoint, entities);
                }
                checkpoint = saveCheckpoint(checkpointFile, checkpoint, response);
                if ("1".equals(String.valueOf(response.get("complete")))) {
                    break;
                }
            }
            assembleExport(chunks, checkpoint);
            StateFiles.saveText(StateFiles.STATE, Json.write(Json.object(checkpoint.get("highWater"))));
            checkpoint.put("status", "complete");
            checkpoint.put("completedAt", Instant.now().toString());
            StateFiles.saveText(checkpointFile, Json.write(checkpoint));
            Files.writeString(StateFiles.DATA.resolve("qlever-bootstrap-required"), "required\n");
            System.err.println(
                    "Wrote "
                            + checkpoint.get("entities")
                            + " entity graphs in "
                            + checkpoint.get("chunk")
                            + " resumable chunks to "
                            + StateFiles.DATA.resolve("wikibase.nq"));
        }
    }

    private Map<String, Object> loadCheckpoint(final Path checkpointFile) throws Exception {
        final Map<String, Object> checkpoint =
                Files.exists(checkpointFile)
                        ? Json.parseObject(Files.readString(checkpointFile))
                        : Map.of();
        if ("exporting".equals(checkpoint.get("status"))) {
            return checkpoint;
        }
        final Map<String, Object> fresh =
                new HashMap<>(
                        Map.of(
                                "version",
                                1,
                                "status",
                                "exporting",
                                "startedAt",
                                Instant.now().toString(),
                                "cursor",
                                0,
                                "chunk",
                                0,
                                "entities",
                                0,
                                "highWater",
                                highWater()));
        StateFiles.saveText(checkpointFile, Json.write(fresh));
        return fresh;
    }

    private Map<String, Object> exportPage(final Map<String, Object> checkpoint) throws Exception {
        final Map<String, String> parameters =
                new HashMap<>(
                        Map.of(
                                "action",
                                "qleverexport",
                                "format",
                                "json",
                                "after",
                                String.valueOf(checkpoint.get("cursor")),
                                "limit",
                                Integer.toString(config.chunkSize())));
        return Json.object(
                Json.parseObject(
                        Http.get(
                                config.api(parameters),
                                Map.of(
                                        "X-Wikibase-QLever-Export-Token",
                                        config.exportToken(),
                                        "Accept",
                                        "application/json"))),
                "qleverexport");
    }

    private Map<String, Object> writeChunk(
            final Path chunks, final Map<String, Object> checkpoint, final List<Object> entities)
            throws Exception {
        final int chunk = Json.integer(checkpoint.get("chunk")) + 1;
        writeChunk(chunks.resolve(String.format("%08d.nq", chunk)), entities);
        final Map<String, Object> updated = new HashMap<>(checkpoint);
        updated.put("chunk", chunk);
        updated.put("entities", Json.integer(checkpoint.get("entities")) + entities.size());
        return updated;
    }

    private Map<String, Object> saveCheckpoint(
            final Path checkpointFile,
            final Map<String, Object> checkpoint,
            final Map<String, Object> response)
            throws Exception {
        final Object next = response.get("next");
        if (next != null && !(next instanceof Number) && !String.valueOf(next).matches("\\d+")) {
            throw new IllegalStateException("Invalid QLever export cursor");
        }
        final Map<String, Object> updated = new HashMap<>(checkpoint);
        if (next != null) {
            updated.put("cursor", next);
        }
        updated.put("updatedAt", Instant.now().toString());
        StateFiles.saveText(checkpointFile, Json.write(updated));
        if (!"1".equals(String.valueOf(response.get("complete"))) && next == null) {
            throw new IllegalStateException("QLever export did not provide a continuation cursor");
        }
        return updated;
    }

    private void assembleExport(final Path chunks, final Map<String, Object> checkpoint)
            throws Exception {
        final Path output = StateFiles.DATA.resolve("wikibase.nq");
        final Path temporary = StateFiles.DATA.resolve("wikibase.nq.tmp");
        try (var stream = Files.newOutputStream(temporary)) {
            for (int chunk = 1; chunk <= Json.integer(checkpoint.get("chunk")); chunk++) {
                Files.copy(chunks.resolve(String.format("%08d.nq", chunk)), stream);
            }
        }
        Files.move(
                temporary, output, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    }

    private void writeChunk(final Path path, final List<Object> entities) throws Exception {
        final StringBuilder source = new StringBuilder();
        for (Object rawEntity : entities) {
            final Map<String, Object> entity = Json.object(rawEntity);
            final String id = String.valueOf(entity.get("id"));
            final String rdf =
                    MungerTransformer.transform(
                            id,
                            String.valueOf(entity.get("rdf")).getBytes(StandardCharsets.UTF_8),
                            config.rdfBase());
            for (String triple : rdf.split("\\R")) {
                if (triple.endsWith(" .")) {
                    source
                            .append(triple, 0, triple.length() - 2)
                            .append(" <")
                            .append(config.graph(id))
                            .append("> .\n");
                }
            }
        }
        StateFiles.saveText(path, source.toString());
    }

    private Map<String, Object> highWater() throws Exception {
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
                                "rcdir",
                                "older",
                                "rclimit",
                                "1"));
        final List<Object> changes = Json.list(Json.object(response, "query"), "recentchanges");
        if (changes.isEmpty()) {
            return Map.of("timestamp", Instant.now().toString(), "rcid", 0);
        }
        final Map<String, Object> latest = Json.object(changes.get(0));
        return Map.of(
                "timestamp",
                String.valueOf(latest.get("timestamp")),
                "rcid",
                Json.integer(latest.get("rcid")));
    }

    /** Excludes other exporters; the file also pauses updates until indexing succeeds. */
    private record BootstrapLock(FileChannel channel, FileLock lock) implements AutoCloseable {
        static BootstrapLock acquire() throws Exception {
            final FileChannel channel =
                    FileChannel.open(
                            StateFiles.BOOTSTRAP_LOCK,
                            java.nio.file.StandardOpenOption.CREATE,
                            java.nio.file.StandardOpenOption.WRITE);
            final FileLock lock;
            try {
                lock = channel.tryLock();
            } catch (OverlappingFileLockException error) {
                channel.close();
                throw new IllegalStateException("A QLever bootstrap is already in progress", error);
            }
            if (lock == null) {
                channel.close();
                throw new IllegalStateException("A QLever bootstrap is already in progress");
            }
            Files.deleteIfExists(StateFiles.PAUSED);
            return new BootstrapLock(channel, lock);
        }

        @Override
        public void close() throws Exception {
            lock.release();
            channel.close();
            // QLever's index command removes the pause marker only after a successful rebuild.
            // Keep it after both successful and failed exports so updates cannot cross the cutover.
        }
    }
}
