import { describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
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
	it('keeps latest out of the Wikibase release tags', () => {
		const bake = JSON.parse(dryRun('--publish')) as {
			target: Record<string, { tags: string[] }>;
		};
		const tags = bake.target['wikibase-release'].tags;
		assert.ok(
			tags.some((tag) => /^wikibase\/wikibase:\d+\.\d+\.\d+$/u.test(tag))
		);
		assert.ok(!tags.includes('wikibase/wikibase:latest'));
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
