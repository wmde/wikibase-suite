import { Option, type Command } from 'commander';
import { missingConfigurationKeys, up } from '../lib/compose.js';

type UpOptions = {
	update?: boolean;
	build?: boolean;
};

async function startSuite( options: UpOptions ): Promise<void> {
	const missing = missingConfigurationKeys();
	if ( missing.length ) {
		throw new Error(
			`Wikibase Suite is not configured. Run "wbs install" first. Missing: ${ missing.join( ', ' ) }.`
		);
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
