<?php

declare( strict_types = 1 );

// Build an N-Quads source file from bounded Wikibase export chunks. The
// extension serializes entities with Wikibase's RDF service; this client owns
// durable chunk files and checkpoints, so an interrupted export resumes at a
// completed chunk instead of starting the wiki again.
$wikibase = rtrim( getenv( 'WIKIBASE_URL' ) ?: 'http://wikibase', '/' );
$rdfBase = rtrim( getenv( 'WIKIBASE_RDF_BASE' ) ?: $wikibase, '/' );
$token = getenv( 'QLEVER_EXPORT_TOKEN' );
$chunkSize = (int)( getenv( 'QLEVER_EXPORT_CHUNK_SIZE' ) ?: 100 );
$output = '/data/wikibase.nq';
$chunkDirectory = '/data/qlever-export-chunks';
$checkpointFile = '/data/qlever-export-checkpoint.json';
$stateFile = '/data/qlever-updater-state.json';
$bootstrapLockFile = '/data/qlever-bootstrap.lock';
$bootstrapRequiredFile = '/data/qlever-bootstrap-required';
$pausedFile = '/data/qlever-updater-paused.json';
$healthFile = '/data/qlever-updater-health.json';

if ( $token === false || $token === '' ) throw new RuntimeException( 'Missing QLever export token' );
if ( $chunkSize < 1 || $chunkSize > 500 ) throw new RuntimeException( 'QLEVER_EXPORT_CHUNK_SIZE must be between 1 and 500' );

function qleverExportRequest( string $url ): array {
	global $token;
	$context = stream_context_create( [ 'http' => [
		'header' => "X-Wikibase-QLever-Export-Token: $token\r\nAccept: application/json",
		'ignore_errors' => true,
		'timeout' => 60,
	] ] );
	$result = file_get_contents( $url, false, $context );
	if ( $result === false || !isset( $http_response_header ) || !str_contains( $http_response_header[0], ' 2' ) ) {
		throw new RuntimeException( 'QLever export request failed: ' . ( $http_response_header[0] ?? $url ) );
	}
	$decoded = json_decode( $result, true, 512, JSON_THROW_ON_ERROR );
	if ( !isset( $decoded['qleverexport'] ) || !is_array( $decoded['qleverexport'] ) ) {
		throw new RuntimeException( 'QLever export response did not contain a chunk' );
	}
	return $decoded['qleverexport'];
}

function saveQleverExportJson( string $path, array $value ): void {
	$temporary = "$path.tmp";
	if ( file_put_contents( $temporary, json_encode( $value, JSON_THROW_ON_ERROR ) ) === false || !rename( $temporary, $path ) ) {
		throw new RuntimeException( "Cannot persist $path" );
	}
}

function writeQleverExportChunk( string $path, array $entities ): int {
	global $rdfBase;
	$temporary = "$path.tmp";
	$handle = fopen( $temporary, 'w' );
	if ( $handle === false ) throw new RuntimeException( "Cannot open $temporary" );
	$count = 0;
	foreach ( $entities as $entity ) {
		$id = $entity['id'] ?? null;
		$rdf = $entity['rdf'] ?? null;
		if ( !is_string( $id ) || !is_string( $rdf ) ) throw new RuntimeException( 'Malformed entity export record' );
		$graph = " <$rdfBase/entity/$id> .\n";
		foreach ( explode( "\n", $rdf ) as $triple ) {
			$triple = trim( $triple );
			if ( $triple !== '' && str_ends_with( $triple, ' .' ) ) fwrite( $handle, substr( $triple, 0, -2 ) . $graph );
		}
		$count++;
	}
	fclose( $handle );
	if ( !rename( $temporary, $path ) ) throw new RuntimeException( "Cannot finalize $path" );
	return $count;
}

function highWaterCursor(): array {
	global $wikibase;
	$url = "$wikibase/w/api.php?" . http_build_query( [
		'action' => 'query', 'format' => 'json', 'list' => 'recentchanges',
		'rcprop' => 'ids|timestamp', 'rcdir' => 'older', 'rclimit' => 1,
	] );
	$result = file_get_contents( $url );
	$latest = $result === false ? null : ( json_decode( $result, true )['query']['recentchanges'][0] ?? null );
	return is_array( $latest ) ?
		[ 'timestamp' => $latest['timestamp'], 'rcid' => $latest['rcid'] ] :
		[ 'timestamp' => gmdate( 'Y-m-d\\TH:i:s\\Z' ), 'rcid' => 0 ];
}

