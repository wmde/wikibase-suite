import type { Command } from 'commander';
import type { RepositoryContext } from '../../lib/context.js';
import { discoverImageNames } from '../../lib/projects.js';
import { resolveNames } from '../../lib/selection.js';
import { runTasks } from '../../lib/tasks.js';

interface LintOptions {
	fix?: boolean;
	prettier?: boolean;
}

async function runLint(
	requested: string[],
	options: LintOptions,
	context: RepositoryContext
): Promise<void> {
	if ( options.prettier && !options.fix ) {
		throw new Error( 'lint --prettier requires --fix.' );
	}
	const lintPaths = new Map<string, string>( [
		[ 'root', '.' ],
		[ 'development', 'development' ],
		[ 'test', 'development/tests' ],
		...discoverImageNames( context ).map(
			( image ) => [ image, `docker-images/${ image }` ] as [string, string]
		)
	] );
	const normalized =
		requested.length === 0 || ( requested.length === 1 && requested[ 0 ] === 'all' ) ?
			[ 'root' ] :
			requested;
	const selected = resolveNames( normalized, [ ...lintPaths.keys() ], {
		command: 'lint',
		noun: 'target'
	} );
	if ( selected.includes( 'root' ) && selected.length > 1 ) {
		throw new Error( 'lint: "root" already includes every other lint target.' );
	}
	const optionArgs = [
		...( options.fix ? [ '--fix' ] : [] ),
		...( options.prettier ? [ '--prettier' ] : [] )
	];
	await runTasks(
		selected.map( ( target ) => ( {
			label: `lint ${ target }`,
			command: 'development/commands/lint/run.sh',
			args: [ lintPaths.get( target )!, ...optionArgs ]
		} ) ),
		{ cwd: context.repositoryRoot }
	);
}

export function registerLintCommand(
	program: Command,
	context: RepositoryContext
): void {
	const targets = [
		'root',
		'development',
		'test',
		...discoverImageNames( context )
	];
	program
		.command( 'lint' )
		.description( 'Lint the repository or selected paths.' )
		.argument( '[targets...]', 'root|development|test|IMAGE...|all' )
		.option( '-f, --fix', 'Apply supported automatic fixes.' )
		.option( '--prettier', 'Run Prettier when used with --fix.' )
		.addHelpText(
			'after',
			`\nTargets:\n  ${ targets.join( ', ' ) }\n  With no target or "all", lint the repository root.`
		)
		.action(
			async ( requested: string[], options: LintOptions ) =>
				await runLint( requested, options, context )
		);
}
