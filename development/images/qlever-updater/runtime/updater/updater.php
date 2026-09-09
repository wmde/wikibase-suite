<?php
declare( strict_types = 1 );

// Poll Wikibase Recent Changes and replace each complete entity RDF snapshot in
// its entity-owned named graph. The cursor lives on query-data.
$wikibase = rtrim( getenv( 'WIKIBASE_URL' ) ?: 'http://wikibase', '/' );
$rdfBase = rtrim( getenv( 'WIKIBASE_RDF_BASE' ) ?: $wikibase, '/' );
$qlever = rtrim( getenv( 'QLEVER_URL' ) ?: 'http://query:7001', '/' );
$token = getenv( 'QLEVER_ACCESS_TOKEN' );
$stateFile = '/data/qlever-updater-state.json';
$healthFile = '/data/qlever-updater-health.json';
$bootstrapLockFile = '/data/qlever-bootstrap.lock';
$pausedFile = '/data/qlever-updater-paused.json';
$stateGraph = 'urn:wikibase-suite:qlever-updater-state';

function request( string $url, ?string $body = null, array $headers = [], ?string $method = null ): string {
	$context = stream_context_create( [ 'http' => [
		'method' => $method ?? ( $body === null ? 'GET' : 'POST' ),
		'header' => implode( "\r\n", $headers ),
		'content' => $body ?? '',
		'ignore_errors' => true,
		'timeout' => 30,
	] ] );
	$result = file_get_contents( $url, false, $context );
	if ( $result === false || ! isset( $http_response_header ) || ! str_contains( $http_response_header[ 0 ], ' 2' ) ) {
		$status = $http_response_header[ 0 ] ?? 'no HTTP response';
		throw new RuntimeException( "Request failed ($status): " . substr( (string)$result, 0, 500 ) );
	}
	return $result;
}
require_once __DIR__ . '/entity_namespaces.php';
$entityNamespaces = qleverEntityNamespaces( $wikibase, 'request' );

function replaceEntity( string $id ): void {
	global $wikibase, $rdfBase, $qlever, $token;
	$graph = rawurlencode( "$rdfBase/entity/$id" );
	try {
		$rdf = request( "$wikibase/wiki/Special:EntityData/$id.nt" );
	} catch ( RuntimeException $error ) {
		// A deleted entity no longer has EntityData. Deleting only its named
		// graph is safe and makes deletion replay idempotent.
		if ( str_contains( $error->getMessage(), ' 404 ' ) ) {
			request( "$qlever/?graph=$graph", null, [ "Authorization: Bearer $token" ], 'DELETE' );
			return;
		}
		throw $error;
	}
	// Graph Store PUT atomically replaces just this entity graph. Unlike a
	// filtered DELETE, it never scans or deletes RDF owned by another entity.
	request( "$qlever/?graph=$graph", $rdf, [
		'Content-Type: application/n-triples', "Authorization: Bearer $token",
	], 'PUT' );
}

function saveState( array $state ): void {
	global $stateFile;
	$temporary = "$stateFile.tmp";
	if ( file_put_contents( $temporary, json_encode( $state, JSON_THROW_ON_ERROR ) ) === false || ! rename( $temporary, $stateFile ) ) {
		throw new RuntimeException( "Cannot persist updater state" );
	}
}

