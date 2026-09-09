import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnvContent } from './validation.js';
import { captureProcess, runProcess } from './command-runner.js';
import { composeOverride, runtimeImageNames } from './compose-image-overrides.js';

export type SuiteOptions = {
	update?: boolean;
	build?: boolean;
	localImages?: boolean;
	onStartingServices?: () => void | Promise<void>;
};

export type ResetOptions = {
	environment: boolean;
	data: boolean;
};

const repositoryRoot = process.env.WBS_DIR || '/app/wbs';
const envFile = process.env.ENV_FILE_PATH || join( repositoryRoot, '.env' );
const localSettingsFile = join( repositoryRoot, 'config/LocalSettings.php' );
const instanceSettingsFile = join( repositoryRoot, 'config/InstanceSettings.php' );
const REQUIRED_CONFIGURATION_KEYS = [
	'WIKIBASE_PUBLIC_HOST', 'WDQS_PUBLIC_HOST', 'MW_ADMIN_NAME', 'MW_ADMIN_EMAIL',
	'MW_ADMIN_PASS', 'DB_PASS', 'DB_NAME', 'DB_USER'
] as const;

export function missingConfigurationKeys(): string[] {
	if ( !existsSync( envFile ) ) {
		return [ ...REQUIRED_CONFIGURATION_KEYS ];
	}
	const config = parseEnvContent( readFileSync( envFile, 'utf8' ) );
	const requiredKeys = ( existsSync( instanceSettingsFile ) || existsSync( localSettingsFile ) ) ?
		REQUIRED_CONFIGURATION_KEYS.filter( key => key !== 'MW_ADMIN_PASS' && key !== 'DB_PASS' ) :
		REQUIRED_CONFIGURATION_KEYS;
	return requiredKeys.filter( ( key ) => !config[ key ]?.trim() );
}

export function configurationExists(): boolean {
	return existsSync( envFile );
}

function localImagesOverridePath(): string {
	return join( repositoryRoot, '.wbs/local-images.override.yml' );
}

function writeLocalImagesOverride(): string {
	const repository = process.env.WBS_LOCAL_IMAGE_REPOSITORY || 'wikibase';
	const tag = process.env.WBS_LOCAL_IMAGE_TAG || 'latest';
	const pullPolicy = process.env.WBS_LOCAL_IMAGE_PULL_POLICY === 'always' ?
		{} : { pullPolicy: 'never' as const };
	const images = Object.fromEntries( runtimeImageNames( repositoryRoot ).map(
		( imageName ) => [ imageName, `${ repository }/${ imageName }:${ tag }` ]
	) );
	const path = localImagesOverridePath();
	mkdirSync( join( repositoryRoot, '.wbs' ), { recursive: true } );
	writeFileSync( path, composeOverride( repositoryRoot, images, pullPolicy ), { mode: 0o600 } );
	return path;
}

function composeArgs( localImages = false ): string[] {
	const args = [
		'compose',
		'--project-directory', repositoryRoot
	];
	if ( existsSync( envFile ) ) {
		args.push( '--env-file', envFile );
	}
	if ( localImages ) {
		args.push( '--file', join( repositoryRoot, 'docker-compose.yml' ) );
		const conventionalOverride = join( repositoryRoot, 'docker-compose.override.yml' );
		if ( existsSync( conventionalOverride ) ) {
			args.push( '--file', conventionalOverride );
		}
		args.push( '--file', writeLocalImagesOverride() );
	}
	return args;
}

export async function composeServicesAreRunning( localImages = false ): Promise<boolean> {
	const result = await captureProcess( 'docker', [
		...composeArgs( localImages ), 'ps', '--services', '--status', 'running'
	] );
	return result.exitCode === 0 && result.stdout.trim().length > 0;
}

export async function composeServicesExist( localImages = false ): Promise<boolean> {
	const result = await captureProcess( 'docker', [
		...composeArgs( localImages ), 'ps', '--services', '--all'
	] );
	return result.exitCode === 0 && result.stdout.trim().length > 0;
}

async function composeVolumesExist( localImages = false ): Promise<boolean> {
	const config = await captureProcess( 'docker', [
		...composeArgs( localImages ), 'config', '--format', 'json'
	] );
	if ( config.exitCode !== 0 ) {
		return false;
	}
	let projectName: string;
	try {
		projectName = String( ( JSON.parse( config.stdout ) as { name?: unknown } ).name || '' );
	} catch {
		return false;
	}
	if ( !projectName ) {
		return false;
	}
	const volumes = await captureProcess( 'docker', [
		'volume', 'ls', '--quiet', '--filter', `label=com.docker.compose.project=${ projectName }`
	] );
	return volumes.exitCode === 0 && volumes.stdout.trim().length > 0;
}

export async function installedSuiteExists( localImages = false ): Promise<boolean> {
	return existsSync( instanceSettingsFile ) ||
		existsSync( localSettingsFile ) ||
		await composeServicesExist( localImages ) ||
		await composeVolumesExist( localImages );
}

async function buildImages(): Promise<void> {
	const developmentRoot = join( repositoryRoot, 'development' );
	await runProcess( 'docker', [
		'compose', '--project-directory', developmentRoot,
		'--file', join( developmentRoot, 'docker-compose.yml' ),
		'run', '--no-TTY', '--rm', 'wbs-dev', '-c',
		'pnpm exec tsx wbs-dev.ts build all'
	] );
}

export async function up( options: SuiteOptions = {} ): Promise<void> {
	const missing = missingConfigurationKeys();
	if ( missing.length ) {
		throw new Error( `Suite configuration is incomplete. Missing: ${ missing.join( ', ' ) }.` );
	}
	const localImages = options.localImages === true || options.build === true;
	if ( options.build ) {
		console.log( 'Building Wikibase Suite images from this checkout...' );
		await buildImages();
	}
	const args = composeArgs( localImages );
	if ( options.update ) {
		console.log( 'Pulling selected Wikibase Suite images...' );
		await runProcess( 'docker', [ ...args, 'pull' ] );
	}
	await options.onStartingServices?.();
	console.log( 'Starting Wikibase Suite services...' );
	await runProcess( 'docker', [ ...args, 'up', '--detach', '--wait' ] );
}

export async function down(): Promise<void> {
	await runProcess( 'docker', [ ...composeArgs(), 'down' ] );
}

export async function status(): Promise<void> {
	await runProcess( 'docker', [ ...composeArgs(), 'ps' ] );
}

export async function reset( options: ResetOptions ): Promise<void> {
	// Use .env when available, then delete it only after Compose has removed the instance.
	if ( options.data ) {
		await runProcess(
			'docker',
			[ ...composeArgs(), 'down', '--volumes' ],
			{ quiet: true }
		);
		for ( const filename of [
			'LocalSettings.php',
			'InstanceSettings.php',
			'wikibase-php.ini',
			'wdqs-frontend-config.json'
		] ) {
			rmSync( join( repositoryRoot, 'config', filename ), { force: true } );
		}
		rmSync( join( repositoryRoot, 'config', '.wikibase-image' ), {
			recursive: true,
			force: true
		} );
	}
	if ( options.environment ) {
		rmSync( envFile, { force: true } );
	}
}
