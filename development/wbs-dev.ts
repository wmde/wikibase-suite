import { Command } from 'commander';
import process from 'node:process';
import { registerBuildCommand } from './commands/build/command.js';
import { registerInstallerDevCommand } from './commands/installer-dev/command.js';
import { registerLintCommand } from './commands/lint/command.js';
import { registerReleaseCommand } from './commands/release/command.js';
import { registerTestCommand } from './commands/test/command.js';
import { registerUpdateSourcesCommand } from './commands/update-sources/command.js';
import { registerUpdateVersionsCommand } from './commands/update-versions/command.js';
import { createRepositoryContext } from './lib/context.js';

async function main(): Promise<void> {
	const context = createRepositoryContext();
	const program = new Command();
	program
		.name( 'wbs-dev' )
		.description(
			'Build, test, lint, update, and publish Wikibase Suite projects.'
		)
		.showHelpAfterError()
		.showSuggestionAfterError()
		.enablePositionalOptions();

	registerBuildCommand( program, context );
	registerInstallerDevCommand( program, context );
	registerTestCommand( program, context );
	registerLintCommand( program, context );
	registerUpdateSourcesCommand( program, context );
	registerUpdateVersionsCommand( program, context );
	registerReleaseCommand( program, context );

	program.addHelpText(
		'after',
		[
			'',
			'Preparation commands update local, unstaged files for review.',
			'Publication commands validate committed state before creating tags.',
			'',
			'Examples:',
			'  wbs-dev build',
			'  wbs-dev installer-dev web',
			'  wbs-dev test',
			'  wbs-dev lint',
			'  wbs-dev update-sources wikibase quickstatements',
			'  wbs-dev update-versions wikibase wbs',
			'  wbs-dev release all --dry-run'
		].join( '\n' )
	);

	if ( process.argv.length === 2 ) {
		program.help();
	}
	const argv = process.argv.map( ( argument ) =>
		argument === '--debug=node' ? '--node-debug' : argument
	);
	await program.parseAsync( argv );
}

main().catch( ( error ) => {
	console.error( error instanceof Error ? `wbs-dev: ${ error.message }` : error );
	// Fatal command errors have already passed through task and suite cleanup hooks.
	// Exit explicitly so an open third-party handle cannot turn a failure into a hang.
	process.exit( 1 );
} );