function writeProgress( array $state ): void {
	global $qlever, $token, $stateGraph, $rdfBase;
	$subject = "<$rdfBase/entity/QleverUpdater>";
	$timestamp = $state['timestamp'];
	$rcid = (int)$state['rcid'];
	$rdf = "$subject <http://wikiba.se/ontology#updatesCompleteUntil> \"$timestamp\"^^<http://www.w3.org/2001/XMLSchema#dateTime> .\n"
		. "$subject <http://wikiba.se/ontology#updateStreamNextOffset> \"$rcid\"^^<http://www.w3.org/2001/XMLSchema#integer> .\n";
	request( "$qlever/?graph=" . rawurlencode( $stateGraph ), $rdf, [
		'Content-Type: application/n-triples', "Authorization: Bearer $token",
	], 'PUT' );
}
function writeHealth( array $state, ?string $error = null ): void {
	global $healthFile;
	$health = [ 'checkedAt' => gmdate( 'c' ), 'state' => $state ];
	if ( $error !== null ) $health['error'] = $error;
	file_put_contents( $healthFile, json_encode( $health, JSON_THROW_ON_ERROR ) );
}
function pauseForBootstrap( array $state ): bool {
	global $bootstrapLockFile, $pausedFile;
	if ( ! is_file( $bootstrapLockFile ) ) return false;
	$pause = [ 'pausedAt' => gmdate( 'c' ), 'pid' => getmypid() ];
	if ( file_put_contents( $pausedFile, json_encode( $pause, JSON_THROW_ON_ERROR ) ) === false ) {
		throw new RuntimeException( 'Cannot acknowledge bootstrap pause' );
	}
	writeHealth( $state );
	return true;
}
function assertCursorIsRetained( array $state ): void {
	global $wikibase, $entityNamespaces;
	$parameters = http_build_query( [
		'action' => 'query', 'format' => 'json', 'list' => 'recentchanges',
		'rcprop' => 'ids|timestamp', 'rcnamespace' => implode( '|', $entityNamespaces ),
		'rcdir' => 'newer', 'rclimit' => 1,
	] );
	$oldest = json_decode( request( "$wikibase/w/api.php?$parameters" ), true )[ 'query' ][ 'recentchanges' ][0] ?? null;
	if ( $oldest !== null && $state['rcid'] < $oldest['rcid'] && $state['timestamp'] < $oldest['timestamp'] ) {
		throw new RuntimeException(
			'Recent Changes retention no longer covers the updater cursor; run a full reconciliation or bootstrap before resuming'
		);
	}
}

$state = is_file( $stateFile ) ? json_decode( file_get_contents( $stateFile ), true ) : null;
if ( ! is_array( $state ) ) {
	$state = [ 'timestamp' => gmdate( 'Y-m-d\\TH:i:s\\Z' ), 'rcid' => 0 ];
	saveState( $state );
}

$retryDelay = 5;
$cursorWasChecked = false;
while ( true ) {
	try {
		// A bootstrap writes a new high-water cursor and must rebuild the static
		// index before updates resume. Cooperate through the shared data volume so
		// a live updater cannot race that cutover.
		if ( pauseForBootstrap( $state ) ) {
			sleep( 5 );
			continue;
		}
		if ( ! $cursorWasChecked ) {
			assertCursorIsRetained( $state );
			$cursorWasChecked = true;
		}
		$params = [
			'action' => 'query', 'format' => 'json', 'list' => 'recentchanges',
			'rcprop' => 'title|ids|timestamp|loginfo', 'rctype' => 'edit|new|log',
			'rclogtype' => 'delete|move|merge',
			'rcnamespace' => implode( '|', $entityNamespaces ), 'rcdir' => 'newer', 'rclimit' => 50,
		];
		if ( isset( $state['continue'] ) ) $params['rccontinue'] = $state['continue'];
		else $params['rcstart'] = $state['timestamp'];
		$response = json_decode( request( "$wikibase/w/api.php?" . http_build_query( $params ) ), true );
		$changes = $response[ 'query' ][ 'recentchanges' ] ?? [];
		foreach ( $changes as $change ) {
			if ( $change[ 'rcid' ] <= $state[ 'rcid' ] ) continue;
			if ( preg_match( '/:([^:]+)$/', $change[ 'title' ], $matches ) ) {
				replaceEntity( $matches[ 1 ] );
			}
			$state = [ 'timestamp' => $change[ 'timestamp' ], 'rcid' => $change[ 'rcid' ] ];
			writeProgress( $state );
			saveState( $state );
		}
		if ( isset( $response['continue']['rccontinue'] ) ) {
			$state['continue'] = $response['continue']['rccontinue'];
			saveState( $state );
		} elseif ( isset( $state['continue'] ) ) {
			unset( $state['continue'] );
			saveState( $state );
		}
		writeHealth( $state );
		$retryDelay = 5;
	} catch ( Throwable $error ) {
		fwrite( STDERR, "qlever updater: {$error->getMessage()}\n" );
		writeHealth( $state, $error->getMessage() );
		$retryDelay = min( $retryDelay * 2, 60 );
	}
	sleep( $retryDelay );
}
