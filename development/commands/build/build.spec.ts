import { describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseBuildArguments } from './command.js';

const RUN_IMAGE_BUILD = resolve('commands/build/image.sh');

function dryRun(...buildArguments: string[]): string {
	return execFileSync(
		RUN_IMAGE_BUILD,
		['wikibase', '--dry-run', ...buildArguments],
		{
			cwd: process.cwd(),
			encoding: 'utf8',
			env: {
				...process.env,
				BUILD_CACHE_REGISTRY: 'ghcr.io/example/wikibase',
				BUILD_CACHE_SCOPE: 'linux-amd64',
				BUILD_CACHE_PUSH: 'true'
			}
		}
	).replace(/\\/gu, '');
}

describe('wbs-dev build', () => {
	it('honors an explicit builder instead of selecting or creating the cache builder', () => {
		const directory = mkdtempSync(join(tmpdir(), 'wbs-build-builder-'));
		try {
			const docker = join(directory, 'docker');
			writeFileSync(
				docker,
				`#!${process.execPath}
const args = process.argv.slice(2);
if (args.includes('--list=type=variables,format=json')) {
  console.log(JSON.stringify([{name: 'IMAGE_NAME', value: 'wikibase'}, {name: 'IMAGE_VERSION', value: '1.0.0'}]));
} else if (args[1] === 'bake') {
  console.log(JSON.stringify(args));
} else process.exit(1);
`
			);
			chmodSync(docker, 0o755);
			for (const builder of [
				['--builder', 'my-builder'],
				['--builder=my-builder']
			]) {
				const output = execFileSync(
					RUN_IMAGE_BUILD,
					['wikibase', '--push', ...builder],
					{
						encoding: 'utf8',
						env: {
							...process.env,
							PATH: `${directory}:${process.env.PATH}`,
							BUILD_CACHE_REGISTRY: 'example/cache',
							BUILD_CACHE_SCOPE: 'linux-amd64'
						}
					}
				);
				const args = JSON.parse(output) as string[];
				assert.ok(builder.every((argument) => args.includes(argument)));
				assert.equal(args.includes('wbs-application-builder'), false);
			}
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it('adds the scoped and legacy registry caches', () => {
		const command = dryRun('--push');
		assert.match(
			command,
			/"ref": "ghcr\.io\/example\/wikibase\/wikibase:buildcache-linux-amd64"/u
		);
		assert.match(
			command,
			/"ref": "ghcr\.io\/example\/wikibase\/wikibase:buildcache"/u
		);
		assert.match(
			command,
			/"ref": "ghcr\.io\/example\/wikibase\/wikibase:buildcache-linux-amd64"/u
		);
	});

	it('does not import registry caches for a no-cache build', () => {
		const command = dryRun('--no-cache', '--pull');
		assert.doesNotMatch(command, /"cache-from"/u);
		assert.match(command, /"cache-to"/u);
	});

	it('composes optional multi-platform registry builds', () => {
		const command = dryRun('--push', '--platform=linux/amd64,linux/arm64');
		assert.match(
			command,
			/"platforms": \[\s+"linux\/amd64",\s+"linux\/arm64"\s+\]/u
		);
		assert.match(command, /"type": "registry"/u);
	});

	it('keeps image selection separate from forwarded Buildx arguments', () => {
		assert.deepEqual(
			parseBuildArguments([
				'wikibase',
				'wdqs',
				'--no-cache',
				'--parallel=2',
				'--pull'
			]),
			{
				images: ['wikibase', 'wdqs'],
				forwarded: ['--no-cache', '--pull'],
				parallel: 2
			}
		);
	});

	it('forwards coordinator-looking options after an explicit separator', () => {
		assert.deepEqual(parseBuildArguments(['wikibase', '--', '--parallel=2']), {
			images: ['wikibase'],
			forwarded: ['--parallel=2'],
			parallel: 3
		});
	});

	it('rejects invalid coordinator parallelism', () => {
		assert.throws(
			() => parseBuildArguments(['--parallel=0']),
			/positive integer/u
		);
	});
});
