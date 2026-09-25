import { Command } from 'commander';
import process from 'node:process';
import { registerDownCommand } from './commands/down.js';
import { registerInstallCommand } from './commands/install.js';
import { registerImportCommand } from './commands/import/command.js';
import { registerResetCommand } from './commands/reset.js';
import { registerStatusCommand } from './commands/status.js';
import { registerUpCommand } from './commands/up.js';
import { versionText } from './lib/version.js';
import { captureProcessOutputInWbsLog } from './lib/wbs-log.js';

async function main(): Promise<void> {
	captureProcessOutputInWbsLog();
	const program = new Command();
	program
		.name( 'wbs' )
		.description( 'Install and operate Wikibase Suite.' )
		.version( versionText(), '-v, --version', 'Show Wikibase Suite and WBS Tools versions.' )
		.showHelpAfterError()
		.showSuggestionAfterError();

	registerInstallCommand( program );
	registerImportCommand( program );
	registerUpCommand( program );
	registerDownCommand( program );
	registerStatusCommand( program );
	registerResetCommand( program );

	if ( process.argv.length === 2 ) {
		program.help();
	}
	await program.parseAsync( process.argv );
}

void main().catch( ( error ) => {
	console.error( error instanceof Error ? `wbs: ${ error.message }` : error );
	process.exitCode = 1;
} );
