import { describe, it } from 'mocha';
import assert from 'node:assert/strict';
import type { RepositoryContext } from '../../lib/context.js';
import type {
	CommandRunner,
	CommandRunOptions
} from '../../lib/process.js';
import {
	runInstallerDevWeb,
	type InstallerDevWebDependencies
} from './web.js';

class RecordingRunner implements CommandRunner {
	public calls: {
		command: string;
		args: string[];
		options: CommandRunOptions;
	}[] = [];

	public async run(
		command: string,
		args: string[],
		options: CommandRunOptions
	): Promise<string> {
		this.calls.push( { command, args, options } );
		return '';
	}
}

describe( 'installer-dev web environment', () => {
	it( 'builds local images and launches the real installer flow with live reload', async () => {
		const runner = new RecordingRunner();
		let localBuilds = 0;
		const context: RepositoryContext = {
			developmentRoot: '/container/repo/development',
			hostRepositoryRoot: '/host/repo',
			imagesRoot: '/container/repo/development/images',
			repositoryRoot: '/container/repo',
			testRoot: '/container/repo/development/tests'
		};
		const dependencies: InstallerDevWebDependencies = {
			buildLocalImages: async () => {
				localBuilds++;
			},
			commandRunner: runner
		};

		await runInstallerDevWeb( context, {}, dependencies );

		assert.equal( localBuilds, 1 );
		assert.equal( runner.calls.length, 1 );
		assert.deepEqual( runner.calls[ 0 ].args, [
			'/host/repo/scripts/run-web-installer.sh'
		] );
		const environment = runner.calls[ 0 ].options.env;
		assert.ok( environment );
		assert.equal(
			environment.WBS_DIR,
			'/host/repo'
		);
		assert.equal(
			environment.WBS_DEVELOPMENT_ROOT,
			'/container/repo/development'
		);
		assert.equal(
			environment.ENV_FILE_PATH,
			'/host/repo/.env'
		);
		assert.equal( environment.INSTALLER_DEV, 'true' );
		assert.equal( environment.INSTALLER_DEV_MOCK, 'false' );
		assert.equal( environment.LOCALHOST, 'true' );
		assert.equal(
			environment.WBS_LAUNCH_FOREGROUND,
			'true'
		);
		assert.equal( environment.WBS_LOCAL_IMAGES, 'true' );
	} );

	it( 'uses the development workspace for the side-effect-free mock flow', async () => {
		const runner = new RecordingRunner();
		let localBuilds = 0;
		const context: RepositoryContext = {
			developmentRoot: '/container/repo/development',
			hostRepositoryRoot: '/host/repo',
			imagesRoot: '/container/repo/development/images',
			repositoryRoot: '/container/repo',
			testRoot: '/container/repo/development/tests'
		};
		const dependencies: InstallerDevWebDependencies = {
			buildLocalImages: async () => {
				localBuilds++;
			},
			commandRunner: runner
		};

		await runInstallerDevWeb( context, { mock: 'failure' }, dependencies );

		assert.equal( localBuilds, 0 );
		assert.equal( runner.calls.length, 1 );
		const environment = runner.calls[ 0 ].options.env;
		assert.ok( environment );
		assert.equal( environment.INSTALLER_DEV_MOCK, 'true' );
		assert.equal( environment.INSTALLER_DEV_MOCK_OUTCOME, 'failure' );
	} );
} );
