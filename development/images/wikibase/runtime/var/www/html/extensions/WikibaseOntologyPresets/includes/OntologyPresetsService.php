<?php

declare( strict_types = 1 );

namespace MediaWiki\Extension\WikibaseOntologyPresets;

use DataValues\StringValue;
use MediaWiki\MediaWikiServices;
use MediaWiki\User\User;
use RuntimeException;
use Wikibase\DataModel\Entity\Property;
use Wikibase\DataModel\Entity\PropertyId;
use Wikibase\DataModel\Entity\NumericPropertyId;
use Wikibase\DataModel\Services\Statement\GuidGenerator;
use Wikibase\DataModel\Snak\PropertyValueSnak;
use Wikibase\DataModel\Statement\Statement;
use Wikibase\DataModel\Term\Fingerprint;
use Wikibase\DataModel\Term\Term;
use Wikibase\DataModel\Term\TermList;
use Wikibase\Repo\WikibaseRepo;

/** Applies the bundled property preset through Wikibase's entity-store API. */
class OntologyPresetsService {
	private const PRESET_PATH = __DIR__ . '/../ontologies/ontology-presets.ttl';

	/** @return array{properties: list<array<string, mixed>>, metadata: array<string, mixed>, errors: string[]} */
	public function planPreset(): array {
		$contents = file_get_contents( self::PRESET_PATH );
		$planner = new PresetPlanner();
		if ( $contents === false ) {
			$plan = $planner->plan( '' );
			$plan['errors'] = [ 'The ontology preset could not be read.' ];
			return $plan;
		}
		return $planner->plan( $contents );
	}

	public function applyPreset( User $user ): int {
		if ( !$user->isAllowed( 'applyontologypresets' ) ) {
			throw new RuntimeException( 'You do not have permission to apply this ontology preset.' );
		}
		if ( !$this->isEligible() ) {
			throw new RuntimeException( 'This Wikibase has already allocated property IDs and cannot use the ontology preset.' );
		}

		$plan = $this->planPreset();
		if ( $plan['errors'] !== [] ) {
			throw new RuntimeException( implode( ' ', $plan['errors'] ) );
		}

		$revisions = [];
		$guidGenerator = new GuidGenerator();
		$store = WikibaseRepo::getEntityStore();
		foreach ( $plan['properties'] as $propertyPlan ) {
			$property = new Property(
				null,
				$this->fingerprint( $propertyPlan['label'], $propertyPlan['description'] ),
				$propertyPlan['datatype']
			);
			$store->assignFreshId( $property );
			$id = $property->getId();
			if ( !( $id instanceof PropertyId ) ||
				$id->getSerialization() !== $propertyPlan['id']
			) {
				throw new RuntimeException( 'Wikibase did not assign the property ID expected by the ontology preset.' );
			}
			$revision = $store->saveEntity(
				$property,
				'Create ontology preset property',
				$user
			);
			$revisions[$propertyPlan['id']] = $revision;
		}

		foreach ( $plan['properties'] as $propertyPlan ) {
			$revision = $revisions[$propertyPlan['id']];
			$property = $revision->getEntity();
			foreach ( $propertyPlan['claims'] as $claim ) {
				$property->getStatements()->addStatement(
					new Statement(
						new PropertyValueSnak(
							new NumericPropertyId( $claim['property'] ),
							new StringValue( $claim['value'] )
						),
						null,
						null,
						$guidGenerator->newGuid( $property->getId() )
					)
				);
			}
			if ( $propertyPlan['claims'] !== [] ) {
				$store->saveEntity(
					$property,
					'Add ontology preset statements',
					$user,
					0,
					$revision->getRevisionId()
				);
			}
		}

		return count( $plan['properties'] );
	}

	public function isEligible(): bool {
		return !$this->hasAllocatedPropertyIds() && $this->activePropertyCount() === 0;
	}

	public function isAvailableTo( User $user ): bool {
		return $user->isAllowed( 'applyontologypresets' ) && $this->isEligible();
	}

	public function activePropertyCount(): int {
		$namespaces = WikibaseRepo::getEntityNamespaceLookup()->getEntityNamespaces();
		return (int)MediaWikiServices::getInstance()
			->getConnectionProvider()
			->getPrimaryDatabase()
			->newSelectQueryBuilder()
			->select( 'COUNT(*)' )
			->from( 'page' )
			->where( [ 'page_namespace' => $namespaces['property'] ] )
			->caller( __METHOD__ )
			->fetchField();
	}

	private function hasAllocatedPropertyIds(): bool {
		$lastId = WikibaseRepo::getRepoDomainDbFactory()
			->newRepoDb()
			->connections()
			->getWriteConnection()
			->newSelectQueryBuilder()
			->select( 'id_value' )
			->from( 'wb_id_counters' )
			->where( [ 'id_type' => 'wikibase-property' ] )
			->caller( __METHOD__ )
			->fetchField();
		return $lastId !== false && (int)$lastId > 0;
	}

	/**
	 * @param array{value: string, language: string} $label
	 * @param array{value: string, language: string}|null $description
	 */
	private function fingerprint( array $label, ?array $description ): Fingerprint {
		$labels = new TermList( [ new Term( $label['language'], $label['value'] ) ] );
		$descriptions = $description === null ?
			new TermList() :
			new TermList( [ new Term( $description['language'], $description['value'] ) ] );
		return new Fingerprint( $labels, $descriptions );
	}
}
