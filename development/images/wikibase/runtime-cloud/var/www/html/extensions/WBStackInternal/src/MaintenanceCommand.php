<?php

namespace WBStack\Internal;

final class MaintenanceCommand {
	/**
	 * @param string[] $arguments
	 * @return array{return:int,output:string[]}
	 */
	public static function run(
		string $script,
		array $arguments = [],
		bool $captureStderr = false
	): array {
		$installPath = defined( 'MW_INSTALL_PATH' )
			? MW_INSTALL_PATH
			: dirname( __DIR__, 3 );
		$command = [
			'env',
			'WBS_DOMAIN=' . Instance::domain(),
			'php',
			$installPath . '/' . ltrim( $script, '/' ),
			...$arguments,
		];
		$escapedCommand = implode( ' ', array_map( 'escapeshellarg', $command ) );
		if ( $captureStderr ) {
			$escapedCommand .= ' 2>&1';
		}

		$output = [];
		$returnCode = 0;
		exec( $escapedCommand, $output, $returnCode );

		return [
			'return' => $returnCode,
			'output' => $output,
		];
	}
}

