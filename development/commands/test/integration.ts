import { Launcher, type RunCommandArguments } from '@wdio/cli';
import logger from '@wdio/logger';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import type { RepositoryContext } from '../../lib/context.js';
import { printSuiteHeading } from './output.js';
import { discoverSuiteNames, suiteConfigPath } from './suites.js';

type WdioOptions = Partial<RunCommandArguments> & {
	repeat?: number;
	coverage?: boolean;
};

export interface TestOptions extends WdioOptions {
	debug?: boolean;
	headed?: boolean;
	nodeDebug?: boolean;
	setup?: boolean;
	skipBuild?: boolean;
}

function prepareWdioOptions( options: TestOptions ): WdioOptions {
	const { debug, headed, nodeDebug } = options;
	const wdioOptions = { ...options } as TestOptions & { reporter?: string[] };
	const reporter = wdioOptions.reporter;
	delete wdioOptions.debug;
	delete wdioOptions.headed;
	delete wdioOptions.nodeDebug;
	delete wdioOptions.reporter;
	delete wdioOptions.setup;
	delete wdioOptions.skipBuild;

	if ( headed ) {
		process.env.WBS_TEST_HEADED = 'true';
	}
	if ( debug || nodeDebug ) {
		process.env.DEBUG = nodeDebug ? 'node' : 'true';
	}

	if ( reporter && reporter.length ) {
		wdioOptions.reporters = reporter;
	}

	for ( const key of Object.keys( wdioOptions ) as ( keyof typeof wdioOptions )[] ) {
		const value = wdioOptions[ key ];
		if ( Array.isArray( value ) && value.length === 0 ) {
			delete wdioOptions[ key ];
		}
	}

	return wdioOptions;
}

async function buildImages( context: RepositoryContext ): Promise<void> {
	console.log( '🏗️ Building images...' );
	await new Promise<void>( ( resolveBuild, rejectBuild ) => {
		const child = spawn(
			'pnpm',
			[ 'exec', 'tsx', 'wbs-dev.ts', 'build', '--quiet' ],
			{
				cwd: context.developmentRoot,
				env: process.env,
				stdio: [ 'inherit', 'ignore', 'inherit' ]
			}
		);
		child.once( 'error', rejectBuild );
		child.once( 'exit', ( code, signal ) => {
			if ( signal ) {
				rejectBuild( new Error( `Image builds terminated by signal ${ signal }.` ) );
				return;
			}
			if ( code !== 0 ) {
				rejectBuild( new Error( 'One or more image builds failed.' ) );
				return;
			}
			resolveBuild();
		} );
	} );
}

export async function runIntegrationSuites(
	requestedSuites: string[],
	options: TestOptions,
	context: RepositoryContext
): Promise<void> {
	process.chdir( context.testRoot );
	const allSuiteNames = discoverSuiteNames( context );
	const suiteNames =
		requestedSuites.length === 0 || requestedSuites.includes( 'all' ) ?
			allSuiteNames :
			requestedSuites;

	if ( requestedSuites.includes( 'all' ) && requestedSuites.length > 1 ) {
		throw new Error( '"all" cannot be combined with named suites.' );
	}

	const unknown = suiteNames.filter(
		( suiteName ) => !allSuiteNames.includes( suiteName )
	);
	if ( unknown.length ) {
		throw new Error(
			`Unknown test suite${ unknown.length === 1 ? '' : 's' }: ${ unknown.join( ', ' ) }. ` +
				`Available suites: ${ allSuiteNames.join( ', ' ) }.`
		);
	}

	if ( options.setup && suiteNames.length !== 1 ) {
		throw new Error( '--setup requires exactly one named suite.' );
	}
	if (
		options.setup &&
		( ( options.spec && options.spec.length ) || options.watch )
	) {
		throw new Error( '--setup cannot be combined with --spec or --watch.' );
	}
	if ( options.setup ) {
		if ( !options.skipBuild ) {
			await buildImages( context );
		}
		const configUrl = pathToFileURL(
			suiteConfigPath( context, suiteNames[ 0 ] )
		).href;
		const { testEnv } = ( await import( configUrl ) ) as {
			testEnv: {
				up: () => Promise<void>;
				releaseExitListener: () => void;
			};
		};
		try {
			await testEnv.up();
			printSuiteHeading( suiteNames[ 0 ] );
		} finally {
			testEnv.releaseExitListener();
		}
		return;
	}

	if ( !options.skipBuild ) {
		await buildImages( context );
	}

	if ( suiteNames.length > 1 ) {
		console.log(
			chalk.whiteBright.bold( `\n🎡 Running ${ suiteNames.length } test suites:` ),
			chalk.whiteBright( suiteNames.join( ', ' ) )
		);
	}

	const wdioOptions = prepareWdioOptions( options );
	const passedSuites: string[] = [];
	const failedSuites: string[] = [];
	for ( const suiteName of suiteNames ) {
		const exitCode = await runWdio(
			suiteConfigPath( context, suiteName ),
			wdioOptions
		);
		if ( exitCode === 0 ) {
			passedSuites.push( suiteName );
		} else {
			failedSuites.push( suiteName );
		}
	}

	if ( suiteNames.length > 1 ) {
		console.log( chalk.whiteBright.bold( '\nTest suite results:' ) );
		console.log( chalk.green( `  Passed: ${ passedSuites.join( ', ' ) || 'none' }` ) );
		if ( failedSuites.length ) {
			console.log( chalk.red( `  Failed: ${ failedSuites.join( ', ' ) }` ) );
		}
	}

	if ( failedSuites.length ) {
		throw new Error( 'One or more integration test suites failed.' );
	}
}

async function runWdio(
	configFilePath: string,
	wdioOptions: WdioOptions
): Promise<number> {
	try {
		logger.clearLogger();
		return await new Launcher( configFilePath, wdioOptions ).run();
	} catch ( error ) {
		throw new Error(
			`Failed to start the test suite: ${ error instanceof Error ? error.stack : error }`,
			{ cause: error }
		);
	}
}
