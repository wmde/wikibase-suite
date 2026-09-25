import type { Command } from 'commander';
import { fileURLToPath } from 'node:url';
import { runProcess } from '../../lib/command-runner.js';

// Python owns the detailed argument contract while these implementations mature.
// build:server copies the runtime assets beside this module in dist/commands/import.
export function registerImportCommand( program: Command ): void {
	const importer = program.command( 'import' )
		.description( 'Prepare and load entity data into a fresh Wikibase (in development).' );
	for ( const [ name, description ] of [
		[ 'prepare', 'Validate entity JSON and create a durable import bundle.' ],
		[ 'load', 'Load or resume a prepared bundle in a fresh, quiescent Suite.' ]
	] ) {
		importer.command( name ).description( description )
			.helpOption( false ).allowUnknownOption().allowExcessArguments()
			.action( async ( _options: unknown, command: Command ) => {
				await runProcess( 'python3', [
					fileURLToPath( new URL( './bulk_import.py', import.meta.url ) ),
					name, ...command.args
				], { env: { ...process.env, WBS_IMPORT_PROG: 'wbs import' } } );
			} );
	}
}
