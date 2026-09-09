<?php
declare( strict_types = 1 );

// Create an N-Quads bootstrap where every Wikibase entity snapshot is its own
// graph. QLever's default graph view is the union of these named graphs.
$wikibase = rtrim( getenv( 'WIKIBASE_URL' ) ?: 'http://wikibase', '/' );
$rdfBase = rtrim( getenv( 'WIKIBASE_RDF_BASE' ) ?: $wikibase, '/' );
$output = '/data/wikibase.nq';
$temporary = "$output.tmp";
$stateFile = '/data/qlever-updater-state.json';
$bootstrapLockFile = '/data/qlever-bootstrap.lock';
$bootstrapRequiredFile = '/data/qlever-bootstrap-required';
$pausedFile = '/data/qlever-updater-paused.json';
$healthFile = '/data/qlever-updater-health.json';

// The lock deliberately remains after a successful dump. qlever-indexer
// removes it only after the replacement static index succeeds; until then a
// running updater acknowledges the lock and stays paused.
$lockHandle = @fopen( $bootstrapLockFile, 'x' );
if ( $lockHandle === false ) throw new RuntimeException( 'A QLever bootstrap is already in progress' );
fwrite( $lockHandle, json_encode( [ 'startedAt' => gmdate( 'c' ), 'pid' => getmypid() ], JSON_THROW_ON_ERROR ) );
fflush( $lockHandle );
@unlink( $pausedFile );

// A stopped updater leaves a recent health file on the shared volume, so it
// cannot prove that a process is still alive. Wait for an acknowledgement or
// for the updater's 30-second maximum HTTP request to finish. If no process is
// alive, waiting out that bound is safe; if one is alive, it observes the lock
// and writes the acknowledgement before its next poll.
if ( is_file( $healthFile ) ) {
	$deadline = time() + 35;
	while ( ! is_file( $pausedFile ) && time() < $deadline ) sleep( 1 );
}
$handle = fopen( $temporary, 'w' );
if ( $handle === false ) throw new RuntimeException( "Cannot open $temporary" );

function get( string $url ): string {
	$result = file_get_contents( $url, false, stream_context_create( [ 'http' => [ 'ignore_errors' => true ] ] ) );
	if ( $result === false || ! isset( $http_response_header ) || ! str_contains( $http_response_header[0], ' 2' ) ) {
		throw new RuntimeException( "GET failed: " . ( $http_response_header[0] ?? $url ) );
	}
	return $result;
}
function saveState( array $state ): void {
	global $stateFile;
	$temporary = "$stateFile.tmp";
	if ( file_put_contents( $temporary, json_encode( $state, JSON_THROW_ON_ERROR ) ) === false || ! rename( $temporary, $stateFile ) ) {
		throw new RuntimeException( "Cannot persist bootstrap cursor" );
	}
}
function writeEntity( string $id ): void {
	global $wikibase, $rdfBase, $handle;
	$graph = " <$rdfBase/entity/$id> .\n";
	foreach ( explode( "\n", get( "$wikibase/wiki/Special:EntityData/$id.nt" ) ) as $triple ) {
		$triple = trim( $triple );
		if ( $triple !== '' && str_ends_with( $triple, ' .' ) ) fwrite( $handle, substr( $triple, 0, -2 ) . $graph );
	}
}
require_once __DIR__ . '/entity_namespaces.php';
$entityNamespaces = qleverEntityNamespaces( $wikibase, 'get' );

// Capture the high-water mark before exporting. The updater starts from this
// cursor after the index is ready, so every change during export/indexing is
// replayed. Reapplying a snapshot already present in the export is harmless.
$latest = json_decode( get( "$wikibase/w/api.php?" . http_build_query( [
	'action' => 'query', 'format' => 'json', 'list' => 'recentchanges',
	'rcprop' => 'ids|timestamp', 'rcnamespace' => implode( '|', $entityNamespaces ),
	'rcdir' => 'older', 'rclimit' => 1,
] ) ), true, 512, JSON_THROW_ON_ERROR )['query']['recentchanges'][0] ?? null;
// A fresh Wikibase can legitimately have no entity Recent Changes. Establish a
// cursor just before export; every subsequently-created entity then has an
// rcid greater than zero and will be replayed by the updater.
$state = is_array( $latest ) ?
	[ 'timestamp' => $latest['timestamp'], 'rcid' => $latest['rcid'] ] :
	[ 'timestamp' => gmdate( 'Y-m-d\\TH:i:s\\Z' ), 'rcid' => 0 ];
saveState( $state );

$count = 0;
foreach ( $entityNamespaces as $namespace ) {
	$continue = null;
	do {
		$params = [ 'action' => 'query', 'format' => 'json', 'list' => 'allpages', 'apnamespace' => $namespace, 'aplimit' => 500 ];
		if ( $continue !== null ) $params['apcontinue'] = $continue;
		$response = json_decode( get( "$wikibase/w/api.php?" . http_build_query( $params ) ), true, 512, JSON_THROW_ON_ERROR );
		foreach ( $response['query']['allpages'] ?? [] as $page ) {
			if ( preg_match( '/:([^:]+)$/', $page['title'], $matches ) ) {
				try { writeEntity( $matches[1] ); $count++; }
				catch ( RuntimeException $error ) {
					// An entity deleted after the high-water mark will be removed by
					// replay. Do not fail an otherwise valid bootstrap dump for it.
					if ( ! str_contains( $error->getMessage(), '404') ) throw $error;
				}
			}
		}
		$continue = $response['continue']['apcontinue'] ?? null;
	} while ( $continue !== null );
}
fclose( $handle );
rename( $temporary, $output );
if ( file_put_contents( $bootstrapRequiredFile, "required\n" ) === false ) {
	throw new RuntimeException( 'Cannot mark QLever index bootstrap as required' );
}
fwrite( STDERR, "Wrote $count entity graphs to $output\n" );
