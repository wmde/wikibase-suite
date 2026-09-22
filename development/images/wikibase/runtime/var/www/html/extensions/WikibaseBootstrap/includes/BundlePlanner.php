<?php

declare( strict_types = 1 );

namespace MediaWiki\Extension\WikibaseBootstrap;

/**
 * Reads the constrained Suite bootstrap profile; this is not a general Turtle
 * parser. The bundled assets are validated separately with SHACL in wbs-dev.
 */
class BundlePlanner {
	/** @return array{properties: list<array<string, mixed>>, errors: string[]} */
	public function plan( string $contents ): array {
		$prefixes = $this->prefixes( $contents );
		$properties = [];
		$errors = [];
		preg_match_all(
			'/^([A-Za-z][A-Za-z0-9_-]*):([A-Za-z][A-Za-z0-9_-]*)\s+a\s+owl:(ObjectProperty|DatatypeProperty)\s*;(.*?)(?=^[A-Za-z][A-Za-z0-9_-]*:[A-Za-z][A-Za-z0-9_-]*\s+a\s+owl:|\z)/ms',
			$contents,
			$matches,
			PREG_SET_ORDER
		);

		foreach ( $matches as $match ) {
			$body = $match[4];
			$sourceIri = $this->prefixedTerm( $match[1] . ':' . $match[2], $prefixes );
			$label = $this->literal( $body, 'rdfs:label' );
			$datatype = $this->literal( $body, 'wbb:datatype' );
			if ( $sourceIri === null || $label === null || $datatype === null ) {
				$errors[] = "The bootstrap entity {$match[1]}:{$match[2]} is missing a source IRI, label, or datatype.";
				continue;
			}
			if ( !preg_match( '/wbb:kind\s+wbb:Property\b/', $body ) ) {
				$errors[] = "The bootstrap entity {$match[1]}:{$match[2]} is not declared as a property.";
				continue;
			}

			$claims = $this->claims( $body, $prefixes );
			if ( $claims === null ) {
				$errors[] = "The bootstrap entity {$match[1]}:{$match[2]} has an invalid claim.";
				continue;
			}
			$properties[] = [
				'sourceIri' => $sourceIri,
				'label' => $label,
				'description' => $this->literal( $body, 'dcterms:description' ),
				'datatype' => $datatype['value'],
				'claims' => $claims,
			];
		}

		if ( $properties === [] && $errors === [] ) {
			$errors[] = 'No importable Suite bootstrap properties were found.';
		}

		return [ 'properties' => $properties, 'errors' => $errors ];
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
			'/' . preg_quote( $predicate, '/' ) . '\s+"((?:[^"\\\\]|\\.)*)"(?:@([A-Za-z-]+))?/',
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
	 * @return list<array{property: string, value: string}>
	 */
	private function claims( string $body, array $prefixes ): ?array {
		preg_match_all(
			'/wbb:claim\s+\[\s*wbb:property\s+([^;\s]+)\s*;\s*wbb:value\s+([^;\]]+)\s*;?\s*\]/ms',
			$body,
			$matches,
			PREG_SET_ORDER
		);
		$claims = [];
		foreach ( $matches as $match ) {
			$property = $this->term( trim( $match[1] ), $prefixes );
			$value = $this->term( trim( $match[2] ), $prefixes );
			if ( $property === null || $value === null ) {
				return null;
			}
			$claims[] = [ 'property' => $property, 'value' => $value ];
		}
		return $claims;
	}

	/** @param array<string, string> $prefixes */
	private function term( string $term, array $prefixes ): ?string {
		if ( preg_match( '/^<([^>]+)>$/', $term, $match ) ) {
			return $match[1];
		}
		if ( preg_match( '/^"((?:[^"\\\\]|\\\\.)*)"$/', $term, $match ) ) {
			return stripcslashes( $match[1] );
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
