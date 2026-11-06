import { Launcher } from '@wdio/cli';
import logger from '@wdio/logger';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import process from 'node:process';
import type { WdioOptions } from '../../commands/test/integration.js';
import type { RepositoryContext } from '../../lib/context.js';
import { defaultSettings } from '../_setup/make-test-settings.js';
import TestEnv from '../_setup/test-env.js';

async function runCommand(
	command: string,
	args: string[],
	cwd: string,
	env: NodeJS.ProcessEnv = process.env
): Promise<number> {
	return new Promise<number>((resolve, reject) => {
		const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
		child.once('error', reject);
		child.once('exit', (code, signal) => {
			if (signal) {
				reject(new Error(`${command} stopped by ${signal}.`));
			} else {
				resolve(code ?? 1);
			}
		});
	});
}

async function requireSuccess(
	command: string,
	args: string[],
	cwd: string
): Promise<void> {
	const exitCode = await runCommand(command, args, cwd);
	if (exitCode) {
		throw new Error(`${command} exited with status ${exitCode}.`);
	}
}

export const testEnv = TestEnv.create({
	...defaultSettings,
	name: 'wikibase-core',
	maxInstances: 1,
	specs: [],
	composeFiles: [
		...(defaultSettings.composeFiles ?? []),
		'wikibase-core/docker-compose.override.yml'
	]
});

// The pinned Wikibase checkout provides the specs and WDIO config. Their Node
// imports resolve from the wbs-dev dependency tree above this temporary source.
export async function run(
	context: RepositoryContext,
	options: WdioOptions
): Promise<number> {
	let sourceDir: string | undefined;
	const previousEnv = {
		MW_SERVER: process.env.MW_SERVER,
		MW_SCRIPT_PATH: process.env.MW_SCRIPT_PATH,
		MEDIAWIKI_USER: process.env.MEDIAWIKI_USER,
		MEDIAWIKI_PASSWORD: process.env.MEDIAWIKI_PASSWORD,
		LOG_DIR: process.env.LOG_DIR
	};
	try {
		await testEnv.up();
		const containerId = (
			await testEnv.runDockerComposeCmd('ps -q wikibase')
		).trim();
		if (!containerId) {
			throw new Error('The Wikibase test container did not start.');
		}

		const sourceRoot = join(context.testRoot, 'wikibase-core/tmp');
		const resultsDir = join(context.testRoot, 'wikibase-core/results');
		mkdirSync(sourceRoot, { recursive: true });
		sourceDir = mkdtempSync(join(sourceRoot, 'source-'));
		mkdirSync(resultsDir, { recursive: true });
		await requireSuccess(
			'docker',
			['cp', `${containerId}:/var/www/html/extensions/Wikibase/.`, sourceDir],
			context.testRoot
		);
		process.env.MW_SERVER = testEnv.vars.WIKIBASE_URL;
		process.env.MW_SCRIPT_PATH = testEnv.vars.MW_SCRIPT_PATH;
		process.env.MEDIAWIKI_USER = testEnv.vars.MW_ADMIN_NAME;
		process.env.MEDIAWIKI_PASSWORD = testEnv.vars.MW_ADMIN_PASS;
		process.env.LOG_DIR = resultsDir;
		const fromSource = (path: string): string =>
			isAbsolute(path) ? path : join(sourceDir, path);
		logger.clearLogger();
		const browserExitCode = await new Launcher(
			join(sourceDir, 'repo/tests/selenium/wdio.conf.js'),
			{
				hostname: 'browser',
				port: 4444,
				path: '/wd/hub',
				maxInstances: 1,
				specFileRetries: 0,
				outputDir: resultsDir,
				...(testEnv.settings.runHeaded ? { headless: false } : {}),
				...options,
				...(options.spec ? { spec: options.spec.map(fromSource) } : {}),
				...(options.exclude ? { exclude: options.exclude.map(fromSource) } : {})
			}
		).run();
		if (options.spec?.length) {
			return browserExitCode;
		}

		console.log('Running the pinned Wikibase PHPUnit suite...');
		await requireSuccess(
			'docker',
			[
				'exec',
				'-u',
				'root',
				'-w',
				'/var/www/html',
				containerId,
				'php',
				'tests/phpunit/generatePHPUnitConfig.php'
			],
			context.testRoot
		);
		const phpExitCode = await runCommand(
			'docker',
			[
				'exec',
				'-u',
				'root',
				'-w',
				'/var/www/html',
				containerId,
				'php',
				'vendor/bin/phpunit',
				'--bootstrap',
				'/test-settings/phpunit-bootstrap.php',
				'--group',
				'Wikibase',
				'extensions/Wikibase',
				'--colors=never',
				'--log-junit',
				'/var/log/mediawiki/phpunit.xml'
			],
			context.testRoot
		);
		return browserExitCode || phpExitCode;
	} finally {
		for (const [name, value] of Object.entries(previousEnv)) {
			if (value === undefined) {
				delete process.env[name];
			} else {
				process.env[name] = value;
			}
		}
		try {
			await testEnv.down();
		} finally {
			if (sourceDir) {
				try {
					rmSync(sourceDir, {
						recursive: true,
						force: true,
						maxRetries: 10,
						retryDelay: 1000
					});
				} catch (error) {
					console.warn(`Could not remove temporary Wikibase source: ${error}`);
				}
			}
		}
	}
}
