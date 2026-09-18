package org.wikimedia.wikibase.qlever.updater.support;

import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;

/** Paths and atomic replacement operations for persistent updater state. */
public final class StateFiles {
    public static final Path DATA = Path.of("/data");
    public static final Path STATE = DATA.resolve("wdqs-qlever-updater-state.json");
    public static final Path HEALTH = DATA.resolve("wdqs-qlever-updater-health.json");
    public static final Path BOOTSTRAP_LOCK = DATA.resolve("qlever-bootstrap.lock");
    public static final Path PAUSED = DATA.resolve("wdqs-qlever-updater-paused.json");

    private StateFiles() {}

    /** Serializes incremental writes with export/cursor publication, even if the updater stops. */
    public static FileChannel openUpdateLock() throws Exception {
        return FileChannel.open(
                DATA.resolve("qlever-update.lock"), StandardOpenOption.CREATE, StandardOpenOption.WRITE);
    }

    /** Atomically replaces a small text state file. */
    public static void saveText(final Path path, final String value) throws Exception {
        Files.createDirectories(path.getParent());
        final Path temporary = path.resolveSibling(path.getFileName() + ".tmp");
        Files.writeString(temporary, value);
        Files.move(
                temporary, path, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    }
}
