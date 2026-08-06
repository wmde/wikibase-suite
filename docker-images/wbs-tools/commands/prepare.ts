import type { Command } from 'commander';
import { prepareRepository } from '../lib/repository.js';

export function registerPrepareCommand( program: Command ): void {
	program.command( 'prepare' )
		.description( 'Clone a Wikibase Suite release into a host-mounted directory.' )
		.requiredOption( '--target <path>' )
		.option( '--repository <url>', 'WBS Git repository.', 'https://github.com/wmde/wikibase-suite.git' )
		.option( '--ref <ref>', 'Branch or release tag.' )
		.action( prepareRepository );
}
