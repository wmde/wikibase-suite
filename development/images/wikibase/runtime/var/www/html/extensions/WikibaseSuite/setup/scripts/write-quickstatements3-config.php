<?php

declare( strict_types=1 );

if ( $argc !== 4 ) {
	fwrite( STDERR, "Usage: write-quickstatements3-config.php DATABASE_JSON OAUTH_JSON OUTPUT_JSON\n" );
	exit( 1 );
}
$database = json_decode( (string)file_get_contents( $argv[1] ), true, flags: JSON_THROW_ON_ERROR );
$oauth = json_decode( (string)file_get_contents( $argv[2] ), true, flags: JSON_THROW_ON_ERROR );
$clientId = $oauth['key'] ?? $oauth['consumerKey'] ?? null;
$clientSecret = $oauth['secret'] ?? $oauth['consumerSecret'] ?? null;
if ( !is_string( $clientId ) || $clientId === '' || !is_string( $clientSecret ) || $clientSecret === '' ) {
	fwrite( STDERR, "OAuth 2 consumer response did not contain client credentials.\n" );
	exit( 1 );
}
$database['OAUTH_CLIENT_ID'] = $clientId;
$database['OAUTH_CLIENT_SECRET'] = $clientSecret;

$directory = dirname( $argv[3] );
if ( !is_dir( $directory ) && !mkdir( $directory, 0700, true ) && !is_dir( $directory ) ) {
	fwrite( STDERR, "Could not create the QuickStatements 3 data directory.\n" );
	exit( 1 );
}
$temporary = $argv[3] . '.tmp';
if ( file_put_contents( $temporary, json_encode( $database, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT ) . "\n" ) === false ) {
	fwrite( STDERR, "Could not write QuickStatements 3 configuration.\n" );
	exit( 1 );
}
chmod( $temporary, 0600 );
if ( !rename( $temporary, $argv[3] ) ) {
	@unlink( $temporary );
	fwrite( STDERR, "Could not install QuickStatements 3 configuration.\n" );
	exit( 1 );
}
