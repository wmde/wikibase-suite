import type { Command } from 'commander';
import { status } from '../lib/compose.js';

export function registerStatusCommand( program: Command ): void {
	program.command( 'status' )
		.description( 'Show Wikibase Suite service status.' )
		.action( status );
}
