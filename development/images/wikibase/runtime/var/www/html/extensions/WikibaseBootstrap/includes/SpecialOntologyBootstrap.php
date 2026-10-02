<?php

declare( strict_types = 1 );

namespace MediaWiki\Extension\WikibaseBootstrap;

use MediaWiki\Html\Html;
use MediaWiki\MediaWikiServices;
use MediaWiki\SpecialPage\SpecialPage;
use MediaWiki\Title\Title;
use RuntimeException;
use Wikibase\Repo\WikibaseRepo;

class SpecialOntologyBootstrap extends SpecialPage {
	private const RESET_BATCH_SIZE = 25;
	private const RESET_ENTITY_LIMIT = 25;
	private const FLASH_SESSION_KEY = 'WikibaseBootstrapCompletion';

	public function __construct() {
		parent::__construct( 'OntologyBootstrap' );
	}

	public function getRestriction(): string {
		return 'bootstrapontology';
	}

	public function execute( $subPage ): void {
		$this->setHeaders();
		$this->checkPermissions();

		$out = $this->getOutput();
		$out->addModuleStyles( [ 'codex-styles', 'ext.wikibaseBootstrap.apply' ] );
		$out->addModules( [ 'ext.wikibaseBootstrap.apply' ] );

		$service = $this->bootstrapService();
		$counts = $service->activeEntityCounts();
		$applyError = '';
		$applyBundle = '';
		$resetError = '';
		$resetProgress = '';
		$request = $this->getRequest();
		$completion = $request->getSession()->get( self::FLASH_SESSION_KEY, [] );
		$request->getSession()->remove( self::FLASH_SESSION_KEY );

		if ( $request->wasPosted() && $request->getVal( 'action' ) === 'apply' ) {
			$applyBundle = (string)$request->getVal( 'bundle' );
			if ( !$this->getUser()->matchEditToken( $request->getVal( 'token' ) ) ) {
				$applyError = $this->msg( 'ontologybootstrap-invalid-token' )->text();
			} else {
				try {
					$result = $service->applyBundle( $applyBundle, $this->getUser() );
					$request->getSession()->set( self::FLASH_SESSION_KEY, [
						'completed' => $result['propertyCount'],
					] );
					$out->redirect( $this->getPageTitle()->getLocalURL() );
					return;
				} catch ( RuntimeException $exception ) {
					$applyError = $exception->getMessage();
				}
			}
		}

		if ( array_sum( $counts ) > 0 &&
			$request->wasPosted() &&
			$request->getVal( 'action' ) === 'reset'
		) {
			$total = array_sum( $counts );
			if ( !$this->getUser()->matchEditToken( $request->getVal( 'token' ) ) ) {
				$resetError = $this->msg( 'ontologybootstrap-invalid-token' )->text();
			} elseif ( $total > self::RESET_ENTITY_LIMIT ) {
				$resetError = $this->msg( 'ontologybootstrap-reset-too-many', self::RESET_ENTITY_LIMIT )->text();
			} elseif ( $request->getVal( 'confirmation' ) !== "DELETE $total ENTITIES" ) {
				$resetError = $this->msg( 'ontologybootstrap-reset-confirm-required', $total )->text();
			} else {
				$this->deleteEntityBatch();
				$counts = $service->activeEntityCounts();
				if ( array_sum( $counts ) === 0 ) {
					$request->getSession()->set( self::FLASH_SESSION_KEY, [
						'resetCompleted' => $total,
					] );
					$out->redirect( $this->getPageTitle()->getLocalURL() );
					return;
				}
				$resetProgress = $this->msg(
					'ontologybootstrap-reset-progress',
					min( self::RESET_BATCH_SIZE, $total ),
					array_sum( $counts )
				)->text();
			}
		}

		$out->addJsConfigVars( 'wgWikibaseBootstrap', [
			'summary' => $this->msg( 'ontologybootstrap-summary' )->text(),
			'bundles' => $this->bundleCatalog( $service, $counts, $applyBundle, $applyError ),
			'completed' => (int)( $completion['completed'] ?? 0 ),
			'resetCompleted' => (int)( $completion['resetCompleted'] ?? 0 ),
			'pageUrl' => $this->getPageTitle()->getLocalURL(),
			'token' => $this->getUser()->getEditToken(),
			'reset' => array_sum( $counts ) > 0 ? $this->resetData( $counts, $resetError, $resetProgress ) : null,
		] );
		$out->addHTML( Html::rawElement( 'div', [ 'id' => 'wikibase-bootstrap-app' ] ) );
	}

	/** @param array<string, int> $counts */
	/** @return list<array<string, mixed>> */
	private function bundleCatalog(
		BootstrapService $service,
		array $counts,
		string $applyBundle,
		string $applyError
	): array {
		$bundles = [];
		foreach ( $this->bundles() as $key => $bundle ) {
			$contents = file_get_contents( $bundle['path'] ) ?: '';
			$plan = $service->planBundle( $key );
			$metadata = $this->ontologyMetadata( $contents );
			$bundles[] = [
				'key' => $key,
				'title' => $this->msg( $bundle['message'] )->text(),
				'description' => $metadata['description'],
				'contributors' => $metadata['contributors'],
				'license' => $metadata['license'],
				'publisher' => $metadata['publisher'],
				'publisherLabel' => $metadata['publisherLabel'],
				'rights' => $metadata['rights'],
				'version' => $metadata['version'],
				'sourceUrl' => $metadata['source'],
				'propertyCount' => count( $plan['properties'] ),
				'itemCount' => 0,
				'disabled' => array_sum( $counts ) > 0,
				'error' => $plan['errors'] === [] && $key === $applyBundle ?
					$applyError : implode( ' ', $plan['errors'] ),
			];
		}
		return $bundles;
	}

