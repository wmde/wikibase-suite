import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnvContent } from './validation.js';
import { runProcess } from './command-runner.js';

export type SuiteOptions = {
	update?: boolean;
	build?: boolean;
	localImages?: boolean;
	onStartingServices?: () => void | Promise<void>;
};

export type ResetOptions = {
	configuration: boolean;
	data: boolean;
};

const repositoryRoot = process.env.WBS_DIR || '/app/wbs';
const envFile = process.env.ENV_FILE_PATH || join( repositoryRoot, '.env' );
const localEnvFile = join( repositoryRoot, 'local.env' );
const REQUIRED_CONFIGURATION_KEYS = [
	'WIKIBASE_PUBLIC_HOST', 'WDQS_PUBLIC_HOST', 'MW_ADMIN_NAME', 'MW_ADMIN_EMAIL',
	'MW_ADMIN_PASS', 'DB_PASS', 'DB_NAME', 'DB_USER'
] as const;

export function missingConfigurationKeys(): string[] {
	if ( !existsSync( envFile ) ) {
		return [ ...REQUIRED_CONFIGURATION_KEYS ];
	}
	const config = parseEnvContent( readFileSync( envFile, 'utf8' ) );
	return REQUIRED_CONFIGURATION_KEYS.filter( ( key ) => !config[ key ]?.trim() );
}

export function configurationExists(): boolean {
	return existsSync( envFile );
}

function composeArgs( localImages = false ): string[] {
	const args = [
		'compose',
		'--project-directory', repositoryRoot,
		'--env-file', envFile
	];
	if ( existsSync( localEnvFile ) ) {
		args.push( '--env-file', localEnvFile );
	}
	args.push( '--file', join( repositoryRoot, 'docker-compose.yml' ) );
	if ( localImages ) {
		args.push( '--file', join( repositoryRoot, 'development/docker-compose.local-images.yml' ) );
	}
	const localOverride = join( repositoryRoot, 'docker-compose.local.yml' );
	if ( existsSync( localOverride ) ) {
		args.push( '--file', localOverride );
	}
	return args;
}

async function buildImages(): Promise<void> {
	const developmentRoot = join( repositoryRoot, 'development' );
	await runProcess( 'docker', [
		'compose', '--project-directory', developmentRoot,
		'--file', join( developmentRoot, 'docker-compose.yml' ),
		'run', '--no-TTY', '--rm', 'wbs-dev', '-c',
		'pnpm exec tsx wbs-dev.ts build'
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
	// Compose needs .env while it removes the instance, so configuration is
	// deliberately deleted only after any requested data reset has completed.
	if ( options.data ) {
		await runProcess( 'docker', [ ...composeArgs(), 'down', '--volumes' ] );
		for ( const filename of [ 'LocalSettings.php', 'wikibase-php.ini', 'wdqs-frontend-config.json' ] ) {
			rmSync( join( repositoryRoot, 'config', filename ), { force: true } );
		}
	}
	if ( options.configuration ) {
		rmSync( envFile, { force: true } );
	}
}

export function appendOperationLog( message: string, code?: string ): void {
	const logPath = process.env.LOG_PATH || join( repositoryRoot, '.wbs/installation.log' );
	mkdirSync( join( repositoryRoot ), { recursive: true } );
	writeFileSync(
		logPath,
		`${ new Date().toISOString() } ${ message }${ code ? ` [${ code }]` : '' }\n`,
		{ flag: 'a' }
	);
}
