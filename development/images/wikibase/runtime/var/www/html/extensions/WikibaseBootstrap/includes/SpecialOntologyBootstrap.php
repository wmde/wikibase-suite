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
		$resetState = $service->resetState();
		$propertyCount = $resetState['propertyCount'];
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

		if ( $propertyCount > 0 &&
			$request->wasPosted() &&
			$request->getVal( 'action' ) === 'reset'
		) {
			$resetState = $service->resetState();
			$propertyCount = $resetState['propertyCount'];
			if ( !$this->getUser()->matchEditToken( $request->getVal( 'token' ) ) ) {
				$resetError = $this->msg( 'ontologybootstrap-invalid-token' )->text();
			} elseif ( !$this->getUser()->isAllowed( 'resetwikibaseentities' ) ) {
				$resetError = $this->msg( 'ontologybootstrap-reset-permission' )->text();
			} elseif ( $propertyCount > BootstrapService::RESET_PROPERTY_LIMIT ) {
				$resetError = $this->msg(
					'ontologybootstrap-reset-too-many',
					BootstrapService::RESET_PROPERTY_LIMIT
				)->text();
			} elseif ( $resetState['hasActiveItemStatements'] ) {
				$resetError = $this->msg( 'ontologybootstrap-reset-item-statements' )->text();
			} elseif ( $request->getVal( 'confirmation' ) !== "DELETE $propertyCount PROPERTIES" ) {
				$resetError = $this->msg( 'ontologybootstrap-reset-confirm-required', $propertyCount )->text();
			} else {
				$deletedPropertyCount = $propertyCount;
				$this->deletePropertyBatch();
				$resetState = $service->resetState();
				$propertyCount = $resetState['propertyCount'];
				if ( $propertyCount === 0 ) {
					$request->getSession()->set( self::FLASH_SESSION_KEY, [
						'resetCompleted' => $deletedPropertyCount,
					] );
					$out->redirect( $this->getPageTitle()->getLocalURL() );
					return;
				}
				$resetProgress = $this->msg(
					'ontologybootstrap-reset-progress',
					min( BootstrapService::RESET_PROPERTY_LIMIT, $deletedPropertyCount ),
					$propertyCount
				)->text();
			}
		}

		$out->addJsConfigVars( 'wgWikibaseBootstrap', [
			'summary' => $this->msg( 'ontologybootstrap-summary' )->text(),
			'bundles' => $this->bundleCatalog( $service, $propertyCount, $applyBundle, $applyError ),
			'completed' => (int)( $completion['completed'] ?? 0 ),
			'resetCompleted' => (int)( $completion['resetCompleted'] ?? 0 ),
			'pageUrl' => $this->getPageTitle()->getLocalURL(),
			'token' => $this->getUser()->getEditToken(),
			'reset' => $propertyCount > 0 ? $this->resetData(
				$propertyCount,
				$resetState['hasActiveItemStatements'],
				$resetState['canOfferReset'],
				$resetError,
				$resetProgress
			) : null,
		] );
		$out->addHTML( Html::rawElement( 'div', [ 'id' => 'wikibase-bootstrap-app' ] ) );
	}

	/** @return list<array<string, mixed>> */
	private function bundleCatalog(
		BootstrapService $service,
		int $propertyCount,
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
				'disabled' => $propertyCount > 0,
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

	/** @return array<string, string|int|bool> */
	private function resetData(
		int $propertyCount,
		bool $hasActiveItemStatements,
		bool $canOfferReset,
		string $error,
		string $progress
	): array {
		return [
			'summary' => $this->msg( 'ontologybootstrap-existing-summary' )->text(),
			'resetInvitation' => $this->msg(
				'ontologybootstrap-reset-invitation',
				$propertyCount
			)->text(),
			'warning' => $this->msg( 'ontologybootstrap-existing-warning' )->text(),
			'hasActiveItemStatements' => $hasActiveItemStatements,
			'itemStatementsError' => $this->msg( 'ontologybootstrap-reset-item-statements' )->text(),
			'canOfferReset' => $canOfferReset,
			'canReset' => $canOfferReset &&
				$this->getUser()->isAllowed( 'resetwikibaseentities' ),
			'tooMany' => $this->msg(
				'ontologybootstrap-reset-too-many',
				BootstrapService::RESET_PROPERTY_LIMIT
			)->text(),
			'permissionError' => $this->msg( 'ontologybootstrap-reset-permission' )->text(),
			'confirmationIntro' => $this->msg( 'ontologybootstrap-reset-confirm-intro', $propertyCount )->text(),
			'confirmationText' => $this->msg( 'ontologybootstrap-reset-confirm-text', $propertyCount )->text(),
			'submitLabel' => $this->msg( 'ontologybootstrap-reset-submit' )->text(),
			'pageUrl' => $this->getPageTitle()->getLocalURL(),
			'token' => $this->getUser()->getEditToken(),
			'error' => $error,
			'progress' => $progress,
		];
	}

	private function deletePropertyBatch(): void {
		$namespaces = WikibaseRepo::getEntityNamespaceLookup()->getEntityNamespaces();
		$rows = MediaWikiServices::getInstance()
			->getConnectionProvider()
			->getPrimaryDatabase()
			->newSelectQueryBuilder()
			->select( [ 'page_namespace', 'page_title' ] )
			->from( 'page' )
			->where( [ 'page_namespace' => $namespaces['property'] ] )
			->orderBy( 'page_id' )
			->limit( BootstrapService::RESET_PROPERTY_LIMIT )
			->caller( __METHOD__ )
			->fetchResultSet();
		$store = WikibaseRepo::getEntityStore();
		$lookup = WikibaseRepo::getEntityIdLookup();
		foreach ( $rows as $row ) {
			$title = Title::makeTitle( (int)$row->page_namespace, $row->page_title );
			$id = $lookup->getEntityIdForTitle( $title );
			if ( $id ) {
				$store->deleteEntity( $id, 'Ontology bootstrap property reset', $this->getUser() );
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
