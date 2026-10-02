<?php

declare( strict_types = 1 );

namespace MediaWiki\Extension\WikibaseBootstrap\Maintenance;

$basePath = getenv( 'MW_INSTALL_PATH' ) ?: __DIR__ . '/../../..';
require_once "$basePath/maintenance/Maintenance.php";

use MediaWiki\Extension\WikibaseBootstrap\BootstrapService;
use MediaWiki\Maintenance\Maintenance;
use MediaWiki\MediaWikiServices;
use RuntimeException;

/** Applies a reviewed Wikibase Suite ontology bootstrap without a browser. */
class BootstrapOntology extends Maintenance {
	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Apply a reviewed Wikibase Suite ontology bootstrap to an empty Wikibase.' );
		$this->addOption( 'bundle', 'Bundle to apply: minimal or extended.', true, true );
		$this->addOption( 'user', 'Existing user to attribute the edits to.', true, true );
		$this->addOption( 'confirm', 'Required acknowledgement that this writes Wikibase entities.' );
		$this->requireExtension( 'WikibaseBootstrap' );
	}

	public function execute(): void {
		if ( !$this->hasOption( 'confirm' ) ) {
			$this->fatalError( 'Pass --confirm to apply a bootstrap bundle.', 1 );
		}
		$user = MediaWikiServices::getInstance()
			->getUserFactory()
			->newFromName( $this->getOption( 'user' ) );
		if ( !$user || !$user->isRegistered() ) {
			$this->fatalError( 'The --user value must name an existing registered user.', 1 );
		}

		try {
			$result = BootstrapService::newFromConfig()->applyBundle(
				$this->getOption( 'bundle' ),
				$user
			);
		} catch ( RuntimeException $exception ) {
			$this->fatalError( $exception->getMessage(), 1 );
		}
		$this->output( "Applied {$result['propertyCount']} properties from the {$this->getOption( 'bundle' )} bundle.\n" );
	}
}

$maintClass = BootstrapOntology::class;
require_once RUN_MAINTENANCE_IF_MAIN;
