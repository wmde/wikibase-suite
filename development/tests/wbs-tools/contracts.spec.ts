import assert from 'node:assert/strict';
import { execFileSync, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSTALLER_TEMP_ROOT, installerContainerInspections, toolsImage } from './test-environment.js';

const defaultConfiguration = {
	WIKIBASE_PUBLIC_HOST: 'wikibase.test',
	WDQS_PUBLIC_HOST: 'query.wikibase.test',
	MW_ADMIN_NAME: 'Admin',
	MW_ADMIN_EMAIL: 'admin@example.test',
	MW_ADMIN_PASS: 'AdminPassword-2026',
	DB_NAME: 'my_wiki',
	DB_USER: 'sqluser',
	DB_PASS: 'DatabasePassword-2026'
};

function withTemporaryDirectory<T>( name: string, callback: ( root: string ) => T ): T {
	const root = mkdtempSync( join( INSTALLER_TEMP_ROOT, `${ name }-` ) );
	try {
		return callback( root );
	} finally {
		rmSync( root, { recursive: true, force: true } );
	}
}

function writeConfiguration(
	root: string,
	overrides: Partial<Record<keyof typeof defaultConfiguration, string>> = {},
	compose = 'services: {}\n'
): void {
	const configuration = { ...defaultConfiguration, ...overrides };
	writeFileSync(
		join( root, '.env' ),
		[
			...Object.entries( configuration ).map( ( [ name, value ] ) => `${ name }=${ value }` ),
			''
		].join( '\n' )
	);
	writeFileSync( join( root, 'docker-compose.yml' ), compose );
}

function runTools(
	root: string,
	args: string[],
	options: { environment?: Record<string, string>; fakeDocker?: string; input?: string } = {}
): SpawnSyncReturns<string> {
	const dockerArgs = [ 'run', '--rm' ];
	if ( options.input !== undefined ) dockerArgs.push( '-i' );
	for ( const [ name, value ] of Object.entries( options.environment ?? {} ) ) {
		dockerArgs.push( '-e', `${ name }=${ value }` );
	}
	if ( options.fakeDocker !== undefined ) {
		dockerArgs.push( '-v', writeFakeDocker( root, options.fakeDocker ) );
	}
	dockerArgs.push( '-v', `${ root }:/app/wbs`, toolsImage(), 'node', ...args );
	return spawnSync( 'docker', dockerArgs, {
		encoding: 'utf8', input: options.input, stdio: 'pipe'
	} );
}

function writeFakeDocker( root: string, script: string ): string {
	const path = join( root, 'docker' );
	writeFileSync( path, script );
	chmodSync( path, 0o755 );
	return `${ path }:/usr/local/bin/docker:ro`;
}

function shellScript( strings: TemplateStringsArray, ...values: unknown[] ): string {
	return String.raw( strings, ...values ).replace( /^\n/u, '' );
}

