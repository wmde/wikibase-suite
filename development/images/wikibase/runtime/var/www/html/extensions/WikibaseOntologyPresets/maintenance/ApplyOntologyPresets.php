<?php

declare( strict_types = 1 );

namespace MediaWiki\Extension\WikibaseOntologyPresets\Maintenance;

$basePath = getenv( 'MW_INSTALL_PATH' ) ?: __DIR__ . '/../../..';
require_once "$basePath/maintenance/Maintenance.php";

use MediaWiki\Extension\WikibaseOntologyPresets\OntologyPresetsService;
use MediaWiki\Maintenance\Maintenance;
use MediaWiki\MediaWikiServices;
use RuntimeException;

/** Applies the bundled ontology preset from the command line. */
class ApplyOntologyPresets extends Maintenance {
	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Apply the bundled ontology preset before property IDs have been allocated.' );
		$this->addOption( 'user', 'Existing user to attribute the edits to.', true, true );
		$this->addOption( 'confirm', 'Required acknowledgement that this writes Wikibase properties.' );
		$this->requireExtension( 'WikibaseOntologyPresets' );
	}

	public function execute(): void {
		if ( !$this->hasOption( 'confirm' ) ) {
			$this->fatalError( 'Pass --confirm to create the preset properties.', 1 );
		}
		$user = MediaWikiServices::getInstance()
			->getUserFactory()
			->newFromName( $this->getOption( 'user' ) );
		if ( !$user || !$user->isRegistered() ) {
			$this->fatalError( 'The --user value must name an existing registered user.', 1 );
		}

		try {
			$propertyCount = ( new OntologyPresetsService() )->applyPreset( $user );
		} catch ( RuntimeException $exception ) {
			$this->fatalError( $exception->getMessage(), 1 );
		}
		$this->output( "Created $propertyCount preset properties.\n" );
	}
}

$maintClass = ApplyOntologyPresets::class;
require_once RUN_MAINTENANCE_IF_MAIN;
