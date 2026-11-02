<?php

declare( strict_types = 1 );

namespace MediaWiki\Extension\WikibaseBootstrap;

/** Reads the narrow Turtle convention used by the pinned upstream property set. */
class BundlePlanner {
	/** @return array{properties: list<array<string, mixed>>, errors: string[]} */
	public function plan( string $contents ): array {
		$prefixes = $this->prefixes( $contents );
		$propertiesById = [];
		$errors = [];
		preg_match_all(
			'/^([A-Za-z][A-Za-z0-9_-]*):(P[1-9][0-9]*)\s+a\s+owl:(?:ObjectProperty|DatatypeProperty)\s*;(.*?)(?=^[A-Za-z][A-Za-z0-9_-]*:(?:P[1-9][0-9]*)?\s+a\s+owl:|\z)/ms',
			$contents,
			$matches,
			PREG_SET_ORDER
		);

		foreach ( $matches as $match ) {
			$sourceId = $match[2];
			$body = $match[3];
			$sourceIri = $this->prefixedTerm( "{$match[1]}:$sourceId", $prefixes );
			$label = $this->literal( $body, 'rdfs:label' );
			$description = $this->literal( $body, 'dcterms:description' );
			preg_match( '/"Wikibase ID: (P[1-9][0-9]*)"/', $body, $idNote );
			preg_match( '/"Wikibase datatype: ([a-z][a-z-]*)"/', $body, $datatypeNote );
			if ( $sourceIri === null || $label === null || $description === null ||
				( $idNote[1] ?? '' ) !== $sourceId || !isset( $datatypeNote[1] )
			) {
				$errors[] = "The bootstrap property $sourceId is missing a matching ID note, label, description, or datatype.";
				continue;
			}
			if ( !in_array( $datatypeNote[1], [
				'wikibase-item', 'wikibase-property', 'url', 'external-id', 'string'
			], true ) ) {
				$errors[] = "The bootstrap property $sourceId has an unsupported datatype.";
				continue;
			}

			$claims = $this->claims( $body, $prefixes );
			if ( $claims === null ) {
				$errors[] = "The bootstrap property $sourceId has an unsupported or invalid claim.";
				continue;
			}
			if ( isset( $propertiesById[$sourceId] ) ) {
				$errors[] = "The bootstrap property $sourceId is declared more than once.";
				continue;
			}
			$propertiesById[$sourceId] = [
				'sourceIri' => $sourceIri,
				'label' => $label,
				'description' => $description,
				'datatype' => $datatypeNote[1],
				'claims' => $claims,
			];
		}

		if ( $propertiesById === [] ) {
			$errors[] = 'No importable bootstrap properties were found.';
		}

		$datatypesByIri = [];
		foreach ( $propertiesById as $property ) {
			$datatypesByIri[$property['sourceIri']] = $property['datatype'];
		}
		foreach ( $propertiesById as $sourceId => $property ) {
			foreach ( $property['claims'] as $claim ) {
				if ( !in_array( $datatypesByIri[$claim['property']] ?? null, [
					'url', 'external-id', 'string'
				], true ) ) {
					$errors[] = "The bootstrap property $sourceId refers to a missing or unsupported claim property.";
				}
			}
		}

		uksort( $propertiesById, static fn ( string $a, string $b ): int =>
			(int)substr( $a, 1 ) <=> (int)substr( $b, 1 )
		);
		return [ 'properties' => array_values( $propertiesById ), 'errors' => $errors ];
	}

	/** @return array<string, string> */
	private function prefixes( string $contents ): array {
		preg_match_all(
			'/^@prefix\s+([A-Za-z][A-Za-z0-9_-]*):\s*<([^>]+)>\s*\./m',
			$contents,
			$matches,
			PREG_SET_ORDER
		);
		$prefixes = [];
		foreach ( $matches as $match ) {
			$prefixes[$match[1]] = $match[2];
		}
		return $prefixes;
	}

	/** @return array{value: string, language: string}|null */
	private function literal( string $body, string $predicate ): ?array {
		if ( !preg_match(
			'/' . preg_quote( $predicate, '/' ) . '\s+"((?:[^"\\\\]|\\\\.)*)"(?:@([A-Za-z-]+))?/',
			$body,
			$match
		) ) {
			return null;
		}
		return [
			'value' => stripcslashes( $match[1] ),
			'language' => ( $match[2] ?? '' ) ?: 'en',
		];
	}

	/**
	 * @param array<string, string> $prefixes
	 * @return list<array{property: string, value: string}>|null
	 */
	private function claims( string $body, array $prefixes ): ?array {
		$claims = [];
		preg_match_all( '/^\s*([A-Za-z][A-Za-z0-9_-]*:[A-Za-z][A-Za-z0-9_-]*)\s+/m', $body, $predicates );
		foreach ( $predicates[1] as $predicate ) {
			if ( !in_array( $predicate, [
				'rdfs:label', 'dcterms:description', 'skos:note', 'owl:equivalentProperty'
			], true ) && !preg_match( '/^wb:P[1-9][0-9]*$/', $predicate ) ) {
				return null;
			}
		}
		preg_match_all( '/^\s*owl:([A-Za-z][A-Za-z0-9_-]*)\s+/m', $body, $owlPredicates );
		foreach ( $owlPredicates[1] as $predicate ) {
			if ( $predicate !== 'equivalentProperty' ) {
				return null;
			}
		}
		preg_match_all( '/^\s*owl:equivalentProperty\s+([^\s;]+)\s*;/m', $body, $equivalents );
		if ( count( $equivalents[1] ) !== count( $owlPredicates[1] ) ) {
			return null;
		}
		$exactMatch = $this->prefixedTerm( 'wb:P5', $prefixes );
		if ( $exactMatch === null ) {
			return null;
		}
		foreach ( $equivalents[1] as $term ) {
			$value = $this->term( $term, $prefixes );
			if ( $value === null ) {
				return null;
			}
			$claims[] = [ 'property' => $exactMatch, 'value' => $value ];
		}

		preg_match_all( '/^\s*[A-Za-z][A-Za-z0-9_-]*:P[1-9][0-9]*\s+/m', $body, $claimLines );
		preg_match_all(
			'/^\s*([A-Za-z][A-Za-z0-9_-]*:P[1-9][0-9]*)\s+"((?:[^"\\\\]|\\\\.)*)"\s*[;.]\s*$/m',
			$body,
			$matches,
			PREG_SET_ORDER
		);
		if ( count( $claimLines[0] ) !== count( $matches ) ) {
			return null;
		}
		foreach ( $matches as $match ) {
			$property = $this->prefixedTerm( $match[1], $prefixes );
			if ( $property === null ) {
				return null;
			}
			$claims[] = [ 'property' => $property, 'value' => stripcslashes( $match[2] ) ];
		}
		return $claims;
	}

	/** @param array<string, string> $prefixes */
	private function term( string $term, array $prefixes ): ?string {
		if ( preg_match( '/^<([^>]+)>$/', $term, $match ) ) {
			return $match[1];
		}
		return $this->prefixedTerm( $term, $prefixes );
	}

	/** @param array<string, string> $prefixes */
	private function prefixedTerm( string $term, array $prefixes ): ?string {
		if ( !preg_match( '/^([A-Za-z][A-Za-z0-9_-]*):([A-Za-z][A-Za-z0-9_-]*)$/', $term, $match ) ) {
			return null;
		}
		return isset( $prefixes[$match[1]] ) ? $prefixes[$match[1]] . $match[2] : null;
	}
}