describe( 'WBS Tools contracts', () => {
	describe( 'root install script', () => {
		it( 'prepares the selected checkout and hands installation to WBS Tools', () => {
			execFileSync(
				'bash',
				[ fileURLToPath( new URL( './install-bootstrap.sh', import.meta.url ) ) ],
				{ encoding: 'utf8' }
			);
		} );
	} );

	describe( 'CLI configuration', () => {
		it( 'provides the supported install command interface', () => {
			const image = toolsImage();
			const help = execFileSync(
				'docker',
				[ 'run', '--rm', image, 'node', 'dist/wbs.js', 'install', '--help' ],
				{ encoding: 'utf8' }
			);
			for ( const option of [ '--web', '--local', '--from-source', '--debug' ] ) {
				assert.ok( help.includes( option ), `wbs install help does not include ${ option }.` );
			}
			assert.throws( () => execFileSync(
				'docker', [ 'run', '--rm', image, 'node', 'dist/wbs.js', 'install', '--unknown-option' ],
				{ encoding: 'utf8', stdio: 'pipe' }
			) );
		} );

		it( 'describes generated and retained passwords independently', () => {
			withTemporaryDirectory( 'password-prompts', ( root ) => {
				writeConfiguration( root, { MW_ADMIN_PASS: '', DB_PASS: 'ExistingDatabasePassword-2026' } );
				const result = runTools( root, [ 'dist/wbs.js', 'install', 'configure', '--local' ], {
					input: '\n'.repeat( 9 )
				} );
				assert.equal( result.status, 0, result.stderr );
				assert.match( result.stdout, /Admin password \(press Enter to use generated password\)/u );
				assert.match( result.stdout, /Database password \(press Enter to keep existing password\)/u );
				const config = readFileSync( join( root, '.env' ), 'utf8' );
				assert.match( config, /^MW_ADMIN_PASS=.+$/mu );
				assert.match( config, /^DB_PASS=ExistingDatabasePassword-2026$/mu );
			} );
		} );

		it( 'does not reapply template values over an existing configuration', () => {
			withTemporaryDirectory( 'configuration', ( root ) => {
				writeConfiguration( root );
				writeFileSync( join( root, '.env.example' ), 'TEMPLATE_ONLY=template\n' );
				writeFileSync( join( root, '.env' ), 'EXISTING_ONLY=preserved\n' );
				const input = {
					MW_ADMIN_EMAIL: 'admin@example.test', WIKIBASE_PUBLIC_HOST: 'wikibase.test',
					WDQS_PUBLIC_HOST: 'query.wikibase.test', METADATA_CALLBACK: 'false',
					MW_ADMIN_NAME: 'Admin', MW_ADMIN_PASS: 'AdminPassword-2026', DB_NAME: 'my_wiki',
					DB_USER: 'sqluser', DB_PASS: 'DatabasePassword-2026'
				};
				const script = `
					const { getConfig } = await import( './dist/lib/configuration.js' );
					console.log( JSON.stringify( getConfig( ${ JSON.stringify( input ) } ).config ) );
				`;
				const result = runTools( root, [ '--input-type=module', '--eval', script ] );
				assert.equal( result.status, 0, result.stderr );
				const config = JSON.parse( result.stdout ) as Record<string, string>;
				assert.equal( config.EXISTING_ONLY, 'preserved' );
				assert.equal( config.TEMPLATE_ONLY, undefined );
			} );
		} );

		it( 'finishes configuration before starting lifecycle operations', () => {
			withTemporaryDirectory( 'cli-sequencing', ( root ) => {
				copyFileSync(
					fileURLToPath( new URL( '../../../.env.example', import.meta.url ) ),
					join( root, '.env.example' )
				);
				const output = runTools( root, [ 'dist/wbs.js', 'install', '--local' ], {
					fakeDocker: shellScript`
#!/bin/sh
grep -q "^MW_ADMIN_NAME=CliAdmin$" /app/wbs/.env || exit 99
touch /app/wbs/docker-called-after-configuration
`,
					input: [
						'cli@example.test',
						'wikibase.test',
						'query.wikibase.test',
						'n',
						'CliAdmin',
						'',
						'cli_wiki',
						'cli_user',
						'CliDatabasePassword-2026',
						''
					].join( '\n' )
				} );
				assert.equal( output.status, 0, output.stderr );
				assert.equal( existsSync( join( root, 'docker-called-after-configuration' ) ), true );
				assert.match( output.stdout, /Wikibase Suite is now running\./u );
				assert.match( output.stdout, /Admin username:\s+CliAdmin/u );
				assert.match( output.stdout, /Admin password:\s+\S+/u );
				assert.doesNotMatch( output.stdout, /Database username:|CliDatabasePassword-2026/u );
				assert.match( readFileSync( join( root, '.env' ), 'utf8' ), /^MW_ADMIN_PASS=$/mu );
			} );
		} );
	} );

	describe( 'image selection', () => {
		it( 'uses installation manifest images for resolved Compose services', () => {
			withTemporaryDirectory( 'manifest', ( root ) => {
				const commit = 'a1b2c3d4e5f678901234567890abcdef12345678';
				const tag = 'pr-942-a1b2c3d4e5f6';
				copyFileSync(
					fileURLToPath( new URL( '../../../docker-compose.yml', import.meta.url ) ),
					join( root, 'docker-compose.yml' )
				);
				mkdirSync( join( root, '.wbs' ), { recursive: true } );
				copyFileSync(
					fileURLToPath( new URL( '../../../.wbs/version', import.meta.url ) ),
					join( root, '.wbs/version' )
				);
				writeFileSync(
					join( root, '.env' ),
					[ ...Object.entries( { ...defaultConfiguration, METADATA_CALLBACK: 'false' } )
						.map( ( [ name, value ] ) => `${ name }=${ value }` ), '' ].join( '\n' )
				);
				writeFileSync(
					join( root, 'resolved-compose.json' ),
					execFileSync( 'docker', [
						'compose', '--project-directory', root,
						'--file', join( root, 'docker-compose.yml' ),
						'--env-file', join( root, '.env' ),
						'config', '--format', 'json'
					], { encoding: 'utf8' } )
				);
				const manifest = {
					schemaVersion: 1,
					source: { commit },
					images: Object.fromEntries(
						[ 'wikibase', 'opensearch', 'quickstatements', 'wdqs', 'wdqs-frontend',
							'wbs-tools', 'unused-build-target' ].map(
							( name ) => [ name, `ghcr.io/wmde/wikibase/${ name }:${ tag }` ]
						)
					)
				};
				const script = `
					globalThis.fetch = async () => ({
						ok: true,
						json: async () => (${ JSON.stringify( manifest ) })
					});
					const { applyInstallationManifest } = await import( './dist/lib/installation-manifest.js' );
					await applyInstallationManifest({
						repositoryRoot: '/app/wbs',
						manifestUrl: 'https://example.test/manifest.json',
						resolvedSha: '${ commit }'
					});
				`;
				const result = runTools( root, [ '--input-type=module', '--eval', script ], {
					environment: { WBS_DIR: '/app/wbs' },
					fakeDocker: shellScript`
#!/bin/sh
for argument in "$@"; do
  if [ "$argument" = config ]; then
    cat /app/wbs/resolved-compose.json
    exit 0
  fi
done
exit 0
`
				} );
				assert.equal( result.status, 0, result.stderr );
				const override = readFileSync( join( root, 'docker-compose.override.yml' ), 'utf8' );
				assert.match( override, /wikibase-jobrunner:\n[ ]{4}image: "ghcr\.io\/wmde\/wikibase\/wikibase:pr-942-a1b2c3d4e5f6"/u );
				assert.doesNotMatch( override, /unused-build-target/u );
			} );
		} );

		it( 'selects all configured local images for a non-interactive source build', () => {
			withTemporaryDirectory( 'source-build', ( root ) => {
				writeConfiguration( root, {}, 'services:\n  wikibase:\n    image: wikibase/wikibase:8\n' );
				mkdirSync( join( root, 'development' ) );
				writeFileSync( join( root, 'development/docker-compose.yml' ), 'services: {}\n' );
				writeFileSync( join( root, 'docker-arguments' ), '' );
				const script = `
					const { up } = await import( './dist/lib/compose.js' );
					await up({ build: true });
				`;
				const result = runTools( root, [ '--input-type=module', '--eval', script ], {
					environment: {
						WBS_DIR: '/app/wbs',
						ENV_FILE_PATH: '/app/wbs/.env',
						WBS_LOCAL_IMAGE_REPOSITORY: 'registry.example.test/wikibase',
						WBS_LOCAL_IMAGE_TAG: 'test-tag'
					},
					fakeDocker: shellScript`
#!/bin/sh
printf "%s\\n" "$@" >> /app/wbs/docker-arguments
printf "%s\\n" --- >> /app/wbs/docker-arguments
for argument in "$@"; do
  if [ "$argument" = config ]; then
    printf '%s\n' '{"services":{"wikibase":{"image":"wikibase/wikibase:8"}}}'
    exit 0
  fi
done
`
				} );
				assert.equal( result.status, 0, result.stderr );
				const dockerArguments = readFileSync( join( root, 'docker-arguments' ), 'utf8' );
				assert.match( dockerArguments, /pnpm exec tsx wbs-dev\.ts build all/u );
				assert.match( dockerArguments, /--env-file\n\/app\/wbs\/\.env/u );
				assert.match( dockerArguments, /--file\n\/app\/wbs\/docker-compose\.yml/u );
				assert.match( readFileSync( join( root, '.wbs/local-images.override.yml' ), 'utf8' ), /wikibase:\n[ ]{4}image: "registry\.example\.test\/wikibase\/wikibase:test-tag"/u );
			} );
		} );

		it( 'allows configured remote local images to be pulled', () => {
			withTemporaryDirectory( 'remote-local-images', ( root ) => {
				writeConfiguration( root, {}, 'services:\n  wikibase:\n    image: wikibase/wikibase:8\n' );
				const script = `
					const { up } = await import( './dist/lib/compose.js' );
					await up({ localImages: true, update: true });
				`;
				const result = runTools( root, [ '--input-type=module', '--eval', script ], {
					environment: {
						WBS_DIR: '/app/wbs',
						ENV_FILE_PATH: '/app/wbs/.env',
						WBS_LOCAL_IMAGE_REPOSITORY: 'ghcr.io/example/wikibase',
						WBS_LOCAL_IMAGE_TAG: 'ci-build',
						WBS_LOCAL_IMAGE_PULL_POLICY: 'always'
					},
					fakeDocker: shellScript`
#!/bin/sh
for argument in "$@"; do
  if [ "$argument" = config ]; then
    printf '%s\n' '{"services":{"wikibase":{"image":"wikibase/wikibase:8"}}}'
    exit 0
  fi
done
exit 0
`
				} );
				assert.equal( result.status, 0, result.stderr );
				const override = readFileSync( join( root, '.wbs/local-images.override.yml' ), 'utf8' );
				assert.match( override, /wikibase:\n[ ]{4}image: "ghcr\.io\/example\/wikibase\/wikibase:ci-build"/u );
				assert.doesNotMatch( override, /pull_policy/u );
			} );
		} );
	} );

	describe( 'installation worker', () => {
		it( 'reports worker failures to the browser event log', () => {
			withTemporaryDirectory( 'worker-failure', ( root ) => {
				writeConfiguration( root );
				writeFileSync( join( root, 'install-request' ), 'ready\n' );
				const result = runTools( root, [ '/app/dist/wbs.js', 'install', 'worker' ], {
					environment: {
						WBS_DIR: '/app/wbs',
						ENV_FILE_PATH: '/app/wbs/.env',
						WBS_LOG_PATH: '/app/wbs/wbs.log',
						INSTALLATION_LOG_PATH: '/app/wbs/installation.log',
						LAUNCH_TRIGGER_PATH: '/app/wbs/install-request'
					},
					fakeDocker: shellScript`
#!/bin/sh
echo "simulated image pull failure" >&2
exit 42
`
				} );
				assert.notEqual( result.status, 0 );
				assert.match( readFileSync( join( root, 'wbs.log' ), 'utf8' ), /simulated image pull failure/u );
				assert.match( readFileSync( join( root, 'installation.log' ), 'utf8' ), /Installation failed: docker exited with status 42\. \[installation_failed\]/u );
			} );
		} );

		it( 'keeps the network-facing installer separate from the Docker socket', () => {
			const { web, worker } = installerContainerInspections();
			assert.equal( web.Mounts.some( ( mount ) => mount.Destination === '/var/run/docker.sock' ), false );
			assert.equal( worker.HostConfig.NetworkMode, 'none' );
			assert.equal( worker.Mounts.some( ( mount ) => mount.Source === '/var/run/docker.sock' && mount.Destination === '/var/run/docker.sock' ), true );
		} );
	} );
} );
