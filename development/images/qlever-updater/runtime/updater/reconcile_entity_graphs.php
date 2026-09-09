<?php
declare( strict_types = 1 );

// Usage: php reconcile_entity_graphs.php [--repair] [--all] Q42 P31 ...
// A repair is idempotent: it PUTs Wikibase's current entity snapshot into the
// corresponding QLever graph. Schedule it for sampled entities or a full sweep.
$wikibase = rtrim( getenv( 'WIKIBASE_URL' ) ?: 'http://wikibase', '/' );
$qlever = rtrim( getenv( 'QLEVER_URL' ) ?: 'http://query:7001', '/' );
$rdfBase = rtrim( getenv( 'WIKIBASE_RDF_BASE' ) ?: $wikibase, '/' );
$token = getenv( 'QLEVER_ACCESS_TOKEN' );
$arguments = array_slice( $_SERVER['argv'], 1 );
$repair = in_array( '--repair', $arguments, true );
$all = in_array( '--all', $arguments, true );
$ids = array_values( array_filter( $arguments, static fn ( string $argument ): bool => $argument !== '--repair' && $argument !== '--all' ) );
if ( ! $all && $ids === [] ) throw new InvalidArgumentException( 'Provide entity IDs or --all' );

function request( string $url, string $method = 'GET', ?string $body = null, array $headers = [] ): string {
	$result = file_get_contents( $url, false, stream_context_create( [ 'http' => [
		'method' => $method, 'content' => $body ?? '', 'header' => implode( "\r\n", $headers ),
		'ignore_errors' => true, 'timeout' => 30,
	] ] ) );
	if ( $result === false || ! isset( $http_response_header ) || ! str_contains( $http_response_header[0], ' 2' ) ) {
		throw new RuntimeException( "Request failed: " . ( $http_response_header[0] ?? $url ) );
	}
	return $result;
}
require_once __DIR__ . '/entity_namespaces.php';
$entityNamespaces = qleverEntityNamespaces( $wikibase, 'request' );
function normalized( string $rdf ): array {
	$lines = array_filter( array_map( static function ( string $line ): string {
		$line = str_replace( '<http://www.w3.org/2001/XMLSchema#integer>', '<http://www.w3.org/2001/XMLSchema#int>', trim( $line ) );
		return preg_replace( '/_:[A-Za-z0-9]+/', '_:blank', $line );
	}, explode( "\n", $rdf ) ) );
	sort( $lines, SORT_STRING );
	return array_values( array_unique( $lines ) );
}
function allEntityIds(): array {
	global $wikibase, $entityNamespaces;
	$ids = [];
	foreach ( $entityNamespaces as $namespace ) {
		$continue = null;
		do {
			$params = [ 'action' => 'query', 'format' => 'json', 'list' => 'allpages', 'apnamespace' => $namespace, 'aplimit' => 500 ];
			if ( $continue !== null ) $params['apcontinue'] = $continue;
			$data = json_decode( request( "$wikibase/w/api.php?" . http_build_query( $params ) ), true, 512, JSON_THROW_ON_ERROR );
			foreach ( $data['query']['allpages'] ?? [] as $page ) if ( preg_match( '/:([^:]+)$/', $page['title'], $matches ) ) $ids[] = $matches[1];
			$continue = $data['continue']['apcontinue'] ?? null;
		} while ( $continue !== null );
	}
	return $ids;
}
function qleverEntityGraphs(): array {
	global $qlever, $rdfBase;
	$query = rawurlencode( 'SELECT DISTINCT ?graph WHERE { GRAPH ?graph { ?s ?p ?o } }' );
	$data = json_decode( request( "$qlever/?query=$query" ), true, 512, JSON_THROW_ON_ERROR );
	$prefix = "$rdfBase/entity/";
	$graphs = [];
	foreach ( $data['results']['bindings'] ?? [] as $row ) if ( str_starts_with( $row['graph']['value'] ?? '', $prefix ) ) $graphs[] = substr( $row['graph']['value'], strlen( $prefix ) );
	return $graphs;
}

if ( $all ) $ids = allEntityIds();

$drifted = 0;
foreach ( $ids as $id ) {
	if ( ! preg_match( '/^[A-Za-z][A-Za-z0-9-]*\d+$/', $id ) ) throw new InvalidArgumentException( "Invalid entity ID: $id" );
	$expectedRdf = request( "$wikibase/wiki/Special:EntityData/$id.nt" );
	$graph = rawurlencode( "$rdfBase/entity/$id" );
	$actual = normalized( request( "$qlever/?graph=$graph", 'GET', null, [ 'Accept: application/n-triples' ] ) );
	$expected = normalized( $expectedRdf );
	if ( $actual === $expected ) { echo "$id OK\n"; continue; }
	$drifted++;
	echo "$id DRIFT (expected " . count( $expected ) . ', got ' . count( $actual ) . ")\n";
	if ( $repair ) {
		request( "$qlever/?graph=$graph", 'PUT', $expectedRdf, [ 'Content-Type: application/n-triples', "Authorization: Bearer $token" ] );
		$repaired = normalized( request( "$qlever/?graph=$graph", 'GET', null, [ 'Accept: application/n-triples' ] ) );
		if ( $repaired !== $expected ) throw new RuntimeException( "$id repair did not converge" );
		echo "$id REPAIRED\n";
	}
}
if ( $all ) {
	$orphans = array_values( array_diff( qleverEntityGraphs(), $ids ) );
	foreach ( $orphans as $id ) {
		$drifted++;
		echo "$id ORPHAN\n";
		if ( $repair ) request( "$qlever/?graph=" . rawurlencode( "$rdfBase/entity/$id" ), 'DELETE', null, [ "Authorization: Bearer $token" ] );
	}
}
exit( $drifted > 0 && ! $repair ? 1 : 0 );
