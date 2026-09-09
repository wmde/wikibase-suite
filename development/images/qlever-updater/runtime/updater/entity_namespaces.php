<?php
declare( strict_types = 1 );

function qleverEntityNamespaces( string $wikibase, callable $request ): array {
	$override = trim( getenv( 'WIKIBASE_ENTITY_NAMESPACES' ) ?: '' );
	if ( $override !== '' ) {
		$namespaces = array_map( 'trim', explode( ',', $override ) );
		if ( $namespaces === [] || array_filter( $namespaces, static fn( string $namespace ): bool => ! preg_match( '/^-?\\d+$/', $namespace ) ) ) {
			throw new RuntimeException( 'WIKIBASE_ENTITY_NAMESPACES must be a comma-separated list of namespace IDs' );
		}
		return array_map( 'intval', $namespaces );
	}
	$siteInfo = json_decode( $request( "$wikibase/w/api.php?" . http_build_query( [
		'action' => 'query', 'format' => 'json', 'meta' => 'siteinfo', 'siprop' => 'namespaces',
	] ) ), true, 512, JSON_THROW_ON_ERROR );
	$namespaces = [];
	foreach ( $siteInfo['query']['namespaces'] ?? [] as $namespace ) {
		$contentModel = $namespace['defaultcontentmodel'] ?? $namespace['content'] ?? '';
		if ( in_array( $contentModel, [ 'wikibase-item', 'wikibase-property', 'wikibase-lexeme', 'wikibase-mediainfo', 'EntitySchema' ], true ) ) {
			$namespaces[] = (int)$namespace['id'];
		}
	}
	if ( $namespaces === [] ) throw new RuntimeException( 'Could not discover Wikibase entity namespaces; set WIKIBASE_ENTITY_NAMESPACES explicitly' );
	return $namespaces;
}
