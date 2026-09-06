<?php

declare( strict_types=1 );

require '/opt/wbs/setup/Configuration.php';

function readJsonObject( string $path ): array {
	$contents = file_get_contents( $path );
	if ( $contents === false ) {
		fail( "Could not read $path." );
	}
	$start = strpos( $contents, '{' );
	$end = strrpos( $contents, '}' );
	if ( $start === false || $end === false || $end < $start ) {
		fail( "No JSON object was found in $path." );
	}
	$data = json_decode( substr( $contents, $start, $end - $start + 1 ), true );
	if ( !is_array( $data ) ) {
		fail( "Could not decode the configuration in $path." );
	}
	return $data;
}

function legacyElasticsearchHost( string $source ): ?string {
	if ( preg_match(
		'/\$elasticsearchHost\s*=\s*([\'\"])(.*?)\1\s*;/',
		$source,
		$matches
	) ) {
		return stripcslashes( $matches[2] );
	}
	return null;
}

function assignmentsInSourceOrder( string $source ): array {
	$tokens = token_get_all( $source );
	$assignments = [];
	$count = count( $tokens );
	for ( $i = 0; $i < $count; $i++ ) {
		$token = $tokens[$i];
		if ( !is_array( $token ) || $token[0] !== T_VARIABLE || !str_starts_with( $token[1], '$wg' ) ) {
			continue;
		}
		$name = substr( $token[1], 1 );
		$statement = $token[1];
		$hasAssignment = false;
		$depth = 0;
		for ( $j = $i + 1; $j < $count; $j++ ) {
			$text = is_array( $tokens[$j] ) ? $tokens[$j][1] : $tokens[$j];
			$statement .= $text;
			if ( $depth === 0 && in_array(
				$text,
				[ '=', '+=', '-=', '*=', '/=', '.=', '%=', '&=', '|=', '^=', '<<=', '>>=', '??=' ],
				true
			) ) {
				$hasAssignment = true;
			}
			if ( in_array( $text, [ '[', '(', '{' ], true ) ) {
				$depth++;
			} elseif ( in_array( $text, [ ']', ')', '}' ], true ) ) {
				$depth--;
			} elseif ( $text === ';' && $depth === 0 ) {
				if ( $hasAssignment ) {
					$assignments[] = [ 'name' => $name, 'source' => trim( $statement ) ];
				}
				$i = $j;
				break;
			}
		}
	}
	return $assignments;
}

function legacyGeneratedMarkerPosition( string $source ): int {
	$markerPosition = strpos( $source, '# End of generated LocalSettings.php' );
	if ( $markerPosition === false ) {
		fail( 'The legacy LocalSettings.php does not contain the expected generated marker.' );
	}
	return $markerPosition;
}

function adaptLegacyPrefix( string $prefix ): array {
	$mediaWikiLoader = "require_once '/LocalSettings.MediaWiki.php';";
	$extensionLoader = "require_once '/LocalSettings.Extensions.php';";

	if ( substr_count( $prefix, $mediaWikiLoader ) === 1 &&
		substr_count( $prefix, $extensionLoader ) === 1
	) {
		$prefix = str_replace(
			$mediaWikiLoader,
			"require '/opt/wbs/setup/migration/Suite7Defaults.php';",
			$prefix
		);
		$prefix = str_replace(
			$extensionLoader,
			"require '/opt/wbs/LoadExtensions.php';",
			$prefix
		);
		return [ $prefix, 'wbs-7' ];
	}
	fail( 'The generated LocalSettings.php is not a supported Wikibase Suite 7 configuration.' );
}

function legacyCustomTail( string $source, int $markerPosition ): string {
	$lineEnd = strpos( $source, "\n", $markerPosition );
	$tail = $lineEnd === false ? '' : substr( $source, $lineEnd + 1 );
	$generatedFooters = [
		"##############################################################################\n\n" .
			"# Add configuration values below which should be set after extensions are loaded\n",
		"##############################################################################\n\n" .
			"# Add MediaWiki or extension configuration values here that should be set after\n" .
			"# bundled extensions are loaded.\n",
	];
	foreach ( $generatedFooters as $footer ) {
		if ( str_starts_with( ltrim( $tail, "\r\n" ), $footer ) ) {
			return substr( ltrim( $tail, "\r\n" ), strlen( $footer ) );
		}
	}
	return $tail;
}

function stageInstanceSettings( string $legacyPath, string $actualJsonPath, string $instancePath ): void {
	$actual = readJsonObject( $actualJsonPath );
	$source = file_get_contents( $legacyPath );
	if ( $source === false ) {
		fail( "Could not read $legacyPath." );
	}
	atomicWrite( $instancePath, phpAssignments( $actual, legacyElasticsearchHost( $source ) ) );
}

