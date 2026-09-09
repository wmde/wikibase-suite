<?php
declare( strict_types = 1 );

// Compose starts completed one-shot services again on a later `up`. A static
// index is durable, so only create a new dump when no index exists or an
// operator deliberately requests a full bootstrap.
$indexMetadata = '/data/wikibase.meta-data.json';
$lockFile = '/data/qlever-bootstrap.lock';
if ( is_file( $lockFile ) ) {
	$checkpointFile = '/data/qlever-export-checkpoint.json';
	$checkpoint = is_file( $checkpointFile ) ? json_decode( (string)file_get_contents( $checkpointFile ), true ) : null;
	if ( getenv( 'BOOTSTRAP_FORCE' ) !== 'true' || !is_array( $checkpoint ) ) {
		throw new RuntimeException( 'A previous QLever bootstrap did not complete; rerun with BOOTSTRAP_FORCE=true to recover it' );
	}
	// A durable checkpoint proves that the earlier one-shot exporter exited
	// before indexing. An exporting checkpoint resumes from its last chunk; a
	// completed one starts a deliberate replacement export.
	if ( !unlink( $lockFile ) ) throw new RuntimeException( 'Cannot release the previous QLever bootstrap lock' );
}
if ( getenv( 'BOOTSTRAP_FORCE' ) !== 'true' && is_file( $indexMetadata ) ) {
	fwrite( STDERR, "QLever index already exists; skipping bootstrap dump\n" );
	exit( 0 );
}
require __DIR__ . '/entity_graph_dump.php';
