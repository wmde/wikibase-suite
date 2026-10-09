<?php

declare( strict_types=1 );

function runMigration( string $script, array $arguments ): array {
	$process = proc_open(
		[ PHP_BINARY, $script, ...$arguments ],
		[ 0 => [ 'pipe', 'r' ], 1 => [ 'pipe', 'w' ], 2 => [ 'pipe', 'w' ] ],
		$pipes
	);
	if ( !is_resource( $process ) ) {
		throw new RuntimeException( 'Could not start the migration command.' );
	}
	fclose( $pipes[0] );
	$output = stream_get_contents( $pipes[1] );
	$error = stream_get_contents( $pipes[2] );
	fclose( $pipes[1] );
	fclose( $pipes[2] );
	return [ proc_close( $process ), $output, $error ];
}

// Run standalone with PHP, or against the actual image from the upgrade suite.
$migration = $argv[1] ?? dirname( __DIR__, 2 ) .
	'/images/wikibase/runtime/var/www/html/extensions/WikibaseSuite/setup/migration/MigrateConfiguration.php';
$suite7 = file_get_contents( __DIR__ . '/fixtures/wbs-7/LocalSettings.php' );
$inherited = file_get_contents( __DIR__ . '/fixtures/wbs-1-to-6/LocalSettings.php' );
$mediaWiki = "require_once '/LocalSettings.MediaWiki.php';";
$extensions = "require_once '/LocalSettings.Extensions.php';";
$loop = <<<'PHP'
foreach (glob("LocalSettings.d/*.php") as $filename)
{
	include $filename;
}
PHP;

$cases = [
	'fresh WBS 7' => [ $suite7, 'wbs-7' ],
	'inherited WBS 1–6' => [ $inherited, 'wbs-1-to-6' ],
	'formatted includes and commented duplicates' => [
		str_replace( $mediaWiki, '// ' . $mediaWiki . "\nrequire_once /* loader */ \"/LocalSettings.MediaWiki.php\" ;", $suite7 ),
		'wbs-7',
	],
	'formatted historical loop' => [
		str_replace( $loop, "foreach ( glob( 'LocalSettings.d/*.php' ) as \$filename ) { /* bundled */ include \$filename; }", $inherited ),
		'wbs-1-to-6',
	],
	'CRLF settings' => [ str_replace( "\n", "\r\n", $inherited ), 'wbs-1-to-6' ],
	'marker mentioned in a comment' => [
		str_replace( '<?php', "<?php\n// Keep # End of generated LocalSettings.php below the loaders.", $suite7 ),
		'wbs-7',
	],
	'duplicate includes' => [ str_replace( $mediaWiki, "$mediaWiki\n$mediaWiki", $suite7 ), null ],
	'duplicate loops' => [ str_replace( $loop, "$loop\n$loop", $inherited ), null ],
	'mixed loaders' => [ str_replace( $extensions, "$extensions\n$loop", $suite7 ), null ],
	'conditional loop' => [ str_replace( $loop, "if ( true ) { $loop }", $inherited ), null ],
	'conditional includes' => [ str_replace( $mediaWiki, "if ( true ) $mediaWiki", $suite7 ), null ],
	'reversed includes' => [ strtr( $suite7, [ $mediaWiki => $extensions, $extensions => $mediaWiki ] ), null ],
	'loader below marker' => [ str_replace( $extensions, '', $suite7 ) . "\n$extensions\n", null ],
	'custom loop path' => [ str_replace( 'LocalSettings.d/*.php', 'custom/*.php', $inherited ), null ],
	'missing marker' => [ str_replace( '# End of generated LocalSettings.php', '# Removed marker', $inherited ), null ],
];

$directory = sys_get_temp_dir() . '/wbs-recognition-' . bin2hex( random_bytes( 8 ) );
mkdir( $directory, 0700 );
try {
	foreach ( $cases as $name => [ $source, $expectedShape ] ) {
		file_put_contents( "$directory/LocalSettings.php", $source );
		@unlink( "$directory/prefix.php" );
		[ $status, $output, $error ] = runMigration( $migration, [
			'write-loadable-legacy-config', "$directory/LocalSettings.php", "$directory/prefix.php"
		] );
		if ( file_get_contents( "$directory/LocalSettings.php" ) !== $source ) {
			throw new RuntimeException( "$name: source configuration changed." );
		}
		if ( $expectedShape === null ) {
			if ( $status === 0 || file_exists( "$directory/prefix.php" ) || $error === '' ) {
				throw new RuntimeException( "$name: unsupported configuration was accepted." );
			}
		} else {
			if ( $status !== 0 || trim( $output ) !== $expectedShape ) {
				throw new RuntimeException( "$name: expected $expectedShape, got $output$error" );
			}
			$prefix = file_get_contents( "$directory/prefix.php" );
			if ( substr_count( $prefix, '/config/LoadExtensions.php' ) !== 1 ||
				str_contains( $prefix, "wfLoadExtension( 'WikibaseEdtf' );" ) ||
				( $expectedShape === 'wbs-1-to-6' && str_contains( $prefix, 'Suite7Defaults.php' ) )
			) {
				throw new RuntimeException( "$name: incorrect loader adaptation or custom tail included." );
			}
		}
	}
	echo "All configuration recognition checks passed.\n";

	file_put_contents( "$directory/InstanceSettings.php", "<?php\n" );
	$validationCases = [
		'comments and ordinary strings' => [
			"<?php\n// /LocalSettings.MediaWiki.php is only a comment.\n" .
				'$example = "/LocalSettings.Extensions.php";' . "\n",
			true,
		],
		'old MediaWiki include' => [ "<?php\n$mediaWiki\n", false ],
		'old extension include' => [ "<?php\n$extensions\n", false ],
		'old extension loop' => [ "<?php\n$loop\n", false ],
		'old generated marker' => [ "<?php\n# End of generated LocalSettings.php\n", false ],
	];
	foreach ( $validationCases as $name => [ $source, $allowed ] ) {
		file_put_contents( "$directory/LocalSettings.php", $source );
		[ $status ] = runMigration( $migration, [
			'validate', "$directory/InstanceSettings.php", "$directory/LocalSettings.php"
		] );
		if ( ( $status === 0 ) !== $allowed ) {
			throw new RuntimeException( "$name: unexpected prepared configuration validation result." );
		}
	}
	echo "Prepared configuration validation checks passed.\n";
} finally {
	foreach ( glob( "$directory/*" ) as $file ) {
		unlink( $file );
	}
	rmdir( $directory );
}
