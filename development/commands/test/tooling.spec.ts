import { describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
	chmodSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

describe( 'WBS installation image selection', () => {
	it( 'does not announce Docker when it is already installed', () => {
		const fixture = mkdtempSync( join( tmpdir(), 'wbs-docker-preflight-' ) );
		const fakeDocker = join( fixture, 'docker' );
		writeFileSync(
			fakeDocker,
			`#!/bin/sh
case "$*" in
  "--version") echo "Docker version 28.0.0" ;;
  "compose version") echo "Docker Compose version v2.30.0" ;;
esac
exit 0
`
		);
		chmodSync( fakeDocker, 0o755 );

		try {
			const result = spawnSync(
				'bash',
				[
					'-c',
					'source "$1"; SCRIPTS_DIR="$(dirname "$1")"; ' +
						'SKIP_DEPENDENCY_INSTALLS=false; WBS_SKIP_ARCH_CHECK=true; ' +
						'DEBUG=false; prepare_install_runtime',
					'bash',
					resolve( '../scripts/run-wbs-tools.sh' )
				],
				{
					encoding: 'utf8',
					env: {
						...process.env,
						PATH: `${ fixture }:${ process.env.PATH }`,
						WBS_LOG_PATH: join( fixture, 'wbs.log' )
					}
				}
			);
			assert.equal( result.status, 0, result.stderr );
			assert.doesNotMatch( result.stdout, /Docker installed/u );
		} finally {
			rmSync( fixture, { recursive: true, force: true } );
		}
	} );

	it( 'selects the compatible major version published by the tools project', () => {
		const toolsPackage = JSON.parse(
			readFileSync( resolve( 'images/wbs-tools/package.json' ), 'utf8' )
		) as { version: string };
		const major = toolsPackage.version.split( '.', 1 )[ 0 ];
		const versionsScript = resolve( '../scripts/_versions.sh' );
		const selectedImage = execFileSync(
			'bash',
			[
				'-c',
				'source "$1"; printf "%s" "$WBS_TOOLS_IMAGE"',
				'bash',
				versionsScript
			],
			{
				encoding: 'utf8',
				env: { ...process.env, WBS_TOOLS_IMAGE: '' }
			}
		);

		assert.equal( selectedImage, `wikibase/wbs-tools:${ major }` );
	} );

	it( 'selects every locally built product image without pulling it', () => {
		const repositoryRoot = resolve( '..' );
		const output = execFileSync(
			'docker',
			[
				'compose',
				'--env-file',
				resolve( repositoryRoot, '.env.example' ),
				'-f',
				resolve( repositoryRoot, 'docker-compose.yml' ),
				'-f',
				resolve( repositoryRoot, 'development/docker-compose.local-images.yml' ),
				'config'
			],
			{ encoding: 'utf8' }
		);

		for ( const image of [
			'wikibase/wikibase:latest',
			'wikibase/opensearch:latest',
			'wikibase/wdqs:latest',
			'wikibase/wdqs-frontend:latest',
			'wikibase/quickstatements:latest'
		] ) {
			assert.ok( output.includes( `image: ${ image }` ), `Missing ${ image }` );
		}
		assert.match( output, /pull_policy: never/u );
	} );

	it( 'runs development lifecycle commands with the local tools image', () => {
		const fixture = mkdtempSync( join( tmpdir(), 'wbs-development-launcher-' ) );
		const dockerLog = join( fixture, 'docker.log' );
		const fakeDocker = join( fixture, 'docker' );
		writeFileSync(
			fakeDocker,
			`#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_DOCKER_LOG"
exit 0
`
		);
		chmodSync( fakeDocker, 0o755 );

		try {
			const result = spawnSync( resolve( 'wbs' ), [ 'status' ], {
				encoding: 'utf8',
				env: {
					...process.env,
					FAKE_DOCKER_LOG: dockerLog,
					PATH: `${ fixture }:${ process.env.PATH }`,
					WBS_DIR: fixture,
					WBS_SKIP_ARCH_CHECK: 'true',
					WBS_TOOLS_IMAGE: '',
					WBS_TOOLS_SKIP_PULL: ''
				}
			} );
			assert.equal( result.status, 0, result.stderr );
			assert.doesNotMatch( result.stdout, /Docker installed/u );
			const commands = readFileSync( dockerLog, 'utf8' );
			assert.match( commands, /image inspect wikibase\/wbs-tools:latest/u );
			assert.match( commands, /node \/app\/dist\/wbs\.js status/u );
			assert.doesNotMatch( commands, /^(?:info|pull|--version|compose version)/mu );
		} finally {
			rmSync( fixture, { recursive: true, force: true } );
		}
	} );

	it( 'pulls a missing tools image once before running a lifecycle command', () => {
		const fixture = mkdtempSync( join( tmpdir(), 'wbs-tools-runtime-' ) );
		const dockerLog = join( fixture, 'docker.log' );
		const imageReady = join( fixture, 'image-ready' );
		const fakeDocker = join( fixture, 'docker' );
		writeFileSync(
			fakeDocker,
			`#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_DOCKER_LOG"
if [ "$1 $2" = "image inspect" ]; then
  test -f "$FAKE_IMAGE_READY"
elif [ "$1" = "pull" ]; then
  touch "$FAKE_IMAGE_READY"
fi
`
		);
		chmodSync( fakeDocker, 0o755 );

		try {
			const result = spawnSync(
				resolve( '../scripts/run-wbs-tools.sh' ),
				[ 'status' ],
				{
					encoding: 'utf8',
					env: {
						...process.env,
						FAKE_DOCKER_LOG: dockerLog,
						FAKE_IMAGE_READY: imageReady,
						PATH: `${ fixture }:${ process.env.PATH }`,
						WBS_DIR: fixture,
						WBS_LOG_PATH: join( fixture, 'wbs.log' ),
						WBS_TOOLS_IMAGE: 'example/wbs-tools:9'
					}
				}
			);
			assert.equal( result.status, 0, result.stderr );
			const commands = readFileSync( dockerLog, 'utf8' );
			assert.match( commands, /^image inspect example\/wbs-tools:9$/mu );
			assert.match( commands, /^pull example\/wbs-tools:9$/mu );
			assert.match( commands, /^run .*example\/wbs-tools:9 node \/app\/dist\/wbs\.js status$/mu );
		} finally {
			rmSync( fixture, { recursive: true, force: true } );
		}
	} );

	it( 'fails clearly when a missing tools image cannot be pulled', () => {
		const fixture = mkdtempSync( join( tmpdir(), 'wbs-tools-runtime-failure-' ) );
		const fakeDocker = join( fixture, 'docker' );
		writeFileSync(
			fakeDocker,
			`#!/bin/sh
if [ "$1 $2" = "image inspect" ] || [ "$1" = "pull" ]; then
  exit 1
fi
`
		);
		chmodSync( fakeDocker, 0o755 );

		try {
			const logPath = join( fixture, 'wbs.log' );
			const result = spawnSync(
				resolve( '../scripts/run-wbs-tools.sh' ),
				[ 'status' ],
				{
					encoding: 'utf8',
					env: {
						...process.env,
						PATH: `${ fixture }:${ process.env.PATH }`,
						WBS_DIR: fixture,
						WBS_LOG_PATH: logPath,
						WBS_TOOLS_IMAGE: 'example/wbs-tools:missing'
					}
				}
			);
			assert.notEqual( result.status, 0 );
			assert.match(
				readFileSync( logPath, 'utf8' ),
				/Could not pull example\/wbs-tools:missing\. For an unpublished source checkout, rerun wbs install with --from-source\./u
			);
		} finally {
			rmSync( fixture, { recursive: true, force: true } );
		}
	} );
} );
