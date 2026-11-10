<?php

declare( strict_types = 1 );

namespace MediaWiki\Extension\WikibaseOntologyPresets;

use MediaWiki\Html\Html;
use MediaWiki\SpecialPage\SpecialPage;
use RuntimeException;

class SpecialOntologyPresets extends SpecialPage {
	private const FLASH_SESSION_KEY = 'WikibaseOntologyPresetsCompletion';

	public function __construct() {
		parent::__construct( 'OntologyPresets' );
	}

	public function getRestriction(): string {
		return 'applyontologypresets';
	}

	public function execute( $subPage ): void {
		$this->setHeaders();
		$this->checkPermissions();

		$out = $this->getOutput();
		$out->addModuleStyles( [ 'codex-styles', 'ext.wikibaseOntologyPresets.apply' ] );
		$out->addModules( [ 'ext.wikibaseOntologyPresets.apply' ] );

		$service = new OntologyPresetsService();
		$applyError = '';
		$request = $this->getRequest();
		$completion = $request->getSession()->get( self::FLASH_SESSION_KEY, [] );
		$request->getSession()->remove( self::FLASH_SESSION_KEY );

		if ( $request->wasPosted() && $request->getVal( 'action' ) === 'apply' ) {
			if ( !$this->getUser()->matchEditToken( $request->getVal( 'token' ) ) ) {
				$applyError = $this->msg( 'ontologypresets-invalid-token' )->text();
			} else {
				try {
					$propertyCount = $service->applyPreset( $this->getUser() );
					$request->getSession()->set( self::FLASH_SESSION_KEY, [
						'completed' => $propertyCount,
					] );
					$out->redirect( $this->getPageTitle()->getLocalURL() );
					return;
				} catch ( RuntimeException $exception ) {
					$applyError = $exception->getMessage();
				}
			}
		}

		$out->addJsConfigVars( 'wgWikibaseOntologyPresets', [
			'summary' => $this->msg( 'ontologypresets-summary' )->text(),
			'preset' => $this->presetData( $service, $applyError ),
			'completed' => (int)( $completion['completed'] ?? 0 ),
			'propertiesUrl' => SpecialPage::getTitleFor( 'ListProperties' )->getLocalURL(),
			'pageUrl' => $this->getPageTitle()->getLocalURL(),
			'token' => $this->getUser()->getEditToken(),
		] );
		$out->addHTML( Html::rawElement( 'div', [ 'id' => 'wikibase-ontology-presets-app' ] ) );
	}

	/** @return array<string, mixed> */
	private function presetData(
		OntologyPresetsService $service,
		string $applyError
	): array {
		$plan = $service->planPreset();
		$metadata = $plan['metadata'];
		$datatypeMessages = [
			'wikibase-item' => 'ontologypresets-datatype-item',
			'wikibase-property' => 'ontologypresets-datatype-property',
			'url' => 'ontologypresets-datatype-url',
			'external-id' => 'ontologypresets-datatype-external-id',
			'string' => 'ontologypresets-datatype-string',
		];
		$properties = [];
		if ( $plan['errors'] === [] ) {
			foreach ( $plan['properties'] as $property ) {
				$wikidataId = '';
				foreach ( $property['claims'] as $claim ) {
					if ( $claim['property'] === 'P6' ) {
						$wikidataId = $claim['value'];
						break;
					}
				}
				$properties[] = [
					'id' => $property['id'],
					'label' => $property['label']['value'],
					'datatype' => $this->msg( $datatypeMessages[$property['datatype']] )->text(),
					'description' => $property['description']['value'],
					'wikidataId' => $wikidataId,
				];
			}
		}
		return [
			'title' => $this->msg( 'ontologypresets-core-properties' )->text(),
			'contributors' => $metadata['contributors'],
			'license' => $metadata['license'],
			'publisher' => $metadata['publisher'],
			'rights' => $metadata['rights'],
			'version' => $metadata['version'],
			'propertyCount' => count( $plan['properties'] ),
			'lastPropertyId' => 'P' . count( $plan['properties'] ),
			'properties' => $properties,
			'disabled' => !$service->isEligible(),
			'error' => $plan['errors'] === [] ?
				$applyError : implode( ' ', $plan['errors'] ),
		];
	}
}
