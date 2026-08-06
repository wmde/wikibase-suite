import { Command } from 'commander';
import process from 'node:process';
import { registerConfigureCommand } from './commands/configure.js';
import { registerDownCommand } from './commands/down.js';
import { registerInstallCommand } from './commands/install.js';
import { registerPrepareCommand } from './commands/prepare.js';
import { registerResetCommand } from './commands/reset.js';
import { registerStatusCommand } from './commands/status.js';
import { registerUpCommand } from './commands/up.js';

async function main(): Promise<void> {
	const program = new Command();
	program
		.name( 'wbs' )
		.description( 'Install and operate Wikibase Suite.' )
		.showHelpAfterError()
		.showSuggestionAfterError();

	registerConfigureCommand( program );
	registerInstallCommand( program );
	registerPrepareCommand( program );
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