// The lock deliberately remains until the QLever image finishes rebuilding
// the static index. A running updater acknowledges it before this export can
// replace the durable source file.
$lockHandle = @fopen( $bootstrapLockFile, 'x' );
if ( $lockHandle === false ) throw new RuntimeException( 'A QLever bootstrap is already in progress' );
fwrite( $lockHandle, json_encode( [ 'startedAt' => gmdate( 'c' ), 'pid' => getmypid() ], JSON_THROW_ON_ERROR ) );
fflush( $lockHandle );
@unlink( $pausedFile );
if ( is_file( $healthFile ) ) {
	$deadline = time() + 35;
	while ( !is_file( $pausedFile ) && time() < $deadline ) sleep( 1 );
}

if ( !is_dir( $chunkDirectory ) && !mkdir( $chunkDirectory, 0700, true ) && !is_dir( $chunkDirectory ) ) {
	throw new RuntimeException( "Cannot create $chunkDirectory" );
}
$checkpoint = is_file( $checkpointFile ) ? json_decode( (string)file_get_contents( $checkpointFile ), true ) : null;
if ( !is_array( $checkpoint ) || ( $checkpoint['status'] ?? null ) !== 'exporting' ) {
	$checkpoint = [
		'version' => 1,
		'status' => 'exporting',
		'startedAt' => gmdate( 'c' ),
		'cursor' => 0,
		'chunk' => 0,
		'entities' => 0,
		'highWater' => highWaterCursor(),
	];
	saveQleverExportJson( $checkpointFile, $checkpoint );
}

while ( true ) {
	// The checkpoint advances only after its complete chunk has been atomically
	// renamed. A crash therefore repeats at most the current API page.
	$response = qleverExportRequest( "$wikibase/w/api.php?" . http_build_query( [
		'action' => 'qleverexport', 'format' => 'json', 'after' => $checkpoint['cursor'], 'limit' => $chunkSize,
	] ) );
	$entities = $response['entities'] ?? null;
	if ( !is_array( $entities ) ) throw new RuntimeException( 'QLever export response has no entities' );
	if ( $entities !== [] ) {
		$chunk = (int)$checkpoint['chunk'] + 1;
		$path = sprintf( '%s/%08d.nq', $chunkDirectory, $chunk );
		$count = writeQleverExportChunk( $path, $entities );
		$checkpoint['chunk'] = $chunk;
		$checkpoint['entities'] += $count;
	}
	$next = $response['next'] ?? null;
	if ( $next !== null && !is_int( $next ) && !ctype_digit( (string)$next ) ) throw new RuntimeException( 'Invalid QLever export cursor' );
	$checkpoint['cursor'] = $next ?? $checkpoint['cursor'];
	$checkpoint['updatedAt'] = gmdate( 'c' );
	saveQleverExportJson( $checkpointFile, $checkpoint );
	if ( (string)( $response['complete'] ?? '' ) === '1' ) break;
	if ( $next === null ) throw new RuntimeException( 'QLever export did not provide a continuation cursor' );
}

// QLever indexes a single N-Quads source. Assemble it only after every export
// chunk is durable, so the existing index remains usable until this rename.
$temporary = "$output.tmp";
$outputHandle = fopen( $temporary, 'w' );
if ( $outputHandle === false ) throw new RuntimeException( "Cannot open $temporary" );
for ( $chunk = 1; $chunk <= (int)$checkpoint['chunk']; $chunk++ ) {
	$path = sprintf( '%s/%08d.nq', $chunkDirectory, $chunk );
	$input = fopen( $path, 'r' );
	if ( $input === false ) throw new RuntimeException( "Missing completed export chunk $path" );
	stream_copy_to_stream( $input, $outputHandle );
	fclose( $input );
}
fclose( $outputHandle );
if ( !rename( $temporary, $output ) ) throw new RuntimeException( "Cannot finalize $output" );
saveQleverExportJson( $stateFile, $checkpoint['highWater'] );
$checkpoint['status'] = 'complete';
$checkpoint['completedAt'] = gmdate( 'c' );
saveQleverExportJson( $checkpointFile, $checkpoint );
if ( file_put_contents( $bootstrapRequiredFile, "required\n" ) === false ) {
	throw new RuntimeException( 'Cannot mark QLever index bootstrap as required' );
}
fwrite( STDERR, "Wrote {$checkpoint['entities']} entity graphs in {$checkpoint['chunk']} resumable chunks to $output\n" );
