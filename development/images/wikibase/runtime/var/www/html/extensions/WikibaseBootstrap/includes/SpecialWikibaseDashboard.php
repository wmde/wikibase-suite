<?php

namespace MediaWiki\Extension\WikibaseBootstrap;

use SpecialPage;

class SpecialWikibaseDashboard extends SpecialPage {

	public function __construct() {
		parent::__construct( 'WikibaseDashboard' );
	}

	public function execute( $subPage ) {
		$this->setHeaders();
		$this->outputHeader();

		$this->getOutput()->addWikiTextAsInterface( 'Some content.' );
	}

	public function getGroupName() {
		return 'wikibase';
	}
}