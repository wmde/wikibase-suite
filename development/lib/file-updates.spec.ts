import { describe, it } from 'mocha';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyFileUpdates } from './file-updates.js';

describe('release file updates', () => {
	it('preserves executable and private file permissions despite the process umask', () => {
		const root = fs.mkdtempSync(join(tmpdir(), 'wbs-file-updates-'));
		const originalUmask = process.umask();
		try {
			const executable = join(root, 'install');
			const privateFile = join(root, 'private');
			fs.writeFileSync(executable, 'old');
			fs.chmodSync(executable, 0o755);
			fs.writeFileSync(privateFile, 'old', { mode: 0o600 });
			process.umask(0o077);
			applyFileUpdates([
				{ path: executable, contents: 'new' },
				{ path: privateFile, contents: 'new' }
			]);
			assert.equal(fs.statSync(executable).mode & 0o777, 0o755);
			assert.equal(fs.statSync(privateFile).mode & 0o777, 0o600);
		} finally {
			process.umask(originalUmask);
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('restores contents and permissions when a later replacement fails', () => {
		const root = fs.mkdtempSync(join(tmpdir(), 'wbs-file-rollback-'));
		const rename = fs.renameSync;
		try {
			const first = join(root, 'install');
			const second = join(root, 'manifest');
			fs.writeFileSync(first, 'original', { mode: 0o755 });
			fs.writeFileSync(second, 'original');
			fs.renameSync = (source, destination) => {
				if (destination === second)
					throw new Error('simulated replacement failure');
				rename(source, destination);
			};
			syncBuiltinESMExports();
			assert.throws(
				() =>
					applyFileUpdates([
						{ path: first, contents: 'updated' },
						{ path: second, contents: 'updated' }
					]),
				/simulated replacement failure/u
			);
			assert.equal(fs.readFileSync(first, 'utf8'), 'original');
			assert.equal(fs.statSync(first).mode & 0o777, 0o755);
			assert.equal(fs.readFileSync(second, 'utf8'), 'original');
			assert.deepEqual(fs.readdirSync(root).sort(), ['install', 'manifest']);
		} finally {
			fs.renameSync = rename;
			syncBuiltinESMExports();
			fs.rmSync(root, { recursive: true, force: true });
		}
	});
});
