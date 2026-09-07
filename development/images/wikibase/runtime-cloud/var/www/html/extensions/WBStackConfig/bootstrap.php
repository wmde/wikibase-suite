<?php

require_once __DIR__ . '/src/loadShim.php';

$requestDomain = PHP_SAPI === 'cli'
	? getenv( 'WBS_DOMAIN' )
	: ( $_SERVER['SERVER_NAME'] ?? '' );

if ( !is_string( $requestDomain ) || $requestDomain === '' ) {
	echo PHP_SAPI === 'cli'
		? 'WBS_DOMAIN is required for a Cloud CLI workload.'
		: 'SERVER_NAME is required for a Cloud web request.';
	exit( 1 );
}

try {
	WBStack\Info\GlobalSet::forDomain( $requestDomain );
} catch ( WBStack\Info\GlobalSetException $exception ) {
	if ( PHP_SAPI !== 'cli' ) {
		http_response_code( $exception->getCode() );
	}
	echo $exception->getMessage();
	exit( 1 );
}

/*
 * Open question for Cloud: is interception before WebStart actually required?
 * Specifically, can an old tenant schema prevent LocalSettings.php and
 * extension registration from completing before update.php can be launched?
 * The internal APIs remain an extension; this one action stays here until that
 * earlier timing is known to be unnecessary.
 */
if (
	PHP_SAPI !== 'cli'
	&& getenv( 'WBSTACK_LOAD_MW_INTERNAL' ) === 'yes'
	&& basename( $_SERVER['SCRIPT_FILENAME'] ?? '' ) === 'api.php'
	&& ( $_GET['action'] ?? '' ) === 'wbstackUpdate'
) {
	require_once dirname( __DIR__ ) . '/WBStackInternal/src/Instance.php';
	require_once dirname( __DIR__ ) . '/WBStackInternal/src/MaintenanceCommand.php';
	require_once dirname( __DIR__ ) . '/WBStackInternal/src/PreApiWbStackUpdate.php';
	( new WBStack\Internal\PreApiWbStackUpdate() )->execute();
	exit( 0 );
}

