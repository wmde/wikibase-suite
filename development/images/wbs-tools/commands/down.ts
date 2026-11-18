import type { Command } from 'commander';
import { down } from '../lib/compose.js';

export function registerDownCommand( program: Command ): void {
	program.command( 'down' )
		.description( 'Stop Wikibase Suite while preserving its data.' )
		.action( down );
}
