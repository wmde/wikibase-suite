import { afterEach, describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { replaceVariable } from '../update-sources/shared.js';

const CLI = resolve( 'wbs-dev.ts' );
const TSX = resolve( 'node_modules/.bin/tsx' );
const fixtures: string[] = [];

interface Fixture {
	root: string;
	development: string;
	remote: string;
}

interface CliResult {
	status: number | null;
	stdout: string;
	stderr: string;
}

function run( command: string, args: string[], cwd: string ): string {
	return execFileSync( command, args, { cwd, encoding: 'utf8' } );
}

function git( fixture: Fixture, ...args: string[] ): string {
	return run( 'git', args, fixture.root ).trim();
}

function write( fixture: Fixture, relativePath: string, contents: string ): void {
	const path = join( fixture.root, relativePath );
	mkdirSync( dirname( path ), { recursive: true } );
	writeFileSync( path, contents );
}

function commitAll( fixture: Fixture, message: string ): void {
	git( fixture, 'add', '.' );
	git( fixture, 'commit', '-m', message );
}

function createFixture(): Fixture {
	const parent = mkdtempSync( join( tmpdir(), 'wbs-dev-release-' ) );
	fixtures.push( parent );
	const remote = join( parent, 'origin.git' );
	const root = join( parent, 'checkout' );
	run( 'git', [ 'init', '--bare', '--initial-branch=main', remote ], parent );
	run( 'git', [ 'init', '--initial-branch=main', root ], parent );
	const fixture = { root, development: join( root, 'development' ), remote };
	git( fixture, 'config', 'user.name', 'Test Operator' );
	git( fixture, 'config', 'user.email', 'test@example.test' );
	git( fixture, 'remote', 'add', 'origin', remote );
	write( fixture, 'development/images/wikibase/Dockerfile', 'FROM scratch\n' );
	write(
		fixture,
		'development/images/wikibase/package.json',
		'{\n\t"name": "wikibase",\n\t"version": "1.0.0"\n}\n'
	);
	write(
		fixture,
		'development/images/wikibase/CHANGELOG.md',
		'# 1.0.0 (2026-01-01)\n\n- Initial release.\n'
	);
	write(
		fixture,
		'development/images/wikibase/build.env',
		'WIKIBASE_COMMIT=aaa\n'
	);
	write(
		fixture,
		'package.json',
		'{\n\t"name": "wbs",\n\t"version": "1.0.0",\n\t"private": true\n}\n'
	);
	write(
		fixture,
		'CHANGELOG.md',
		'# 1.0.0 (2026-01-01)\n\n- Initial release.\n'
	);
	write(
		fixture,
		'docker-compose.yml',
		'services:\n  wikibase:\n    environment:\n      DEPLOY_VERSION: "1.0.0"\n'
	);
	commitAll( fixture, 'chore: initial release' );
	git( fixture, 'tag', 'wikibase@1.0.0' );
	git( fixture, 'tag', 'deploy@1.0.0' );
	git( fixture, 'push', '-u', 'origin', 'main', '--tags' );
	return fixture;
}

function cli( fixture: Fixture, ...args: string[] ): CliResult {
	const result = spawnSync( TSX, [ CLI, ...args ], {
		cwd: fixture.development,
		encoding: 'utf8'
	} );
	return {
		status: result.status,
		stdout: result.stdout,
		stderr: result.stderr
	};
}

describe( 'wbs-dev preparation and release workflow', () => {
	afterEach( () => {
		for ( const fixture of fixtures ) {
			rmSync( fixture, { recursive: true, force: true } );
		}
		fixtures.length = 0;
	} );

	describe( 'release preparation', () => {
		it( 'updates only the exact requested source variable', () => {
			assert.equal(
				replaceVariable(
					'OAUTH_COMMIT=aaa\nWSOAUTH_COMMIT=bbb\n',
					'OAUTH_COMMIT',
					'ccc'
				),
				'OAUTH_COMMIT=ccc\nWSOAUTH_COMMIT=bbb\n'
			);
		} );

		it( 'infers a minor version and generates a flat changelog entry', () => {
			const fixture = createFixture();
			write(
				fixture,
				'development/images/wikibase/feature.txt',
				'new behavior\n'
			);
			commitAll( fixture, 'feat(wikibase): add useful behavior' );
			git( fixture, 'tag', '--force', 'wikibase@1.0.0', 'HEAD' );
			git( fixture, 'tag', 'wikibase@99.0.0' );
			const result = cli( fixture, 'update-versions', 'wikibase' );
			assert.equal( result.status, 0, result.stderr );
			assert.equal(
				JSON.parse(
					readFileSync(
						join( fixture.root, 'development/images/wikibase/package.json' ),
						'utf8'
					)
				).version,
				'1.1.0'
			);
			assert.match(
				readFileSync(
					join( fixture.root, 'development/images/wikibase/CHANGELOG.md' ),
					'utf8'
				),
				/^# 1\.1\.0 \(\d{4}-\d{2}-\d{2}\)\n\n- feat\(wikibase\): add useful behavior/u
			);
			assert.equal( git( fixture, 'diff', '--cached', '--name-only' ), '' );
			const rerun = cli( fixture, 'update-versions', 'wikibase' );
			assert.equal( rerun.status, 0, rerun.stderr );
			assert.equal(
				JSON.parse(
					readFileSync(
						join( fixture.root, 'development/images/wikibase/package.json' ),
						'utf8'
					)
				).version,
				'1.1.0'
			);
		} );

		it( 'preserves a manually written untagged draft and its higher version floor', () => {
			const fixture = createFixture();
			write(
				fixture,
				'development/images/wikibase/feature.txt',
				'new behavior\n'
			);
			write(
				fixture,
				'development/images/wikibase/package.json',
				'{\n\t"name": "wikibase",\n\t"version": "1.2.0"\n}\n'
			);
			write(
				fixture,
				'development/images/wikibase/CHANGELOG.md',
				'# Unreleased\n\nA carefully edited explanation.\n\n# 1.0.0 (2026-01-01)\n\n- Initial release.\n'
			);
			commitAll( fixture, 'feat(wikibase): draft a larger release' );
			const result = cli( fixture, 'update-versions', 'wikibase' );
			assert.equal( result.status, 0, result.stderr );
			const changelog = readFileSync(
				join( fixture.root, 'development/images/wikibase/CHANGELOG.md' ),
				'utf8'
			);
			assert.match( changelog, /^# 1\.2\.0 \(\d{4}-\d{2}-\d{2}\)/u );
			assert.match( changelog, /A carefully edited explanation\./u );
		} );

		it( 'treats uncommitted source updates as a local patch release', () => {
			const fixture = createFixture();
			write(
				fixture,
				'development/images/wikibase/build.env',
				'WIKIBASE_COMMIT=bbb\n'
			);
			const result = cli( fixture, 'update-versions', 'wikibase' );
			assert.equal( result.status, 0, result.stderr );
			assert.match(
				result.stdout,
				/Preparing wikibase 1\.0\.1 \(patch release\)/u
			);
			assert.equal(
				JSON.parse(
					readFileSync(
						join( fixture.root, 'development/images/wikibase/package.json' ),
						'utf8'
					)
				).version,
				'1.0.1'
			);
			assert.match(
				result.stdout,
				/Nothing was staged, committed, tagged, or pushed/u
			);
			assert.equal( git( fixture, 'diff', '--cached', '--name-only' ), '' );
		} );

		it( 'reserves dry runs for release commands', () => {
			const fixture = createFixture();
			const versions = cli( fixture, 'update-versions', 'wikibase', '--dry-run' );
			assert.notEqual( versions.status, 0 );
			assert.match( versions.stderr, /unknown option '--dry-run'/u );

			const sources = cli( fixture, 'update-sources', 'wikibase', '--dry-run' );
			assert.notEqual( sources.status, 0 );
			assert.match( sources.stderr, /unknown option '--dry-run'/u );
		} );

		it( 'uses legacy deploy tags for WBS and keeps DEPLOY_VERSION aligned', () => {
			const fixture = createFixture();
			write( fixture, 'install', '#!/usr/bin/env bash\necho changed\n' );
			commitAll( fixture, 'feat!: replace the WBS installation contract' );
			const result = cli( fixture, 'update-versions', 'wbs' );
			assert.equal( result.status, 0, result.stderr );
			assert.equal(
				JSON.parse( readFileSync( join( fixture.root, 'package.json' ), 'utf8' ) )
					.version,
				'2.0.0'
			);
			assert.match(
				readFileSync( join( fixture.root, 'docker-compose.yml' ), 'utf8' ),
				/DEPLOY_VERSION: "2\.0\.0"/u
			);
		} );

		it( 'does not treat a generated WBS deploy version as a release change', () => {
			const fixture = createFixture();
			write(
				fixture,
				'docker-compose.yml',
				'services:\n  wikibase:\n    environment:\n      DEPLOY_VERSION: "2.0.0"\n'
			);
			const result = cli( fixture, 'update-versions', 'wbs' );
			assert.equal( result.status, 0, result.stderr );
			assert.match(
				result.stdout,
				/No selected projects have releasable changes\./u
			);
			assert.equal(
				JSON.parse(
					readFileSync( join( fixture.root, 'package.json' ), 'utf8' )
				).version,
				'1.0.0'
			);
		} );

		it( 'rejects ambiguous drafts before writing any release files', () => {
			const fixture = createFixture();
			write(
				fixture,
				'development/images/wikibase/CHANGELOG.md',
				'# 1.2.0\n\n- First draft.\n\n# 1.1.0\n\n- Second draft.\n\n# 1.0.0\n\n- Initial.\n'
			);
			commitAll( fixture, 'feat(wikibase): ambiguous release notes' );
			const packageBefore = readFileSync(
				join( fixture.root, 'development/images/wikibase/package.json' ),
				'utf8'
			);
			const changelogBefore = readFileSync(
				join( fixture.root, 'development/images/wikibase/CHANGELOG.md' ),
				'utf8'
			);
			const result = cli( fixture, 'update-versions', 'wikibase' );
			assert.notEqual( result.status, 0 );
			assert.match( result.stderr, /multiple untagged release entries/u );
			assert.equal(
				readFileSync(
					join( fixture.root, 'development/images/wikibase/package.json' ),
					'utf8'
				),
				packageBefore
			);
			assert.equal(
				readFileSync(
					join( fixture.root, 'development/images/wikibase/CHANGELOG.md' ),
					'utf8'
				),
				changelogBefore
			);
		} );

		it( 'plans every selected project before writing any of them', () => {
			const fixture = createFixture();
			write(
				fixture,
				'development/images/wikibase/feature.txt',
				'new behavior\n'
			);
			write(
				fixture,
				'CHANGELOG.md',
				'# 1.2.0\n\n- First draft.\n\n# 1.1.0\n\n- Second draft.\n\n# 1.0.0\n\n- Initial.\n'
			);
			commitAll( fixture, 'feat(wikibase): prepare an atomic release' );
			const packagePath = join(
				fixture.root,
				'development/images/wikibase/package.json'
			);
			const before = readFileSync( packagePath, 'utf8' );
			const result = cli( fixture, 'update-versions', 'wikibase', 'wbs' );
			assert.notEqual( result.status, 0 );
			assert.equal( readFileSync( packagePath, 'utf8' ), before );
		} );
	} );

	describe( 'release publication', () => {
		it( 'creates and pushes a missing image tag, and is rerunnable', () => {
			const fixture = createFixture();
			write(
				fixture,
				'development/images/wikibase/package.json',
				'{\n\t"name": "wikibase",\n\t"version": "1.0.1"\n}\n'
			);
			write(
				fixture,
				'development/images/wikibase/CHANGELOG.md',
				'# 1.0.1 (2026-01-02)\n\n- Fix.\n\n# 1.0.0 (2026-01-01)\n\n- Initial.\n'
			);
			commitAll( fixture, 'fix(wikibase): correct behavior' );
			git( fixture, 'push', 'origin', 'main' );
			git( fixture, 'tag', 'wikibase@1.0.1', 'wikibase@1.0.0' );
			const first = cli( fixture, 'release', 'images', 'wikibase' );
			assert.equal( first.status, 0, first.stderr );
			assert.match(
				run(
					'git',
					[ '--git-dir', fixture.remote, 'tag', '--list' ],
					fixture.root
				),
				/wikibase@1\.0\.1/u
			);
			assert.equal(
				run(
					'git',
					[
						'--git-dir',
						fixture.remote,
						'rev-parse',
						'refs/tags/wikibase@1.0.1'
					],
					fixture.root
				).trim(),
				git( fixture, 'rev-parse', 'HEAD' )
			);
			const second = cli( fixture, 'release', 'images', 'wikibase' );
			assert.equal( second.status, 0, second.stderr );
			assert.match( second.stdout, /Already published: wikibase@1\.0\.1/u );
		} );

		it( 'blocks publication from a dirty working tree', () => {
			const fixture = createFixture();
			write( fixture, 'development/images/wikibase/build.env', 'dirty=true\n' );
			const result = cli( fixture, 'release', 'images', 'wikibase', '--dry-run' );
			assert.notEqual( result.status, 0 );
			assert.match( result.stderr, /clean working tree/u );
		} );

		it( 'rejects prerelease versions until a publication policy exists', () => {
			const fixture = createFixture();
			write(
				fixture,
				'development/images/wikibase/package.json',
				'{\n\t"name": "wikibase",\n\t"version": "1.1.0-rc.1"\n}\n'
			);
			write(
				fixture,
				'development/images/wikibase/CHANGELOG.md',
				'# 1.1.0-rc.1 (2026-01-02)\n\n- Candidate.\n'
			);
			commitAll( fixture, 'feat(wikibase): prepare a candidate' );
			git( fixture, 'push', 'origin', 'main' );
			const result = cli( fixture, 'release', 'images', 'wikibase', '--dry-run' );
			assert.notEqual( result.status, 0 );
			assert.match( result.stderr, /stable MAJOR\.MINOR\.PATCH/u );
		} );
	} );
} );
