<?php

use MediaWiki\Registration\ExtensionRegistry;

class UpdateState extends Maintenance {
	public function __construct() {
		parent::__construct();
		$this->addOption( 'output', 'Write the updater inputs to this file.', true, true );
	}

	public function execute() {
		$image = file_get_contents( __DIR__ . '/../setup/last-update' );
		if ( $image === false ) {
			throw new RuntimeException( 'Could not read the image update marker.' );
		}

		$config = [];
		foreach ( [ 'InstanceSettings.php', 'LocalSettings.php', 'BeforeExtensions.php' ] as $name ) {
			$path = '/config/' . $name;
			$config[$name] = is_file( $path ) ? hash_file( 'sha256', $path ) : null;
			if ( $config[$name] === false ) {
				throw new RuntimeException( "Could not read $path." );
			}
		}

		// Track loaded names, not extension files or versions. Code updates remain operator-owned.
		$extensions = array_keys( ExtensionRegistry::getInstance()->getAllThings() );
		sort( $extensions, SORT_STRING );
		$state = json_encode( [
			'image' => trim( $image ),
			'config' => $config,
			'extensions' => $extensions,
		], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR ) . "\n";
		// Keep diagnostics and configuration output out of the state file.
		if ( file_put_contents( $this->getOption( 'output' ), $state ) === false ) {
			throw new RuntimeException( 'Could not write the updater state.' );
		}
	}
}

$maintClass = UpdateState::class;
