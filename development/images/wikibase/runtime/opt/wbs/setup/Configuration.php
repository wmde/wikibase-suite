<?php

declare( strict_types=1 );

# Shared writers for WBS-managed persistent configuration.

const INSTANCE_KEYS = [
	'wgSitename',
	'wgMetaNamespace',
	'wgScriptPath',
	'wgServer',
	'wgDBtype',
	'wgDBserver',
	'wgDBname',
	'wgDBuser',
	'wgDBpassword',
	'wgDBprefix',
	'wgDBssl',
	'wgDBTableOptions',
	'wgLanguageCode',
	'wgLocaltimezone',
	'wgSecretKey',
	'wgAuthenticationTokenVersion',
	'wgUpgradeKey',
];

function fail( string $message ): never {
	fwrite( STDERR, "$message\n" );
	exit( 1 );
}

function atomicWrite( string $path, string $contents ): void {
	$directory = dirname( $path );
	if ( !is_dir( $directory ) && !mkdir( $directory, 0700, true ) && !is_dir( $directory ) ) {
		fail( "Could not create $directory." );
	}
	$temporary = tempnam( $directory, '.wbs-config-' );
	if ( $temporary === false ) {
		fail( "Could not create a temporary file in $directory." );
	}
	chmod( $temporary, 0600 );
	if ( file_put_contents( $temporary, $contents ) === false || !rename( $temporary, $path ) ) {
		@unlink( $temporary );
		fail( "Could not write $path." );
	}
	chmod( $path, 0644 );
}

function phpAssignments( array $settings, ?string $elasticsearchHost = null ): string {
	$output = "<?php\n\n";
	$output .= "# WBS-managed settings unique to this installation. Back up this file.\n";
	$output .= "# User customizations belong in /config/LocalSettings.php.\n\n";
	foreach ( INSTANCE_KEYS as $key ) {
		if ( !array_key_exists( $key, $settings ) ) {
			fail( "Required instance setting $key is missing." );
		}
		$output .= '$' . $key . ' = ' . var_export( $settings[$key], true ) . ";\n";
	}
	if ( $elasticsearchHost !== null && $elasticsearchHost !== '' ) {
		$output .= "\n\$elasticsearchHost = " . var_export( $elasticsearchHost, true ) . ";\n";
	}
	return $output;
}

function customSettingsPreamble(): string {
	return "<?php\n\n" .
		"# Optionally load a separate extension configuration file for existing WBS configurations.\n" .
		"# New configuration can be written directly in this file.\n" .
		"if ( is_file( __DIR__ . '/Extensions.php' ) ) {\n" .
		"\trequire_once __DIR__ . '/Extensions.php';\n" .
		"}\n";
}

function fresh( string $instancePath, string $customPath ): void {
	$requiredEnvironment = [
		'DB_SERVER', 'DB_PASS', 'DB_USER', 'DB_NAME',
		'MW_WG_SERVER', 'MW_WG_LANGUAGE_CODE', 'MW_WG_SITENAME',
	];
	foreach ( $requiredEnvironment as $name ) {
		if ( getenv( $name ) === false || getenv( $name ) === '' ) {
			fail( "$name is required but is not set." );
		}
	}
	$sitename = (string)getenv( 'MW_WG_SITENAME' );
	$settings = [
		'wgSitename' => $sitename,
		'wgMetaNamespace' => ucfirst( $sitename ),
		'wgScriptPath' => '/w',
		'wgServer' => (string)getenv( 'MW_WG_SERVER' ),
		'wgDBtype' => 'mysql',
		'wgDBserver' => (string)getenv( 'DB_SERVER' ),
		'wgDBname' => (string)getenv( 'DB_NAME' ),
		'wgDBuser' => (string)getenv( 'DB_USER' ),
		'wgDBpassword' => (string)getenv( 'DB_PASS' ),
		'wgDBprefix' => '',
		'wgDBssl' => false,
		'wgDBTableOptions' => 'ENGINE=InnoDB, DEFAULT CHARSET=binary',
		'wgLanguageCode' => (string)getenv( 'MW_WG_LANGUAGE_CODE' ),
		'wgLocaltimezone' => 'UTC',
		'wgSecretKey' => bin2hex( random_bytes( 32 ) ),
		'wgAuthenticationTokenVersion' => '1',
		'wgUpgradeKey' => bin2hex( random_bytes( 8 ) ),
	];
	$host = getenv( 'ELASTICSEARCH_HOST' );
	atomicWrite( $instancePath, phpAssignments( $settings, $host === false ? null : $host ) );
	if ( !file_exists( $customPath ) ) {
		atomicWrite(
			$customPath,
			customSettingsPreamble() .
				"\n# Add MediaWiki and extension customizations below.\n"
		);
	}
}

if ( realpath( $_SERVER['SCRIPT_FILENAME'] ?? '' ) === __FILE__ ) {
	$command = $argv[1] ?? '';
	switch ( $command ) {
		case 'fresh':
			if ( count( $argv ) !== 4 ) {
				fail( 'Usage: Configuration.php fresh INSTANCE CUSTOM' );
			}
			fresh( $argv[2], $argv[3] );
			break;
		default:
			fail( 'Expected fresh.' );
	}
}
