<?php

declare( strict_types = 1 );

namespace MediaWiki\Extension\WikibaseOntologyPresets;

/** Reads the narrow Turtle convention used by the pinned upstream property set. */
class PresetPlanner {
	/** @return array{properties: list<array<string, mixed>>, metadata: array<string, mixed>, errors: string[]} */
	public function plan( string $contents ): array {
		$prefixes = $this->prefixes( $contents );
		$propertiesById = [];
		$irisById = [];
		$errors = [];
		preg_match_all(
			'/^([A-Za-z][A-Za-z0-9_-]*):(P[1-9][0-9]*)\s+a\s+owl:(?:ObjectProperty|DatatypeProperty)\s*;(.*?)(?=^[A-Za-z][A-Za-z0-9_-]*:(?:P[1-9][0-9]*)?\s+a\s+owl:|\z)/ms',
			$contents,
			$matches,
			PREG_SET_ORDER
		);

		foreach ( $matches as $match ) {
			$id = $match[2];
			$body = $match[3];
			$iri = $this->prefixedTerm( "{$match[1]}:$id", $prefixes );
			$label = $this->literal( $body, 'rdfs:label' );
			$description = $this->literal( $body, 'dcterms:description' );
			preg_match( '/"Wikibase ID: (P[1-9][0-9]*)"/', $body, $idNote );
			preg_match( '/"Wikibase datatype: ([a-z][a-z-]*)"/', $body, $datatypeNote );
			if ( $iri === null || $label === null || $description === null ||
				( $idNote[1] ?? '' ) !== $id || !isset( $datatypeNote[1] )
			) {
				$errors[] = "The preset property $id is missing a matching ID note, label, description, or datatype.";
				continue;
			}
			if ( !in_array( $datatypeNote[1], [
				'wikibase-item', 'wikibase-property', 'url', 'external-id', 'string'
			], true ) ) {
				$errors[] = "The preset property $id has an unsupported datatype.";
				continue;
			}

			$claims = $this->claims( $body, $prefixes );
			if ( $claims === null ) {
				$errors[] = "The preset property $id has an unsupported or invalid claim.";
				continue;
			}
			if ( isset( $propertiesById[$id] ) ) {
				$errors[] = "The preset property $id is declared more than once.";
				continue;
			}
			$propertiesById[$id] = [
				'id' => $id,
				'label' => $label,
				'description' => $description,
				'datatype' => $datatypeNote[1],
				'claims' => $claims,
			];
			$irisById[$id] = $iri;
		}

		if ( $propertiesById === [] ) {
			$errors[] = 'No preset properties were found.';
		}

		$idsByIri = [];
		foreach ( $irisById as $id => $iri ) {
			$idsByIri[$iri] = $id;
		}
		foreach ( $propertiesById as $id => $property ) {
			$mappedClaims = [];
			foreach ( $property['claims'] as $claim ) {
				$claimId = $idsByIri[$claim['property']] ?? null;
				if ( $claimId === null || !in_array( $propertiesById[$claimId]['datatype'], [
					'url', 'external-id', 'string'
				], true ) ) {
					$errors[] = "The preset property $id refers to a missing or unsupported claim property.";
					continue;
				}
				$mappedClaims[] = [ 'property' => $claimId, 'value' => $claim['value'] ];
			}
			$propertiesById[$id]['claims'] = $mappedClaims;
		}

		uksort( $propertiesById, static fn ( string $a, string $b ): int =>
			(int)substr( $a, 1 ) <=> (int)substr( $b, 1 )
		);
		$nextId = 1;
		foreach ( array_keys( $propertiesById ) as $id ) {
			if ( $id !== 'P' . $nextId ) {
				$errors[] = 'Preset property IDs must be consecutive, starting at P1.';
				break;
			}
			$nextId++;
		}
		return [
			'properties' => array_values( $propertiesById ),
			'metadata' => $this->metadata( $contents ),
			'errors' => $errors,
		];
	}

	/** @return array{contributors: list<string>, license: string, publisher: string, rights: string, version: string} */
	private function metadata( string $contents ): array {
		preg_match(
			'/^wb:\s+a\s+owl:Ontology\s*;(?<metadata>.*?)\s*\.\s*$/ms',
			$contents,
			$match
		);
		$metadata = $match['metadata'] ?? '';
		$contributors = [];
		if ( preg_match( '/dcterms:contributor\\s+(.*?)\\s*;/s', $metadata, $match ) ) {
			preg_match_all( '/"([^"]+)"/', $match[1], $contributorMatches );
			$contributors = $contributorMatches[1];
		}
		preg_match( '/dcterms:license\\s+<([^>]+)>/', $metadata, $license );
		preg_match( '/dcterms:publisher\\s+<([^>]+)>/', $metadata, $publisher );

		return [
			'contributors' => $contributors,
			'license' => $license[1] ?? '',
			'publisher' => $publisher[1] ?? '',
			'rights' => $this->literal( $metadata, 'dcterms:rights' )['value'] ?? '',
			'version' => $this->literal( $metadata, 'owl:versionInfo' )['value'] ?? '',
		];
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
