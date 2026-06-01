import crypto from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import {
	parseEnvContent,
	serializeEnvContent
} from './shared/validation.js';

export const ENV_FILE_PATH = '/app/deploy/.env';
export const ENV_TEMPLATE_FILE_PATH = '/app/deploy/template.env';
export const DOT_ENV_EXAMPLE_FILE_PATH = '/app/deploy/.env.example';
export const LOCAL_SETTINGS_FILE_PATH = '/app/deploy/config/LocalSettings.php';
export const LAUNCH_TRIGGER_PATH = process.env.LAUNCH_TRIGGER_PATH || '';
export const LOG_PATH = '/app/installation.log';
const DEFAULT_DB_NAME = 'my_wiki';
const DEFAULT_DB_USER = 'sqluser';
const EXISTING_INSTALL_STATES = new Set( [ 'none', 'running', 'previous' ] );

export type ExistingInstallState = 'none' | 'running' | 'previous';

// Status

export function isBooted(): boolean {
	if ( !existsSync( LOG_PATH ) ) {
		return false;
	}
	const log = readFileSync( LOG_PATH, 'utf8' );
	return /(?:Setup|Installation) is complete!/i.test( log );
}

export function isSetupStarted(): boolean {
	if ( LAUNCH_TRIGGER_PATH && existsSync( LAUNCH_TRIGGER_PATH ) ) {
		return true;
	}

	if ( !existsSync( LOG_PATH ) ) {
		return false;
	}

	return readFileSync( LOG_PATH, 'utf8' )
		.split( '\n' )
		.some( ( line ) => {
			const match = line.match( /\s\[([a-z0-9_]+)\]$/i );
			return match !== null && match[ 1 ].toLowerCase() !== 'debug';
		} );
}

export function isConfigSaved(): boolean {
	return existsSync( ENV_FILE_PATH );
}

export function getExistingInstallState(): ExistingInstallState {
	const state = process.env.EXISTING_INSTALL_STATE || '';
	if ( EXISTING_INSTALL_STATES.has( state ) ) {
		return state as ExistingInstallState;
	}

	if ( existsSync( LOCAL_SETTINGS_FILE_PATH ) ) {
		return 'previous';
	}

	return 'none';
}

export function isLocalhostSetup(): boolean {
	return process.env.LOCALHOST === 'true';
}

// Configuration

function getEnv(): Record<string, string> | null {
	if ( !isConfigSaved() ) {
		return null;
	}
	return parseEnvContent( readFileSync( ENV_FILE_PATH, 'utf8' ) );
}

function getTemplateEnv(): Record<string, string> {
	const templatePath = [
		ENV_TEMPLATE_FILE_PATH,
		DOT_ENV_EXAMPLE_FILE_PATH
	].find( ( path ) => existsSync( path ) );
	if ( !templatePath ) {
		throw new Error(
			`No environment template found. Checked: ${ [
				ENV_TEMPLATE_FILE_PATH,
				DOT_ENV_EXAMPLE_FILE_PATH
			].join( ', ' ) }`
		);
	}

	return parseEnvContent( readFileSync( templatePath, 'utf8' ) );
}

function hasAnyInput( input: Record<string, unknown> ): boolean {
	// Any non-empty string counts as input present.
	return Object.values( input ).some( ( v ) => typeof v === 'string' && v !== '' );
}

const generatePassword = (): string => crypto.randomBytes( 12 ).toString( 'base64' );

function makeConfigText( configObject: Record<string, string> ): string {
	return serializeEnvContent( configObject );
}

type ConfigGenerationOptions = {
	generateMissingPasswords?: boolean;
};

function resolvePasswordInput( value: unknown, shouldGenerate: boolean ): string {
	if ( value && value !== '' ) {
		return String( value );
	}

	return shouldGenerate ? generatePassword() : '';
}

export function saveConfigText( configText: string ): void {
	return writeFileSync( ENV_FILE_PATH, configText );
}

