<?php

declare( strict_types = 1 );

namespace MediaWiki\Extension\WikibaseBootstrap;

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

/**
 * Applies a reviewed bootstrap plan through Wikibase's entity-store API.
 *
 * This service intentionally supports only the bundled Suite profile. It is
 * shared by the Special page and maintenance command so neither front end owns
 * entity creation or local-ID resolution.
 */
class BootstrapService {
	/** @var array<string, string> */
	private array $bundlePaths;

	/** @param array<string, string> $bundlePaths */
	public function __construct( array $bundlePaths ) {
		$this->bundlePaths = $bundlePaths;
	}

	public static function newFromConfig(): self {
		$directory = rtrim(
			(string)MediaWikiServices::getInstance()
				->getMainConfig()
				->get( 'WikibaseBootstrapBundleDirectory' ),
			'/'
		);
		return new self( [
			'minimal' => "$directory/wikibase-bootstrap.ttl",
			'extended' => "$directory/wikibase-bootstrap-extended.ttl",
		] );
	}

	/** @return array{properties: list<array<string, mixed>>, errors: string[]} */
	public function planBundle( string $bundle ): array {
		if ( !isset( $this->bundlePaths[$bundle] ) ) {
			return [ 'properties' => [], 'errors' => [ 'Unknown bootstrap bundle.' ] ];
		}
		$contents = file_get_contents( $this->bundlePaths[$bundle] );
		if ( $contents === false ) {
			return [ 'properties' => [], 'errors' => [ 'The bootstrap bundle could not be read.' ] ];
		}
		return ( new BundlePlanner() )->plan( $contents );
	}

	/**
	 * @return array{propertyCount: int, sourceIds: array<string, string>}
	 */
	public function applyBundle( string $bundle, User $user ): array {
		if ( !$user->isAllowed( 'bootstrapontology' ) ) {
			throw new RuntimeException( 'You do not have permission to bootstrap this Wikibase.' );
		}
		if ( !$this->isEligible() ) {
			throw new RuntimeException( 'This Wikibase has active entities and cannot be bootstrapped.' );
		}

		$plan = $this->planBundle( $bundle );
		if ( $plan['errors'] !== [] ) {
			throw new RuntimeException( implode( ' ', $plan['errors'] ) );
		}

		$revisions = [];
		$sourceIds = [];
		$guidGenerator = new GuidGenerator();
		$store = WikibaseRepo::getEntityStore();
		foreach ( $plan['properties'] as $propertyPlan ) {
			$property = new Property(
				null,
				$this->fingerprint( $propertyPlan['label'], $propertyPlan['description'] ),
				$propertyPlan['datatype']
			);
			$store->assignFreshId( $property );
			$revision = $store->saveEntity(
				$property,
				'Ontology bootstrap',
				$user
			);
			$entity = $revision->getEntity();
			$id = $entity->getId();
			if ( !( $id instanceof PropertyId ) ) {
				throw new RuntimeException( 'Wikibase did not assign a property ID during bootstrap.' );
			}
			$sourceIds[$propertyPlan['sourceIri']] = $id->getSerialization();
			$revisions[$propertyPlan['sourceIri']] = $revision;
		}

		foreach ( $plan['properties'] as $propertyPlan ) {
			$revision = $revisions[$propertyPlan['sourceIri']];
			$property = $revision->getEntity();
			foreach ( $propertyPlan['claims'] as $claim ) {
				if ( !isset( $sourceIds[$claim['property']] ) ) {
					throw new RuntimeException( 'A bootstrap claim refers to an unknown bootstrap property.' );
				}
				$property->getStatements()->addStatement(
					new Statement(
						new PropertyValueSnak(
							new NumericPropertyId( $sourceIds[$claim['property']] ),
							new StringValue( $claim['value'] )
						),
						null,
						null,
						$guidGenerator->newGuid( $property->getId() )
					)
				);
			}
			if ( $propertyPlan['claims'] !== [] ) {
				$revisions[$propertyPlan['sourceIri']] = $store->saveEntity(
					$property,
					'Ontology bootstrap',
					$user,
					0,
					$revision->getRevisionId()
				);
			}
		}

		return [
			'propertyCount' => count( $plan['properties'] ),
			'sourceIds' => $sourceIds,
		];
	}

	public function isEligible(): bool {
		foreach ( $this->activeEntityCounts() as $count ) {
			if ( $count > 0 ) {
				return false;
			}
		}
		return true;
	}

	/** @return array<string, int> */
	public function activeEntityCounts(): array {
		$counts = [];
		$connectionProvider = MediaWikiServices::getInstance()->getConnectionProvider();
		foreach ( WikibaseRepo::getEntityNamespaceLookup()->getEntityNamespaces() as $type => $namespace ) {
			$counts[$type] = (int)$connectionProvider->getReplicaDatabase()
				->newSelectQueryBuilder()
				->select( 'COUNT(*)' )
				->from( 'page' )
				->where( [ 'page_namespace' => $namespace ] )
				->caller( __METHOD__ )
				->fetchField();
		}
		return $counts;
	}

	/** @param array{value: string, language: string} $label */
	/** @param array{value: string, language: string}|null $description */
	private function fingerprint( array $label, ?array $description ): Fingerprint {
		$labels = new TermList( [ new Term( $label['language'], $label['value'] ) ] );
		$descriptions = $description === null ?
			new TermList() :
			new TermList( [ new Term( $description['language'], $description['value'] ) ] );
		return new Fingerprint( $labels, $descriptions );
	}
}
