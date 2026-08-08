import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import { parse } from 'dotenv';
import {
	chmodSync,
	copyFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'fs';
import { join, resolve } from 'path';

export const INSTALLER_PORT = 18888;
export const INSTALLER_ACCESS_CODE = '482193';
export const WIKIBASE_HTTPS_PORT = 18443;
export const INSTALLER_URL = `https://host.docker.internal:${ INSTALLER_PORT }`;
export const WIKIBASE_URL = 'https://wikibase.test';
export const ADMIN_USERNAME = 'WbsToolsAdmin';
export const ADMIN_PASSWORD = 'WbsToolsAdminPassword-2026';
export const ADMIN_EMAIL = 'installer-test@example.test';
export const INSTALL_TIMEOUT = 15 * 60 * 1000;
export const DATABASE_NAME = 'wbs_tools_test';
export const DATABASE_USER = 'wbs_tools_user';
export const DATABASE_PASSWORD = 'WbsToolsDatabasePassword-2026';

const INSTALLER_CONTAINER = 'installer-e2e-web';
const INSTALLER_WORKER_CONTAINER = 'installer-e2e-worker';
const INSTALL_PROJECT = 'wbs-tools-e2e';
const HOST_REPOSITORY_ROOT = resolve(
	process.env.HOST_PWD || join( process.cwd(), '../..' )
);
const SUITE_ROOT = join(
	HOST_REPOSITORY_ROOT,
	'development/tests/wbs-tools'
);
export const INSTALLER_TEMP_ROOT = join( SUITE_ROOT, 'tmp' );
const TEMP_ROOT = INSTALLER_TEMP_ROOT;
const CHECKOUT_ROOT = join( TEMP_ROOT, 'checkout' );
const RESULT_ROOT = join( SUITE_ROOT, 'results' );
const INSTALL_LOG = join( CHECKOUT_ROOT, 'installation.log' );
const WBS_LOG = join( CHECKOUT_ROOT, 'wbs.log' );
const COMPOSE_FILES = [
	join( CHECKOUT_ROOT, 'docker-compose.yml' ),
	join( CHECKOUT_ROOT, 'docker-compose.local.yml' )
];

type CommandOptions = {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	allowFailure?: boolean;
	input?: string;
};

function run(
	command: string,
	args: string[],
	options: CommandOptions = {}
): string {
	const result = spawnSync( command, args, {
		cwd: options.cwd,
		env: options.env || process.env,
		encoding: 'utf8',
		input: options.input,
		stdio: 'pipe'
	} );
	const output = `${ result.stdout || '' }${ result.stderr || '' }`;

	if ( result.error && !options.allowFailure ) {
		throw result.error;
	}
	if ( result.status !== 0 && !options.allowFailure ) {
		throw new Error(
			`Command failed (${ command } ${ args.join( ' ' ) }):\n${ output }`
		);
	}

	return output;
}

function composeArgs( command: string[] ): string[] {
	return [
		'compose',
		'-p',
		INSTALL_PROJECT,
		'-f',
		COMPOSE_FILES[ 0 ],
		'-f',
		COMPOSE_FILES[ 1 ],
		...command
	];
}

function copyCheckout(): void {
	rmSync( TEMP_ROOT, { recursive: true, force: true } );
	mkdirSync( CHECKOUT_ROOT, { recursive: true } );
	mkdirSync( join( CHECKOUT_ROOT, '.git' ) );
	mkdirSync( join( CHECKOUT_ROOT, 'config/extensions' ), { recursive: true } );

	for ( const file of [
		'install',
		'docker-compose.yml',
		'.env.example',
		'package.json'
	] ) {
		copyFileSync( join( HOST_REPOSITORY_ROOT, file ), join( CHECKOUT_ROOT, file ) );
	}
	for ( const file of [ 'Extensions.php', 'traefik-dynamic.yml' ] ) {
		copyFileSync(
			join( HOST_REPOSITORY_ROOT, 'config', file ),
			join( CHECKOUT_ROOT, 'config', file )
		);
	}
	cpSync( join( HOST_REPOSITORY_ROOT, 'scripts' ), join( CHECKOUT_ROOT, 'scripts' ), {
		recursive: true
	} );
	copyFileSync(
		join( SUITE_ROOT, 'docker-compose.install.yml' ),
		join( CHECKOUT_ROOT, 'docker-compose.local.yml' )
	);
	writeFileSync( INSTALL_LOG, '' );
}

export function toolsImage(): string {
	const registry = process.env.WBS_TEST_IMAGE_REGISTRY || 'wikibase';
	const tag = process.env.WBS_TEST_IMAGE_TAG || 'latest';
	return `${ registry }/wbs-tools:${ tag }`;
}

export function verifyCliInstallWaitsForConfiguration(): void {
	const auditRoot = join( TEMP_ROOT, 'cli-sequencing' );
	rmSync( auditRoot, { recursive: true, force: true } );
	mkdirSync( auditRoot, { recursive: true } );
	copyFileSync( join( HOST_REPOSITORY_ROOT, '.env.example' ), join( auditRoot, '.env.example' ) );
	const fakeDocker = join( auditRoot, 'docker' );
	writeFileSync(
		fakeDocker,
		'#!/bin/sh\n' +
			'grep -q "^MW_ADMIN_NAME=CliAdmin$" /app/wbs/.env || exit 99\n' +
			'touch /app/wbs/docker-called-after-configuration\n'
	);
	chmodSync( fakeDocker, 0o755 );

	const answers = [
		'cli@example.test',
		'wikibase.test',
		'query.wikibase.test',
		'n',
		'CliAdmin',
		'CliAdminPassword-2026',
		'cli_wiki',
		'cli_user',
		'CliDatabasePassword-2026',
		''
	].join( '\n' );
	const output = run(
		'docker',
		[
			'run', '--rm', '-i',
			'-v', `${ auditRoot }:/app/wbs`,
			'-v', `${ fakeDocker }:/usr/local/bin/docker:ro`,
			toolsImage(), 'node', 'dist/wbs.js', 'install', '--local'
		],
		{ input: answers }
	);
	assert.equal( existsSync( join( auditRoot, 'docker-called-after-configuration' ) ), true );
	assert.match( output, /Wikibase Suite is now running\./u );
	assert.match( output, /Wikibase:\s+https:\/\/wikibase\.test/u );
	assert.match( output, /Query Service:\s+https:\/\/query\.wikibase\.test/u );
	assert.match(
		output,
		/QuickStatements:\s+https:\/\/wikibase\.test\/tools\/quickstatements/u
	);
}

export function startInstaller(): void {
	copyCheckout();
	const image = toolsImage();
	const skipPull = process.env.GITHUB_ACTIONS === 'true' ? 'false' : 'true';

	run( 'bash', [ './install', '--local' ], {
		cwd: CHECKOUT_ROOT,
		env: {
			...process.env,
			COMPOSE_PROJECT_NAME: INSTALL_PROJECT,
			WBS_LOG_PATH: WBS_LOG,
			INSTALLATION_LOG_PATH: INSTALL_LOG,
			WBS_E2E_PULL_POLICY:
				process.env.GITHUB_ACTIONS === 'true' ? 'always' : 'never',
			WBS_E2E_HTTP_PORT: '18080',
			WBS_E2E_HTTPS_PORT: String( WIKIBASE_HTTPS_PORT ),
			WBS_INSTALLER_CONTAINER_NAME: INSTALLER_CONTAINER,
			WBS_INSTALLER_WORKER_CONTAINER_NAME: INSTALLER_WORKER_CONTAINER,
			WBS_INSTALLER_PORT: String( INSTALLER_PORT ),
			WBS_INSTALLER_ACCESS_CODE: INSTALLER_ACCESS_CODE,
			WBS_SKIP_ARCH_CHECK: 'true',
			WBS_SKIP_DEPENDENCY_INSTALLS: 'true',
			WBS_TOOLS_ENV_PASSTHROUGH: [
				'WBS_E2E_PULL_POLICY',
				'WBS_E2E_HTTP_PORT',
				'WBS_E2E_HTTPS_PORT',
				'WBS_TEST_IMAGE_REGISTRY',
				'WBS_TEST_IMAGE_TAG'
			].join( ' ' ),
			WBS_TOOLS_IMAGE: image,
			WBS_TOOLS_SKIP_PULL: skipPull
		}
	} );
}

function wait( milliseconds: number ): Promise<void> {
	return new Promise( ( resolveWait ) => {
		setTimeout( resolveWait, milliseconds );
	} );
}

function installedServicesHealthProblem(): string | undefined {
	const expected = run( 'docker', composeArgs( [ 'config', '--services' ] ), {
		cwd: CHECKOUT_ROOT
	} )
		.trim()
		.split( /\s+/ )
		.filter( Boolean );
	const running = new Set(
		run( 'docker', composeArgs( [ 'ps', '--services', '--status', 'running' ] ), {
			cwd: CHECKOUT_ROOT
		} )
			.trim()
			.split( /\s+/ )
			.filter( Boolean )
	);
	const notRunning = expected.filter( ( service ) => !running.has( service ) );
	if ( notRunning.length > 0 ) {
		return `Services not running: ${ notRunning.join( ', ' ) }`;
	}

	const ids = run( 'docker', composeArgs( [ 'ps', '-q' ] ), {
		cwd: CHECKOUT_ROOT
	} )
		.trim()
		.split( /\s+/ )
		.filter( Boolean );
	if ( ids.length === 0 ) {
		return 'No installed containers were found.';
	}
	const inspected = JSON.parse( run( 'docker', [ 'inspect', ...ids ] ) ) as {
		Name: string;
		State: { Status: string; Health?: { Status: string } };
	}[];
	const unhealthy = inspected.filter(
		( container ) =>
			container.State.Status !== 'running' ||
			( container.State.Health !== undefined &&
				container.State.Health.Status !== 'healthy' )
	);
	if ( unhealthy.length > 0 ) {
		return `Containers not healthy: ${ unhealthy
			.map(
				( container ) =>
					`${ container.Name } (${
						container.State.Health ?
							container.State.Health.Status :
							container.State.Status
					})`
			)
			.join( ', ' ) }`;
	}
	return undefined;
}

export async function waitForInstalledServicesHealthy(): Promise<void> {
	const deadline = Date.now() + INSTALL_TIMEOUT;
	let problem = 'The installed services have not started.';
	while ( Date.now() < deadline ) {
		problem = installedServicesHealthProblem() || '';
		if ( !problem ) {
			return;
		}
		await wait( 5000 );
	}
	throw new Error( `Installed services did not become healthy: ${ problem }` );
}

function installerIsRunning(): boolean {
	return run(
		'docker',
		[ 'inspect', '--format={{.State.Running}}', INSTALLER_CONTAINER ],
		{ allowFailure: true }
	).trim() === 'true';
}

export async function waitForInstallerStopped(): Promise<void> {
	const deadline = Date.now() + 30000;
	while ( Date.now() < deadline ) {
		if ( !installerIsRunning() ) {
			return;
		}
		await wait( 250 );
	}
	throw new Error( 'Installer container did not stop after finalization.' );
}

export function verifyInstallerContainerIsolation(): void {
	type ContainerInspection = {
		HostConfig: { NetworkMode: string };
		Mounts: { Source: string; Destination: string }[];
	};
	const inspect = ( container: string ): ContainerInspection =>
		JSON.parse( run( 'docker', [ 'inspect', container ] ) )[ 0 ] as ContainerInspection;
	const web = inspect( INSTALLER_CONTAINER );
	const worker = inspect( INSTALLER_WORKER_CONTAINER );

	assert.equal(
		web.Mounts.some( ( mount ) => mount.Destination === '/var/run/docker.sock' ),
		false,
		'The network-facing installer web container must not receive the Docker socket.'
	);
	assert.equal( worker.HostConfig.NetworkMode, 'none' );
	assert.equal(
		worker.Mounts.some(
			( mount ) => mount.Source === '/var/run/docker.sock' &&
				mount.Destination === '/var/run/docker.sock'
		),
		true,
		'The non-networked installation worker requires the Docker socket.'
	);
}

export function verifySubmittedInstallerConfiguration(): void {
	const config = parse( readFileSync( join( CHECKOUT_ROOT, '.env' ), 'utf8' ) );
	assert.deepEqual(
		{
			WIKIBASE_PUBLIC_HOST: config.WIKIBASE_PUBLIC_HOST,
			WDQS_PUBLIC_HOST: config.WDQS_PUBLIC_HOST,
			MW_ADMIN_EMAIL: config.MW_ADMIN_EMAIL,
			MW_ADMIN_NAME: config.MW_ADMIN_NAME,
			MW_ADMIN_PASS: config.MW_ADMIN_PASS,
			DB_NAME: config.DB_NAME,
			DB_USER: config.DB_USER,
			DB_PASS: config.DB_PASS,
			METADATA_CALLBACK: config.METADATA_CALLBACK
		},
		{
			WIKIBASE_PUBLIC_HOST: 'wikibase.test',
			WDQS_PUBLIC_HOST: 'query.wikibase.test',
			MW_ADMIN_EMAIL: ADMIN_EMAIL,
			MW_ADMIN_NAME: ADMIN_USERNAME,
			MW_ADMIN_PASS: ADMIN_PASSWORD,
			DB_NAME: DATABASE_NAME,
			DB_USER: DATABASE_USER,
			DB_PASS: DATABASE_PASSWORD,
			METADATA_CALLBACK: 'true'
		},
		'Generated .env does not match the values submitted through the installer UI.'
	);
}

export function verifyFinalizedInstallerArtifacts(): void {
	const configPath = join( CHECKOUT_ROOT, '.env' );
	const passwordEntries = readFileSync( configPath, 'utf8' )
		.split( '\n' )
		.map( ( line ) => /^\s*([A-Z0-9_]*PASS(?:WORD)?)=(.*)$/i.exec( line ) )
		.filter( ( match ): match is RegExpExecArray => match !== null );

	if ( passwordEntries.length === 0 ) {
		throw new Error( 'Finalized installer config contains no password entries to verify.' );
	}

	const unsanitized = passwordEntries.filter( ( match ) => match[ 2 ].trim() !== '' );
	if ( unsanitized.length > 0 ) {
		throw new Error(
			`Finalized installer config retained credentials in: ${ unsanitized
				.map( ( match ) => match[ 1 ] )
				.join( ', ' ) }.`
		);
	}

	if ( readFileSync( INSTALL_LOG, 'utf8' ) !== '' ) {
		throw new Error( 'Finalized installer did not clear its installation log.' );
	}
}

export function collectDiagnostics(): void {
	mkdirSync( RESULT_ROOT, { recursive: true } );
	if ( existsSync( INSTALL_LOG ) ) {
		writeFileSync(
			join( RESULT_ROOT, 'installation.log' ),
			readFileSync( INSTALL_LOG )
		);
	}
	if ( existsSync( WBS_LOG ) ) {
		writeFileSync(
			join( RESULT_ROOT, 'wbs.log' ),
			readFileSync( WBS_LOG )
		);
	}
	writeFileSync(
		join( RESULT_ROOT, 'installer-container.log' ),
		run( 'docker', [ 'logs', INSTALLER_CONTAINER ], { allowFailure: true } )
	);
	if ( existsSync( COMPOSE_FILES[ 0 ] ) ) {
		writeFileSync(
			join( RESULT_ROOT, 'installed-services.log' ),
			run( 'docker', composeArgs( [ 'logs', '--no-color' ] ), {
				cwd: CHECKOUT_ROOT,
				allowFailure: true
			} )
		);
	}
}

export function stopInstaller(): void {
	run( 'docker', [ 'rm', '-f', INSTALLER_CONTAINER ], { allowFailure: true } );
	run( 'docker', [ 'rm', '-f', INSTALLER_WORKER_CONTAINER ], { allowFailure: true } );
	if ( existsSync( COMPOSE_FILES[ 0 ] ) ) {
		run(
			'docker',
			composeArgs( [ 'down', '--volumes', '--remove-orphans', '--timeout', '1' ] ),
			{ cwd: CHECKOUT_ROOT, allowFailure: true }
		);
	}
	rmSync( TEMP_ROOT, { recursive: true, force: true } );
}
