<?php

declare( strict_types=1 );

$domain = $_GET['domain'] ?? '';
if ( !is_string( $domain ) || !preg_match( '/^cloud[12]\.wikibase\.test$/', $domain ) ) {
	http_response_code( 404 );
	echo 'Unknown Cloud POC tenant.';
	exit;
}

$fixture = __DIR__ . '/WikiInfo-' . strtok( $domain, '.' ) . '.json';
header( 'Content-Type: application/json' );
readfile( $fixture );
