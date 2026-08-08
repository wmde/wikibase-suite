import { InvalidArgumentError, Option, type Command } from 'commander';
import type { RepositoryContext } from '../../lib/context.js';
import { resolveNames } from '../../lib/selection.js';
import { runTasks } from '../../lib/tasks.js';
import type { TestOptions } from './integration.js';
import { discoverSuiteNames } from './suites.js';

function parseNumber( value: string ): number {
	const parsed = Number( value );
	if ( !Number.isFinite( parsed ) ) {
		throw new InvalidArgumentError( `Expected a number, received "${ value }".` );
	}
	return parsed;
}

function parseShard( value: string ): { current: number; total: number } {
	const match = /^(\d+)\/(\d+)$/u.exec( value );
	if ( !match || Number( match[ 1 ] ) < 1 || Number( match[ 2 ] ) < 1 ) {
		throw new InvalidArgumentError( 'Expected a shard in the form x/y.' );
	}
	return { current: Number( match[ 1 ] ), total: Number( match[ 2 ] ) };
}

function parseJson( value: string ): Record<string, unknown> {
	try {
		return JSON.parse( value ) as Record<string, unknown>;
	} catch ( _error ) {
		throw new InvalidArgumentError( 'Expected a JSON object.' );
	}
}

function collect( value: string, previous: string[] ): string[] {
	return [ ...previous, value ];
}

function addIntegrationOptions( command: Command ): void {
	command
		.option( '--setup', 'Start and leave up one suite without running tests.' )
		.option( '--skip-build', 'Skip the image build performed before suites.' )
		.option( '--headed', 'Run tests in a headed browser.' )
		.option( '-d, --debug', 'Use debugging timeouts.' )
		.option( '--node-debug', 'Use debugging timeouts and the Node inspector.' )
		.option( '--watch', 'Automatically rerun tests when suite files change.' )
		.option( '-H, --hostname <hostname>', 'Automation driver host address.' )
		.option( '-p, --port <port>', 'Automation driver port.', parseNumber )
		.option( '--path <path>', 'Path to WebDriver endpoints.' )
		.option( '-u, --user <user>', 'Cloud service username.' )
		.option( '-k, --key <key>', 'Cloud service access key.' )
		.addOption(
			new Option( '-l, --log-level <level>', 'Logging verbosity.' ).choices( [
				'trace',
				'debug',
				'info',
				'warn',
				'error',
				'silent'
			] )
		)
		.option( '--bail <count>', 'Stop after this many failures.', parseNumber )
		.option( '--base-url <url>', 'Override the configured base URL.' )
		.option( '-w, --waitfor-timeout <ms>', 'waitFor timeout.', parseNumber )
		.option( '-s, --update-snapshots <mode>', 'Snapshot update mode.' )
		.option( '-f, --framework <name>', 'Test framework override.' )
		.option( '-r, --reporter <name>', 'Reporter; repeatable.', collect, [] )
		.option( '--suite <name>', 'Configured WDIO suite; repeatable.', collect, [] )
		.option( '--spec <path>', 'Spec file or glob; repeatable.', collect, [] )
		.option(
			'--exclude <path>',
			'Excluded spec or glob; repeatable.',
			collect,
			[]
		)
		.option( '--repeat <count>', 'Repeat specs or suites.', parseNumber )
		.option( '--mocha-opts <json>', 'Mocha options as JSON.', parseJson )
		.option( '--jasmine-opts <json>', 'Jasmine options as JSON.', parseJson )
		.option( '--cucumber-opts <json>', 'Cucumber options as JSON.', parseJson )
		.option( '--coverage', 'Enable browser-runner coverage.' )
		.option( '--headless', 'Override capabilities to run headlessly.' )
		.option( '--shard <x/y>', 'Run one shard of the selected tests.', parseShard )
		.option( '--ts-config-path <path>', 'TypeScript configuration path.' );
}

function hasIntegrationOptions( options: TestOptions ): boolean {
	return Object.values( options ).some( ( value ) =>
		Array.isArray( value ) ?
			value.length > 0 :
			value !== undefined && value !== false
	);
}

async function runTests(
	requested: string[],
	options: TestOptions,
	context: RepositoryContext
): Promise<void> {
	const suites = discoverSuiteNames( context );
	const selected = resolveNames( requested, [ 'wbs-dev-tools', ...suites ], {
		command: 'test',
		noun: 'target'
	} );
	const includeWbsDevTools = selected.includes( 'wbs-dev-tools' );
	const integrationSuites = selected.filter( ( name ) => name !== 'wbs-dev-tools' );

	if (
		includeWbsDevTools &&
		integrationSuites.length === 0 &&
		hasIntegrationOptions( options )
	) {
		throw new Error(
			'The wbs-dev-tools test target does not accept integration options.'
		);
	}
	if ( includeWbsDevTools ) {
		await runTasks(
			[
				{
					label: 'test wbs-dev tooling',
					command: 'pnpm',
					args: [ 'test:wbs-dev-tools' ]
				}
			],
			{ cwd: context.developmentRoot }
		);
	}
	if ( integrationSuites.length > 0 ) {
		const { runIntegrationSuites } = await import( './integration.js' );
		await runIntegrationSuites( integrationSuites, options, context );
	}
	if ( selected.length > 1 ) {
		console.log( '\n✅ All requested test targets passed.' );
	}
}

export function registerTestCommand(
	program: Command,
	context: RepositoryContext
): void {
	const suites = discoverSuiteNames( context );
	const command = program
		.command( 'test' )
		.description( 'Run wbs-dev tooling tests and integration suites.' )
		.argument( '[targets...]', 'wbs-dev-tools|SUITE...|all' );
	addIntegrationOptions( command );
	command
		.addHelpText(
			'after',
			[
				'',
				'Targets:',
				'  wbs-dev-tools (fast development-tooling tests)',
				`  ${ suites.join( ', ' ) }`,
				'  With no target or "all", test wbs-dev tooling and every integration suite.',
				'',
				'Examples:',
				'  wbs-dev test',
				'  wbs-dev test wbs-dev-tools',
				'  wbs-dev test repo queryservice --headed',
				'  wbs-dev test repo --spec repo/special-new-item.spec.ts',
				'  wbs-dev test repo --setup',
				'  wbs-dev test all --shard 1/2'
			].join( '\n' )
		)
		.action(
			async ( requested: string[], options: TestOptions ) =>
				await runTests( requested, options, context )
		);
}