function writeLoadableLegacyConfiguration( string $legacyPath, string $prefixPath ): void {
	$source = file_get_contents( $legacyPath );
	if ( $source === false ) {
		fail( "Could not read $legacyPath." );
	}
	$markerPosition = legacyGeneratedMarkerPosition( $source );
	$lineEnd = strpos( $source, "\n", $markerPosition );
	$prefix = $lineEnd === false ? $source : substr( $source, 0, $lineEnd + 1 );
	[ $prefix, $shape ] = adaptLegacyPrefix( $prefix );
	atomicWrite( $prefixPath, $prefix );
	echo "$shape\n";
}

function stageMigratedConfiguration(
	string $legacyPath,
	string $actualJsonPath,
	string $referenceJsonPath,
	string $customPath,
	string $instanceTemporaryPath,
	string $instancePath
): void {
	$actual = readJsonObject( $actualJsonPath );
	$reference = readJsonObject( $referenceJsonPath );
	$source = file_get_contents( $legacyPath );
	if ( $source === false ) {
		fail( "Could not read $legacyPath." );
	}
	$markerPosition = legacyGeneratedMarkerPosition( $source );
	$beforeMarker = substr( $source, 0, $markerPosition );
	$customTail = legacyCustomTail( $source, $markerPosition );
	$instanceLookup = array_fill_keys( INSTANCE_KEYS, true );
	$migratedAssignments = [];
	foreach ( assignmentsInSourceOrder( $beforeMarker ) as $assignment ) {
		$name = $assignment['name'];
		if ( isset( $instanceLookup[$name] ) ) {
			continue;
		}
		if ( !array_key_exists( $name, $reference ) || !array_key_exists( $name, $actual ) || $actual[$name] !== $reference[$name] ) {
			$migratedAssignments[] = $assignment['source'];
		}
	}
	$custom = customSettingsPreamble();
	$custom .= "\n# Settings migrated from the generated Suite 7 LocalSettings.php.\n";
	$custom .= "# Some may be legacy values; review them after the upgrade.\n";
	$custom .= "# Review the backup for custom executable PHP above the old generated marker.\n";
	if ( $migratedAssignments !== [] ) {
		$custom .= "\n" . implode( "\n\n", $migratedAssignments ) . "\n";
	}
	if ( trim( $customTail ) !== '' ) {
		$custom .= "\n# Custom configuration preserved from below the old generated marker.\n";
		$custom .= ltrim( $customTail );
	}
	atomicWrite( $customPath, $custom );
	if ( !rename( $instanceTemporaryPath, $instancePath ) ) {
		fail( "Could not install $instancePath." );
	}
	chmod( $instancePath, 0644 );
}

function installStagedFile( string $sourcePath, string $destinationPath ): void {
	$contents = file_get_contents( $sourcePath );
	if ( $contents === false ) {
		fail( "Could not read staged configuration $sourcePath." );
	}
	atomicWrite( $destinationPath, $contents );
}

$command = $argv[1] ?? '';
switch ( $command ) {
	case 'stage-instance-settings':
		if ( count( $argv ) !== 5 ) {
			fail( 'Usage: MigrateConfiguration.php stage-instance-settings LEGACY ACTUAL_JSON INSTANCE' );
		}
		stageInstanceSettings( $argv[2], $argv[3], $argv[4] );
		break;
	case 'write-loadable-legacy-config':
		if ( count( $argv ) !== 4 ) {
			fail( 'Usage: MigrateConfiguration.php write-loadable-legacy-config LEGACY OUTPUT' );
		}
		writeLoadableLegacyConfiguration( $argv[2], $argv[3] );
		break;
	case 'stage-migrated-configuration':
		if ( count( $argv ) !== 8 ) {
			fail( 'Usage: MigrateConfiguration.php stage-migrated-configuration LEGACY ACTUAL_JSON REFERENCE_JSON CUSTOM INSTANCE_TEMP INSTANCE' );
		}
		stageMigratedConfiguration( $argv[2], $argv[3], $argv[4], $argv[5], $argv[6], $argv[7] );
		break;
	case 'install':
		if ( count( $argv ) !== 4 ) {
			fail( 'Usage: MigrateConfiguration.php install SOURCE DESTINATION' );
		}
		installStagedFile( $argv[2], $argv[3] );
		break;
	default:
		fail( 'Expected stage-instance-settings, write-loadable-legacy-config, stage-migrated-configuration, or install.' );
}
