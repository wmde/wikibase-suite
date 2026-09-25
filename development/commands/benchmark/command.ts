import type { Command } from 'commander';
import { join } from 'node:path';
import type { RepositoryContext } from '../../lib/context.js';
import { ProcessCommandRunner } from '../../lib/process.js';

export function registerBenchmarkCommand( program: Command, context: RepositoryContext ): void {
	const benchmark = program.command( 'benchmark' )
		.description( 'Prepare benchmark corpora, measure imports, and collect Suite resources.' )
		.addHelpText( 'after', '\nPerformance workloads and automated capacity sweeps are still in development.' );
	// Use the host-identical checkout mount: nested Docker mounts must resolve on
	// the daemon, while the same paths must remain readable inside WBS DevTools.
	const root = context.hostRepositoryRoot;
	const home = join( root, 'development/commands/benchmark' );
	const runner = new ProcessCommandRunner();
	const env = {
		...process.env,
		WBS_DIR: root,
		WBS_BENCHMARK_PROMETHEUS_URL: process.env.HOST_PWD ? 'http://host.docker.internal:9090' : 'http://localhost:9090',
		WBS_IMPORT_COMMAND: JSON.stringify( [
			process.execPath,
			join( context.developmentRoot, 'node_modules/tsx/dist/cli.mjs' ),
			join( context.imagesRoot, 'wbs-tools/wbs.ts' ), 'import'
		] )
	};
	function python( parent: Command, name: string, description: string, script: string ): void {
		parent.command( name ).description( description )
			.helpOption( false ).allowUnknownOption().allowExcessArguments()
			.action( async ( _options: unknown, command: Command ) => {
				await runner.run( 'python3', [ join( home, script ), ...command.args ], {
					cwd: root, env, output: 'inherit'
				} );
			} );
	}
	const corpus = benchmark.command( 'corpus' ).description( 'Prepare frozen dataset artifacts.' );
	python( corpus, 'prepare', 'Select and materialize a scholarly corpus from a pinned recipe.', 'scripts/prepare_corpus.py' );
	python( corpus, 'profile', 'Profile entity shapes in a dated Wikidata dump.', 'scripts/profile_wikidata_dump.py' );
	python( corpus, 'extract', 'Create a small connected reference corpus.', 'scripts/extract_wikidata_subset.py' );
	python( corpus, 'synthetic', 'Create a deterministic synthetic control corpus.', 'scripts/generate_synthetic_corpus.py' );
	python( benchmark, 'import', 'Measure import throughput from a bundle or corpus recipe.', 'bulk-import/run_import_trial.py' );
	python( benchmark, 'snapshot', 'Record a resource checkpoint on an existing Suite.', 'lib/capture_snapshot.py' );
	const metrics = benchmark.command( 'metrics' ).description( 'Manage optional resource collectors on a Linux Docker host.' );
	for ( const action of [ 'start', 'stop', 'status' ] ) {
		metrics.command( action )
			.option( '--network <name>', 'Target Suite Docker network.', 'wbs-deploy_default' )
			.option( '--port <port>', 'Prometheus host port.', '9090' )
			.action( async ( options: { network: string; port: string } ) => {
				const args = action === 'start' ? [ 'up', '-d' ] : action === 'stop' ? [ 'stop' ] : [ 'ps' ];
				await runner.run( 'docker', [
					'compose', '-f', join( home, 'compose/docker-compose.metrics.yml' ), ...args
				], {
					cwd: root, output: 'inherit',
					env: { ...env, WBS_BENCHMARK_NETWORK: options.network, WBS_BENCHMARK_PROMETHEUS_PORT: options.port }
				} );
			} );
	}
}
