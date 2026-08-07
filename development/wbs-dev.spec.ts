import { describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { resolve } from 'node:path';

const CLI = resolve('wbs-dev.ts');
const TSX = resolve('node_modules/.bin/tsx');

function cli(...args: string[]): SpawnSyncReturns<string> {
	return spawnSync(TSX, [CLI, ...args], {
		cwd: process.cwd(),
		encoding: 'utf8'
	});
}

describe('wbs-dev command contracts', () => {
	it('owns test options in the top-level command', () => {
		const result = cli('test', '--help');
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /--headed/u);
		assert.match(
			result.stdout,
			/wbs-dev-tools \(fast development-tooling tests\)/u
		);
	});

	it('exposes browser installer development', () => {
		const web = cli('installer-dev', 'web', '--help');
		assert.equal(web.status, 0, web.stderr);
		assert.match(web.stdout, /--mock/u);
	});

	it('exposes one combined update workflow', () => {
		const update = cli('update', '--help');
		assert.equal(update.status, 0, update.stderr);
		assert.match(
			update.stdout,
			/sources, versions, and changelogs atomically/u
		);

		const root = cli('--help');
		assert.equal(root.status, 0, root.stderr);
		assert.match(root.stdout, /^\s{2}update <projects\.\.\.>/mu);
		assert.doesNotMatch(root.stdout, /update-(?:sources|versions)/u);
	});

	it('rejects integration options for the wbs-dev-tools target', () => {
		const result = cli('test', 'wbs-dev-tools', '--headed');
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /does not accept integration options/u);
	});
});
