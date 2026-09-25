<?php

require_once __DIR__ . '/../loadShim.php';

// Only allow this file to be run via CLI
if ( php_sapi_name() !== 'cli' ) {
    echo 'Should only be run via the CLI';
    die(1);
}

// Validation of input by CLI user..
if( getenv( 'WBS_DOMAIN' ) == false ) {
    echo 'WBS_DOMAIN env var must be set to the domain this script should run on.';
    die(1);
}

// Try and get the wiki info (from env var) or fail with a message
try {
    \WBStack\Info\GlobalSet::forDomain( getenv( 'WBS_DOMAIN' ) );
} catch (Exception $ex) {
    echo 'Failed to work for WBS_DOMAIN: ' . getenv( 'WBS_DOMAIN' );
    die(1);
}
