<?php
declare( strict_types = 1 );

// Compose starts completed one-shot services again on a later `up`. A static
// index is durable, so only create a new dump when no index exists or an
// operator deliberately requests a full bootstrap.
$indexMetadata = '/data/wikibase.meta-data.json';
$lockFile = '/data/qlever-bootstrap.lock';
if ( is_file( $lockFile ) ) {
	throw new RuntimeException( 'A previous QLever bootstrap did not complete; inspect the lock before forcing another bootstrap' );
}
if ( getenv( 'BOOTSTRAP_FORCE' ) !== 'true' && is_file( $indexMetadata ) ) {
	fwrite( STDERR, "QLever index already exists; skipping bootstrap dump\n" );
	exit( 0 );
}
require __DIR__ . '/entity_graph_dump.php';
