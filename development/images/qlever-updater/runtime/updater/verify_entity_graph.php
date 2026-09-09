<?php
declare( strict_types = 1 );

// Usage: php verify_entity_graph.php Q42 [P31 ...]
// Verifies the actual entity snapshot against the graph that QLever serves.
$wikibase = rtrim( getenv( 'WIKIBASE_URL' ) ?: 'http://wikibase', '/' );
$qlever = rtrim( getenv( 'QLEVER_URL' ) ?: 'http://query:7001', '/' );
$rdfBase = rtrim( getenv( 'WIKIBASE_RDF_BASE' ) ?: $wikibase, '/' );
$ids = array_slice( $_SERVER['argv'], 1 );
if ( $ids === [] ) throw new InvalidArgumentException( 'Provide at least one entity ID' );

function get( string $url, array $headers = [] ): string {
	$result = file_get_contents( $url, false, stream_context_create( [ 'http' => [
		'header' => implode( "\r\n", $headers ), 'ignore_errors' => true, 'timeout' => 30,
	] ] ) );
	if ( $result === false || ! isset( $http_response_header ) || ! str_contains( $http_response_header[0], ' 2' ) ) {
		throw new RuntimeException( "GET failed: " . ( $http_response_header[0] ?? $url ) );
	}
	return $result;
}
function lines( string $rdf ): array {
	$lines = array_values( array_filter( array_map( static function ( string $line ): string {
		// QLever canonicalizes xsd:integer to xsd:int and assigns local blank
		// node labels on graph retrieval. Neither changes RDF graph meaning.
		$line = str_replace(
			'<http://www.w3.org/2001/XMLSchema#integer>',
			'<http://www.w3.org/2001/XMLSchema#int>',
			trim( $line )
		);
		return preg_replace( '/_:[A-Za-z0-9]+/', '_:blank', $line );
	}, explode( "\n", $rdf ) ) ) );
	sort( $lines, SORT_STRING );
	return array_values( array_unique( $lines ) );
}

foreach ( $ids as $id ) {
	if ( ! preg_match( '/^[QPLEM]\d+$/', $id ) ) throw new InvalidArgumentException( "Invalid entity ID: $id" );
	$expected = lines( get( "$wikibase/wiki/Special:EntityData/$id.nt" ) );
	$graph = rawurlencode( "$rdfBase/entity/$id" );
	$actual = lines( get( "$qlever/?graph=$graph", [ 'Accept: application/n-triples' ] ) );
	$missing = array_values( array_diff( $expected, $actual ) );
	$unexpected = array_values( array_diff( $actual, $expected ) );
	if ( $missing !== [] || $unexpected !== [] ) {
		fwrite( STDERR, "$id differs: missing=" . count( $missing ) . ', unexpected=' . count( $unexpected ) . "\n" );
		foreach ( array_slice( $missing, 0, 5 ) as $line ) fwrite( STDERR, "- $line\n" );
		foreach ( array_slice( $unexpected, 0, 5 ) as $line ) fwrite( STDERR, "+ $line\n" );
		exit( 1 );
	}
	echo "$id OK (" . count( $actual ) . " triples)\n";
}
