<?php

declare( strict_types=1 );

$registryPath = $argv[1] ?? throw new InvalidArgumentException( 'Registry path is required.' );
$localSourceRoot = $argv[2] ?? null;
$registry = json_decode( (string)file_get_contents( $registryPath ), true, 512, JSON_THROW_ON_ERROR );

foreach ( $registry['extensions'] ?? [] as $extension ) {
	$name = $extension['name'] ?? null;
	$source = $extension['source'] ?? null;
	if ( !is_string( $name ) || !preg_match( '/^[A-Za-z0-9_-]+$/', $name ) ) {
		throw new RuntimeException( 'Every extension must have a valid name.' );
	}
	if ( !is_array( $source ) ) {
		continue;
	}
	if ( isset( $source['path'] ) ) {
		if ( $localSourceRoot === null ) {
			continue;
		}
		if ( !is_string( $source['path'] ) || str_starts_with( $source['path'], '/' ) || str_contains( $source['path'], '..' ) ) {
			throw new RuntimeException( "Local extension $name has an invalid source path." );
		}
		$localSource = "$localSourceRoot/{$source['path']}";
		$target = "extensions/$name";
		if ( !is_dir( $localSource ) ) {
			throw new RuntimeException( "Missing local extension source for $name." );
		}
		passthru( 'rm -rf ' . escapeshellarg( $target ) . ' && cp -a ' . escapeshellarg( $localSource ) . ' ' . escapeshellarg( $target ), $status );
		if ( $status !== 0 ) {
			throw new RuntimeException( "Failed to install local extension $name." );
		}
		continue;
	}
	if ( !isset( $source['repo'] ) ) {
		continue;
	}
	if ( !is_string( $source['repo'] ) || !is_string( $source['ref'] ?? null ) || !is_string( $source['commit'] ?? null ) ) {
		throw new RuntimeException( "Git extension $name must declare repo, ref, and commit." );
	}
	$target = "extensions/$name";
	$commands = [
		"rm -rf " . escapeshellarg( $target ),
		"mkdir -p " . escapeshellarg( $target ),
		"git -C " . escapeshellarg( $target ) . ' init .',
		"git -C " . escapeshellarg( $target ) . ' remote add origin ' . escapeshellarg( $source['repo'] ),
		"git -C " . escapeshellarg( $target ) . ' fetch origin --depth 1 ' . escapeshellarg( $source['commit'] ),
		"git -C " . escapeshellarg( $target ) . ' checkout ' . escapeshellarg( $source['commit'] ),
	];
	foreach ( $commands as $command ) {
		passthru( $command, $status );
		if ( $status !== 0 ) {
			throw new RuntimeException( "Failed to fetch extension $name." );
		}
	}
	foreach ( $source['patches'] ?? [] as $patch ) {
		$patchPath = "/tmp/patches/$patch";
		if ( !is_readable( $patchPath ) ) {
			throw new RuntimeException( "Missing extension patch: $patch" );
		}
		passthru( 'patch -d ' . escapeshellarg( $target ) . ' -Np1 < ' . escapeshellarg( $patchPath ), $status );
		if ( $status !== 0 ) {
			throw new RuntimeException( "Failed to apply extension patch $patch." );
		}
	}
	passthru( 'git -C ' . escapeshellarg( $target ) . ' submodule update --init --recursive --depth 1', $status );
	if ( $status !== 0 ) {
		throw new RuntimeException( "Failed to update submodules for $name." );
	}
	passthru( 'find ' . escapeshellarg( $target ) . " -name '.git*' -exec rm -rf {} +", $status );
	if ( $status !== 0 ) {
		throw new RuntimeException( "Failed to remove Git metadata for $name." );
	}
}
