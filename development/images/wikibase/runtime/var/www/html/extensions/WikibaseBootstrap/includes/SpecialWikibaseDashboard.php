<?php

namespace MediaWiki\Extension\WikibaseBootstrap;

use SpecialPage;
use SiteStats;
use Wikibase\Repo\WikibaseRepo;
use MediaWiki\MediaWikiServices;

class SpecialWikibaseDashboard extends SpecialPage {

	public function __construct() {
		parent::__construct( 'WikibaseDashboard' );
	}

	public function execute( $subPage ) {
		$this->setHeaders();
		$this->outputHeader();

		$output = $this->getOutput();

		[ $itemCount, $propertyCount ] = $this->getEntityCounts();
		$tripleCount = $this->getTripleCount();

		$newItemUrl = SpecialPage::getTitleFor( 'NewItem' )->getLocalURL();
		$newPropertyUrl = SpecialPage::getTitleFor( 'NewProperty' )->getLocalURL();
		$importPropertiesUrl = SpecialPage::getTitleFor( 'OntologyBootstrap' )->getLocalURL();

		// Placeholder banner
		$output->addHTML(
			'<div style="background: #eaecf0; border: 1px solid #a2a9b1; padding: 12px 16px; margin-bottom: 16px; border-radius: 2px;">' .
				'<strong>Placeholder:</strong> This dashboard is under construction.' .
			'</div>'
		);

		$output->addHTML(
			'<div style="display: flex; align-items: flex-start; justify-content: space-between; padding: 0px 20px">' .

				'<table style="border-collapse: collapse; flex: 0 0 auto; width: 400px; height: 185px;">' .
					'<tr style="height: 25%">' .
						'<th colspan="2" style="border: 1px solid #a2a9b1; padding: 6px 12px; text-align: left;">Your Wikibase Ontology</th>' .
					'</tr>' .
					'<tr style="height: 25%">' .
						'<td style="border: 1px solid #a2a9b1; padding: 6px 12px; width: 35%">Items</td>' .
						'<td style="border: 1px solid #a2a9b1; padding: 6px 12px;">' .
							'<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">' .
								'<span>' . htmlspecialchars( (string)$itemCount ) . '</span>' .
								'<a class="mw-ui-button mw-ui-progressive" style="width: 100px; height: 30px; font-size: 10px;" href="' . htmlspecialchars( $newItemUrl ) . '">Add item</a>' .
							'</div>' .
						'</td>' .
					'</tr>' .
					'<tr style="height: 25%">' .
						'<td style="border: 1px solid #a2a9b1; padding: 6px 12px;">Properties</td>' .
						'<td style="border: 1px solid #a2a9b1; padding: 6px 12px;">' .
							'<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">' .
								'<span>' . htmlspecialchars( (string)$propertyCount ) . '</span>' .
								'<a class="mw-ui-button mw-ui-progressive" style="width: 100px; height: 30px; font-size: 10px;" href="' . htmlspecialchars( $newPropertyUrl ) . '">Add property</a>' .
							'</div>' .
						'</td>' .
					'</tr>' .
					'<tr style="height: 25%">' .
						'<td style="border: 1px solid #a2a9b1; padding: 6px 12px;">Triples</td>' .
						'<td style="border: 1px solid #a2a9b1; padding: 6px 12px;">' .
							'<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">' .
								'<span>' . htmlspecialchars( $tripleCount !== null ? (string)$tripleCount : 'n/a' ) . '</span>' .
							'</div>' .
						'</td>' .
					'</tr>' .
				'</table>' .

				'<div style="border: 1px solid #a2a9b1; padding: 12px 16px; flex: 1 1 auto; max-width: 400px; height: 160px">' .
					'<p><b>Help and resources:</b></p>' .
					'<ul>' .
						'<li>How to add data</li>' .
						'<li>Change the name and logo of your Wikibase</li>' .
						'<li>Configure a mail service</li>' .
						'<li>Add extensions</li>' .
						'<li>Activate Wikimedia logins</li>' .
					'</ul>' .
				'</div>' .

			'</div>'
		);

		$output->addHTML(
			'<div style="margin-top: 16px; padding-left: 20px">' .
				'<a class="mw-ui-button mw-ui-progressive" style="width: 400px;" href="' . htmlspecialchars( $importPropertiesUrl ) . '">Import a set of properties</a>' .
			'</div>'
		);
	}

	/**
	 * @return int[] [ $itemCount, $propertyCount ]
	 */
	private function getEntityCounts(): array {
		$namespaceLookup = WikibaseRepo::getEntityNamespaceLookup();

		$itemNs = $namespaceLookup->getEntityNamespace( 'item' );
		$propertyNs = $namespaceLookup->getEntityNamespace( 'property' );

		$itemCount = $itemNs !== null ? SiteStats::pagesInNs( $itemNs ) : 0;
		$propertyCount = $propertyNs !== null ? SiteStats::pagesInNs( $propertyNs ) : 0;

		return [ $itemCount, $propertyCount ];
	}

	/**
	 * @return int|null null if the query service isn't reachable/configured
	 */
	private function getTripleCount(): ?int {
		$config = MediaWikiServices::getInstance()->getMainConfig();
		$endpoint = $config->has( 'WBRepoSettings' )
			? ( $config->get( 'WBRepoSettings' )['sparqlEndpoint'] ?? null )
			: null;

		if ( $endpoint === null ) {
			return null;
		}

		$query = 'SELECT (COUNT(*) AS ?count) WHERE { ?s ?p ?o }';
		$url = $endpoint . '?query=' . urlencode( $query ) . '&format=json';

		$options = [ 'timeout' => 5 ];
		$req = MediaWikiServices::getInstance()->getHttpRequestFactory()
			->create( $url, $options, __METHOD__ );
		$req->setHeader( 'Accept', 'application/sparql-results+json' );

		$status = $req->execute();
		if ( !$status->isOK() ) {
			return null;
		}

		$data = json_decode( $req->getContent(), true );
		return isset( $data['results']['bindings'][0]['count']['value'] )
			? (int)$data['results']['bindings'][0]['count']['value']
			: null;
	}

	public function getGroupName() {
		return 'wikibase';
	}
}