export function markConfigReadyForLaunch(): void {
	if ( !LAUNCH_TRIGGER_PATH ) {
		return;
	}

	writeFileSync( LAUNCH_TRIGGER_PATH, new Date().toISOString() );
}

export function getConfig(
	input: Record<string, unknown> = {},
	options: ConfigGenerationOptions = {}
): {
	config: Record<string, string>;
	configText: string;
} {
	// 1) User input present: use exactly. CLI can opt into password generation for blank prompt answers.
	if ( hasAnyInput( input ) ) {
		const templateEnv = getTemplateEnv();
		const shouldGeneratePasswords = options.generateMissingPasswords === true;
		const configObject: Record<string, string> = {
			...templateEnv,
			MW_ADMIN_EMAIL: String( input.MW_ADMIN_EMAIL ?? '' ).trim(),
			WIKIBASE_PUBLIC_HOST: String( input.WIKIBASE_PUBLIC_HOST ?? '' ).trim(),
			WDQS_PUBLIC_HOST: String( input.WDQS_PUBLIC_HOST ?? '' ).trim(),
			METADATA_CALLBACK: String( input.METADATA_CALLBACK ?? 'true' ).trim(),
			MW_ADMIN_NAME: String( input.MW_ADMIN_NAME ?? '' ).trim(),
			MW_ADMIN_PASS: resolvePasswordInput( input.MW_ADMIN_PASS, shouldGeneratePasswords ),
			DB_NAME: input.DB_NAME && input.DB_NAME !== '' ?
				String( input.DB_NAME ).trim() : DEFAULT_DB_NAME,
			DB_USER: input.DB_USER && input.DB_USER !== '' ?
				String( input.DB_USER ).trim() : DEFAULT_DB_USER,
			DB_PASS: resolvePasswordInput( input.DB_PASS, shouldGeneratePasswords )
		};

		return { config: configObject, configText: makeConfigText( configObject ) };
	}

	// 2) Existing .env hydrates the setup form when there is no new submitted input.
	const existingEnv = getEnv();
	if ( existingEnv ) {
		const configObject = {
			...existingEnv,
			DB_NAME: existingEnv.DB_NAME && existingEnv.DB_NAME !== '' ?
				existingEnv.DB_NAME : DEFAULT_DB_NAME,
			DB_USER: existingEnv.DB_USER && existingEnv.DB_USER !== '' ?
				existingEnv.DB_USER : DEFAULT_DB_USER
		};
		return { config: configObject, configText: makeConfigText( configObject ) };
	}

	// 3) No .env and no input: template + localhost defaults.
	const templateEnv = getTemplateEnv();
	const configObject: Record<string, string> = {
		...templateEnv,
		MW_ADMIN_EMAIL: '',
		MW_ADMIN_NAME: '',
		DB_NAME: templateEnv.DB_NAME && templateEnv.DB_NAME !== '' ?
			templateEnv.DB_NAME : DEFAULT_DB_NAME,
		DB_USER: templateEnv.DB_USER && templateEnv.DB_USER !== '' ?
			templateEnv.DB_USER : DEFAULT_DB_USER,
		WIKIBASE_PUBLIC_HOST: isLocalhostSetup() ? 'wikibase.test' : '',
		WDQS_PUBLIC_HOST: isLocalhostSetup() ? 'query.wikibase.test' : '',
		MW_ADMIN_PASS: '',
		DB_PASS: '',
		METADATA_CALLBACK: 'true'
	};

	return { config: configObject, configText: makeConfigText( configObject ) };
}

export function sanitizeConfig(): void {
	if ( isConfigSaved() ) {
		const { configText } = getConfig();
		// blank password values
		const sanitized = configText.replace( /^(\s*[A-Z0-9_]*PASS(?:WORD)?=).+$/gim, '$1' );
		saveConfigText( sanitized );
		console.log( '🧼 Passwords sanitized' );
	}
}

export function clearLog(): void {
	if ( existsSync( LOG_PATH ) ) {
		writeFileSync( LOG_PATH, '' );
		console.log( '🧹 Log cleared' );
	}
}