	/**
	 * Extract display metadata from the final ontology declaration in a reviewed bundle.
	 *
	 * This deliberately remains a narrow reader for the bundled profile. It is not a
	 * general Turtle parser or an upload validator.
	 *
	 * @return array{description: string, contributors: list<string>, license: string, publisher: string, publisherLabel: string, rights: string, source: string, version: string}
	 */
	private function ontologyMetadata( string $contents ): array {
		$metadata = '';
		preg_match(
			'/wbbs:bundle\s+a\s+owl:Ontology\s*;(?<metadata>.*?)\s*\.\s*$/s',
			$contents,
			$match
		);
		$metadata = $match['metadata'] ?? '';
		$literal = static function ( string $predicate ) use ( $metadata ): string {
			preg_match(
				'/' . preg_quote( $predicate, '/' ) . '\\s+"([^"]+)"(?:@[A-Za-z-]+)?\\s*(?:;|\\.|$)/',
				$metadata,
				$match
			);
			return $match[1] ?? '';
		};
		$iri = static function ( string $predicate ) use ( $metadata ): string {
			preg_match(
				'/' . preg_quote( $predicate, '/' ) . '\\s+<([^>]+)>\\s*;/',
				$metadata,
				$match
			);
			return $match[1] ?? '';
		};
		$contributors = [];
		if ( preg_match( '/dcterms:contributor\\s+(.*?)\\s*;/s', $metadata, $match ) ) {
			preg_match_all( '/"([^"]+)"/', $match[1], $contributorMatches );
			$contributors = $contributorMatches[1];
		}

		$publisher = $iri( 'dcterms:publisher' );
		$publisherLabel = '';
		if ( $publisher !== '' ) {
			preg_match(
				'/' . preg_quote( '<' . $publisher . '>', '/' ) . '\\s+rdfs:label\\s+"([^"]+)"/',
				$contents,
				$match
			);
			$publisherLabel = $match[1] ?? '';
		}

		return [
			'description' => $literal( 'dcterms:description' ) ?: 'Reviewed ontology bundle.',
			'contributors' => $contributors,
			'license' => $iri( 'dcterms:license' ),
			'publisher' => $publisher,
			'publisherLabel' => $publisherLabel,
			'rights' => $literal( 'dcterms:rights' ),
			'source' => $iri( 'dcterms:source' ),
			'version' => $literal( 'owl:versionInfo' ),
		];
	}

	/** @param array<string, int> $counts */
	/** @return array<string, string|int|bool> */
	private function resetData( array $counts, string $error, string $progress ): array {
		$total = array_sum( $counts );
		return [
			'summary' => $this->msg( 'ontologybootstrap-existing-summary' )->text(),
			'resetInvitation' => $this->msg(
				'ontologybootstrap-reset-invitation',
				$counts['item'] ?? 0,
				$counts['property'] ?? 0
			)->text(),
			'warning' => $this->msg( 'ontologybootstrap-existing-warning' )->text(),
			'canOfferReset' => $total <= self::RESET_ENTITY_LIMIT,
			'canReset' => $total <= self::RESET_ENTITY_LIMIT &&
				$this->getUser()->isAllowed( 'resetwikibaseentities' ),
			'tooMany' => $this->msg( 'ontologybootstrap-reset-too-many', self::RESET_ENTITY_LIMIT )->text(),
			'permissionError' => $this->msg( 'ontologybootstrap-reset-permission' )->text(),
			'confirmationIntro' => $this->msg( 'ontologybootstrap-reset-confirm-intro', $total )->text(),
			'confirmationText' => $this->msg( 'ontologybootstrap-reset-confirm-text', $total )->text(),
			'submitLabel' => $this->msg( 'ontologybootstrap-reset-submit' )->text(),
			'pageUrl' => $this->getPageTitle()->getLocalURL(),
			'token' => $this->getUser()->getEditToken(),
			'error' => $error,
			'progress' => $progress,
		];
	}

	private function deleteEntityBatch(): void {
		$namespaces = array_values( WikibaseRepo::getEntityNamespaceLookup()->getEntityNamespaces() );
		$rows = MediaWikiServices::getInstance()
			->getConnectionProvider()
			->getPrimaryDatabase()
			->newSelectQueryBuilder()
			->select( [ 'page_namespace', 'page_title' ] )
			->from( 'page' )
			->where( [ 'page_namespace' => $namespaces ] )
			->orderBy( 'page_id' )
			->limit( self::RESET_BATCH_SIZE )
			->caller( __METHOD__ )
			->fetchResultSet();
		$store = WikibaseRepo::getEntityStore();
		$lookup = WikibaseRepo::getEntityIdLookup();
		foreach ( $rows as $row ) {
			$title = Title::makeTitle( (int)$row->page_namespace, $row->page_title );
			$id = $lookup->getEntityIdForTitle( $title );
			if ( $id ) {
				$store->deleteEntity( $id, 'Ontology bootstrap reset', $this->getUser() );
			}
		}
	}

	private function bootstrapService(): BootstrapService {
		return BootstrapService::newFromConfig();
	}

	/** @return array<string, array{message: string, path: string}> */
	private function bundles(): array {
		$directory = rtrim(
			(string)$this->getConfig()->get( 'WikibaseBootstrapBundleDirectory' ),
			'/'
		);
		return [
			'minimal' => [
				'message' => 'ontologybootstrap-bundled-minimal',
				'path' => "$directory/wikibase-bootstrap.ttl",
			],
			'extended' => [
				'message' => 'ontologybootstrap-bundled-extended',
				'path' => "$directory/wikibase-bootstrap-extended.ttl",
			],
		];
	}
}
