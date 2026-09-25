import { describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const development = process.cwd();
const tsx = resolve( 'node_modules/.bin/tsx' );
function cli( file: string, ...args: string[] ) {
	return spawnSync( tsx, [ resolve( file ), ...args ], {
		cwd: development, encoding: 'utf8',
		env: { ...process.env, WBS_LOG_PATH: '', HOST_PWD: resolve( '..' ) }
	} );
}

describe( 'benchmark and import command boundaries', () => {
	it( 'shows separate corpus, import and collection commands', () => {
		const result = cli( 'wbs-dev.ts', 'benchmark', '--help' );
		assert.equal( result.status, 0, result.stderr );
		for ( const name of [ 'corpus', 'import', 'metrics', 'snapshot' ] ) {
			assert.ok( result.stdout.includes( name ) );
		}
		assert.doesNotMatch( result.stdout, /run-capacity/u );
	} );

	it( 'delegates help and rejects unknown importer flags without Docker', () => {
		const help = cli( 'wbs-dev.ts', 'benchmark', 'import', '--help' );
		assert.equal( help.status, 0, help.stderr );
		assert.match( help.stdout, /--recipe/u );
		assert.match( help.stdout, /--save-mode/u );
		const bad = cli( 'images/wbs-tools/wbs.ts', 'import', 'load', '--bogus' );
		assert.notEqual( bad.status, 0 );
	} );

	it( 'prepares a real generic bundle through the WBS command', () => {
		const directory = mkdtempSync( join( tmpdir(), 'wbs-import-command-' ) );
		try {
			const source = join( directory, 'entities with spaces.ndjson' );
			const bundle = join( directory, 'bundle' );
			writeFileSync( source, '{"id":"Q1","type":"item"}\n' );
			const result = cli( 'images/wbs-tools/wbs.ts', 'import', 'prepare', '--input', source, '--output', bundle );
			assert.equal( result.status, 0, result.stderr );
			const manifest = JSON.parse( readFileSync( join( bundle, 'manifest.json' ), 'utf8' ) );
			assert.equal( manifest.format, 'wbs-bulk-import/v1' );
			assert.equal( manifest.counts.item, 1 );
			const repeat = cli( 'images/wbs-tools/wbs.ts', 'import', 'prepare', '--input', source, '--output', bundle );
			assert.notEqual( repeat.status, 0 );
		} finally {
			rmSync( directory, { recursive: true, force: true } );
		}
	} );
} );
