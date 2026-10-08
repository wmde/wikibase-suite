<?php

declare( strict_types=1 );

$server = (string)getenv( 'DB_SERVER' );
if ( !preg_match( '/^([^:]+)(?::([0-9]+))?$/', $server, $matches ) ) {
	fwrite( STDERR, "Invalid DB_SERVER for QuickStatements 3 provisioning.\n" );
	exit( 1 );
}
$host = $matches[1];
$port = isset( $matches[2] ) ? (int)$matches[2] : 3306;
$rootPassword = (string)getenv( 'DB_PASS' );
if ( $rootPassword === '' ) {
	fwrite( STDERR, "DB_PASS is required to provision the QuickStatements 3 database.\n" );
	exit( 1 );
}

mysqli_report( MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT );
$database = new mysqli( $host, 'root', $rootPassword, '', $port );
$databaseName = 'quickstatements3';
$databaseUser = 'quickstatements3';
$databasePassword = bin2hex( random_bytes( 32 ) );
$quotedPassword = "'" . $database->real_escape_string( $databasePassword ) . "'";

$database->query( "CREATE DATABASE IF NOT EXISTS `$databaseName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci" );
$database->query( "CREATE USER IF NOT EXISTS '$databaseUser'@'%' IDENTIFIED BY $quotedPassword" );
$database->query( "ALTER USER '$databaseUser'@'%' IDENTIFIED BY $quotedPassword" );
$database->query( "GRANT ALL PRIVILEGES ON `$databaseName`.* TO '$databaseUser'@'%'" );

echo json_encode( [
	'DB_HOST' => $host,
	'DB_PORT' => (string)$port,
	'DB_NAME' => $databaseName,
	'DB_USER' => $databaseUser,
	'DB_PASSWORD' => $databasePassword,
	'WIKIBASE_PUBLIC_URL' => getenv( 'MW_WG_SERVER' ),
	'OAUTH_AUTHORIZATION_SERVER' => getenv( 'MW_WG_SERVER' ),
	'DEFAULT_WIKIBASE_URL' => getenv( 'MW_WG_SERVER' ),
	'DJANGO_SECRET_KEY' => bin2hex( random_bytes( 32 ) ),
], JSON_THROW_ON_ERROR );
