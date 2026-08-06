import { Option, type Command } from 'commander';
import process from 'node:process';

export type ConfigureOptions = {
	web: boolean;
	local: boolean;
	debug: boolean;
};

export async function configure( options: ConfigureOptions ): Promise<void> {
	if ( process.env.WBS_VALIDATE_OPTIONS === 'true' ) {
		return;
	}
	process.env.LOCALHOST = String( options.local );
	process.env.DEBUG = String( options.debug );
	if ( options.web ) {
		await import( '../web/server.js' );
		return;
	}
	const { configureFromTerminal } = await import( '../cli/configure.js' );
	await configureFromTerminal();
}

export function addConfigureOptions( command: Command ): Command {
	return command
		.addOption( new Option( '--web', 'Use the browser configurator.' ) )
		.addOption( new Option( '--local', 'Use local hostnames without public DNS validation.' ) )
		.addOption( new Option( '--debug', 'Show verbose diagnostic output.' ) );
}

export function registerConfigureCommand( program: Command ): void {
	addConfigureOptions( program.command( 'configure' )
		.description( 'Create or update Wikibase Suite configuration.' ) )
		.action( configure );
}
