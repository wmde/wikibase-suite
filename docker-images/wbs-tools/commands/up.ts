import { Option, type Command } from 'commander';
import process from 'node:process';
import { missingConfigurationKeys, up } from '../lib/compose.js';
import { configure } from './configure.js';

type UpOptions = {
	update?: boolean;
	build?: boolean;
};

async function startSuite( options: UpOptions ): Promise<void> {
	const missing = missingConfigurationKeys();
	if ( missing.length ) {
		if ( !process.stdin.isTTY ) {
			throw new Error( `Suite configuration is incomplete. Missing: ${ missing.join( ', ' ) }.` );
		}
		console.log( 'Suite configuration is incomplete; resuming configuration.' );
		await configure( {
			web: false,
			local: options.build === true,
			debug: false
		} );
	}
	await up( options );
}

export function registerUpCommand( program: Command ): void {
	program.command( 'up' )
		.description( 'Start the configured Wikibase Suite.' )
		.addOption( new Option( '--update', 'Pull selected images before starting.' ) )
		.addOption( new Option( '--build', 'Build and select images from this checkout.' ) )
		.action( startSuite );
}
