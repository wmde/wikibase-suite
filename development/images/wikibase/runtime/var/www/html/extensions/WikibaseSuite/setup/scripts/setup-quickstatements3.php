<?php

declare( strict_types=1 );

if ( $argc < 2 || $argc > 3 ) {
	fwrite( STDERR, "Usage: setup-quickstatements3.php DATA_DIRECTORY [OAUTH_JSON]\n" );
	exit( 1 );
}
$directory = $argv[1];
if ( !is_dir( $directory ) && !mkdir( $directory, 0700, true ) && !is_dir( $directory ) ) {
	fwrite( STDERR, "Could not create the QuickStatements 3 data directory.\n" );
	exit( 1 );
}

$instanceSettings = '/config/InstanceSettings.php';
if ( is_readable( $instanceSettings ) ) {
	require $instanceSettings;
	$databaseServer = (string)( $wgDBserver ?? '' );
	$databaseUser = (string)( $wgDBuser ?? '' );
	$databasePassword = (string)( $wgDBpassword ?? '' );
} else {
	$databaseServer = (string)getenv( 'DB_SERVER' );
	$databaseUser = (string)getenv( 'DB_USER' );
	$databasePassword = (string)getenv( 'DB_PASS' );
}
if ( $databaseServer === '' || $databaseUser === '' || $databasePassword === '' ) {
	fwrite( STDERR, "MediaWiki database connection is unavailable for QuickStatements 3.\n" );
	exit( 1 );
}

if ( $argc === 3 ) {
	$oauth = json_decode( (string)file_get_contents( $argv[2] ), true, flags: JSON_THROW_ON_ERROR );
	if ( ( $oauth['created'] ?? false ) !== true || ( $oauth['approved'] ?? 0 ) !== 1 ) {
		fwrite( STDERR, "QuickStatements 3 OAuth consumer was not created and approved.\n" );
		exit( 1 );
	}
	$clientId = $oauth['key'] ?? $oauth['consumerKey'] ?? null;
	$clientSecret = $oauth['secret'] ?? $oauth['consumerSecret'] ?? null;
	$existing = [];
	if ( is_file( "$directory/runtime.json" ) ) {
		try {
			$existing = json_decode( (string)file_get_contents( "$directory/runtime.json" ), true, flags: JSON_THROW_ON_ERROR );
		} catch ( JsonException $error ) {
			// A broken configuration should not prevent explicit OAuth recovery.
		}
	}
	$djangoSecret = is_array( $existing ) && !empty( $existing['DJANGO_SECRET_KEY'] )
		? $existing['DJANGO_SECRET_KEY']
		: bin2hex( random_bytes( 32 ) );
} else {
	$existing = json_decode( (string)file_get_contents( "$directory/runtime.json" ), true, flags: JSON_THROW_ON_ERROR );
	$clientId = $existing['OAUTH_CLIENT_ID'] ?? null;
	$clientSecret = $existing['OAUTH_CLIENT_SECRET'] ?? null;
	$djangoSecret = $existing['DJANGO_SECRET_KEY'] ?? null;
}

foreach ( [ $clientId, $clientSecret, $djangoSecret ] as $value ) {
	if ( !is_string( $value ) || $value === '' ) {
		fwrite( STDERR, "QuickStatements 3 credentials are incomplete.\n" );
		exit( 1 );
	}
}

$configuration = [
	'DB_SERVER' => $databaseServer,
	'DB_NAME' => 'quickstatements3',
	'DB_USER' => $databaseUser,
	'DB_PASS' => $databasePassword,
	'OAUTH_CLIENT_ID' => $clientId,
	'OAUTH_CLIENT_SECRET' => $clientSecret,
	'DJANGO_SECRET_KEY' => $djangoSecret,
];
$path = "$directory/runtime.json";
$temporary = tempnam( $directory, 'runtime.' );
if ( $temporary === false ||
	file_put_contents( $temporary, json_encode( $configuration, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT ) . "\n" ) === false ||
	!chmod( $temporary, 0600 ) || !rename( $temporary, $path ) ) {
	if ( $temporary !== false ) {
		@unlink( $temporary );
	}
	fwrite( STDERR, "Could not write QuickStatements 3 runtime configuration.\n" );
	exit( 1 );
}
