<?php

namespace MediaWiki\Extension\WikibaseSuite;

use SpecialPage;
use MediaWiki\MediaWikiServices;
use MediaWiki\Extension\WikibaseSuite\Utils;

class SpecialWikibaseDashboard extends SpecialPage {

	public function __construct() {
		parent::__construct( 'WikibaseDashboard' );
	}

	public function execute( $subPage ) {
		$this->setHeaders();
		$this->outputHeader();

		$output = $this->getOutput();
		$output->addModuleStyles( 'ext.wikibasesuite.dashboard.styles' );

		[ $itemCount, $propertyCount ] = Utils::getEntityCounts();
		$tripleCount = $this->getTripleCount();

		$newItemUrl = SpecialPage::getTitleFor( 'NewItem' )->getLocalURL();
		$newPropertyUrl = SpecialPage::getTitleFor( 'NewProperty' )->getLocalURL();
		$scriptPath = MediaWikiServices::getInstance()->getMainConfig()->get( 'ScriptPath' );
		$bannerImageUrl = $scriptPath . '/extensions/WikibaseSuite/resources/assets/wbs_dashboard_banner.png';

		$output->addHTML(
			'<div class="wbs-dashboard-banner">' .
				'<img src="' . htmlspecialchars( $bannerImageUrl ) . '" alt="Wikibase">' .
			'</div>'
		);

		$output->addHTML(
			'<div class="wbs-dashboard-row">' .

				'<table class="wbs-dashboard-table">' .
					'<tr>' .
						'<th colspan="2">Your Wikibase Ontology</th>' .
					'</tr>' .
					'<tr>' .
						'<td>Items</td>' .
						'<td id="wbs-dashboard-item-count">' .
							'<div class="wbs-dashboard-cell-value">' .
								'<span>' . htmlspecialchars( (string)$itemCount ) . '</span>' .
									'<a class="cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--action-progressive cdx-button--weight-primary wbs-dashboard-action-button" href="' . htmlspecialchars( $newItemUrl ) . '">Add item</a>' .
							'</div>' .
						'</td>' .
					'</tr>' .
					'<tr>' .
						'<td>Properties</td>' .
						'<td id="wbs-dashboard-property-count">' .
							'<div class="wbs-dashboard-cell-value">' .
								'<span>' . htmlspecialchars( (string)$propertyCount ) . '</span>' .
								'<a class="cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--action-progressive cdx-button--weight-primary wbs-dashboard-action-button" href="' . htmlspecialchars( $newPropertyUrl ) . '">Add property</a>' .
							'</div>' .
						'</td>' .
					'</tr>' .
					'<tr>' .
						'<td>Triples</td>' .
						'<td id="wbs-dashboard-triple-count">' .
							'<div class="wbs-dashboard-cell-value">' .
								'<span>' . htmlspecialchars( (string)$tripleCount ) . '</span>' .
							'</div>' .
						'</td>' .
					'</tr>' .
				'</table>' .

				'<div class="wbs-dashboard-help">' .
					'<p><b>Help and resources:</b></p>' .
					'<ul>' .
						'<li><a href="https://zenodo.org/records/15828659">How to Wikibase - Quickstart Guide</a></li>' .
						'<li><a href="https://www.wikidata.org/wiki/Help:QuickStatements">Upload data with QuickStatements</a></li>' .
						'<li><a href="https://github.com/wmde/wikibase-suite/blob/main/docs/configure/enable-login-with-wikimedia.md">Enable Wikimedia Logins for your editors</a></li>' .
						'<li><a href="https://github.com/wmde/wikibase-suite/blob/main/docs/README.md">Configuration and maintenance</a></li>' .
						'<li><a href="https://www.mediawiki.org/wiki/Manual:$wgLogos">Change the logo of your Wikibase</a></li>' .
					'</ul>' .
				'</div>' .

			'</div>'
		);

		$importPropertiesUrl = Hooks::ontologyBootstrapUrlFor( $this->getUser() );
		if ( $importPropertiesUrl !== null ) {

			$output->addHTML(
				'<div class="wbs-dashboard-import-row">' .
					'<a class="cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--action-progressive cdx-button--weight-primary wbs-dashboard-import-button" href="' . htmlspecialchars( $importPropertiesUrl ) . '">Import a set of properties</a>' .
				'</div>'
			);
		}
	}


	/**
	 * @return int
	 */
	private function getTripleCount(): ?int {
		$config = MediaWikiServices::getInstance()->getMainConfig();
		$endpoint = $config->has( 'WBRepoSettings' )
			? ( $config->get( 'WBRepoSettings' )['sparqlEndpoint'] ?? 0 )
			: 0;

		if ( $endpoint === 0 ) {
			return 0;
		}

		$query = 'SELECT (COUNT(*) AS ?count) WHERE { ?s ?p ?o }';
		$url = $endpoint . '?query=' . urlencode( $query ) . '&format=json';

		$options = [ 'timeout' => 5 ];
		$req = MediaWikiServices::getInstance()->getHttpRequestFactory()
			->create( $url, $options, __METHOD__ );
		$req->setHeader( 'Accept', 'application/sparql-results+json' );

		$status = $req->execute();
		if ( !$status->isOK() ) {
			return 0;
		}

		$data = json_decode( $req->getContent(), true );
		return isset( $data['results']['bindings'][0]['count']['value'] )
			? (int)$data['results']['bindings'][0]['count']['value']
			: 0;
	}

	public function getGroupName() {
		return 'wikibase';
	}
}
