import crypto from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import {
	parseEnvContent,
	serializeEnvContent
} from './shared/validation.js';

export const ENV_FILE_PATH = '/app/deploy/.env';
export const ENV_TEMPLATE_FILE_PATH = '/app/deploy/template.env';
export const LOG_PATH = '/app/setup.log';
const DEFAULT_MW_ADMIN_NAME = 'Admin';
const DEFAULT_DB_NAME = 'my_wiki';
const DEFAULT_DB_USER = 'sqluser';

// Status

export function isBooted(): boolean {
	if ( !existsSync( LOG_PATH ) ) {
		return false;
	}
	const log = readFileSync( LOG_PATH, 'utf8' );
	return /Setup is Complete!/i.test( log );
}

export function isConfigSaved(): boolean {
	return existsSync( ENV_FILE_PATH );
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
	return parseEnvContent( readFileSync( ENV_TEMPLATE_FILE_PATH, 'utf8' ) );
}

function hasAnyInput( input: Record<string, unknown> ): boolean {
	// Any non-empty string counts as “input present”
	return Object.values( input ).some( ( v ) => typeof v === 'string' && v !== '' );
}

const generatePassword = (): string => crypto.randomBytes( 12 ).toString( 'base64' );

function makeConfigText( configObject: Record<string, string> ): string {
	return serializeEnvContent( configObject );
}
export function saveConfigText( configText: string ): void {
	return writeFileSync( ENV_FILE_PATH, configText );
}

export function getConfig( input: Record<string, unknown> = {} ): {
	config: Record<string, string>;
	configText: string;
} {
	// 1) Existing .env wins verbatim
	const existingEnv = getEnv();
	if ( existingEnv ) {
		const configObject = {
			...existingEnv,
			MW_ADMIN_NAME: existingEnv.MW_ADMIN_NAME && existingEnv.MW_ADMIN_NAME !== '' ?
				existingEnv.MW_ADMIN_NAME : DEFAULT_MW_ADMIN_NAME,
			DB_NAME: existingEnv.DB_NAME && existingEnv.DB_NAME !== '' ?
				existingEnv.DB_NAME : DEFAULT_DB_NAME,
			DB_USER: existingEnv.DB_USER && existingEnv.DB_USER !== '' ?
				existingEnv.DB_USER : DEFAULT_DB_USER
		};
		return { config: configObject, configText: makeConfigText( configObject ) };
	}

	// 2) User input present → use exactly; passwords autogenerate if blank/missing
	if ( hasAnyInput( input ) ) {
		const templateEnv = getTemplateEnv();
		const configObject: Record<string, string> = {
			...templateEnv,
			MW_ADMIN_EMAIL: String( input.MW_ADMIN_EMAIL ?? '' ).trim(),
			WIKIBASE_PUBLIC_HOST: String( input.WIKIBASE_PUBLIC_HOST ?? '' ).trim(),
			WDQS_PUBLIC_HOST: String( input.WDQS_PUBLIC_HOST ?? '' ).trim(),
			METADATA_CALLBACK: String( input.METADATA_CALLBACK ?? 'true' ).trim(),
			MW_ADMIN_NAME: input.MW_ADMIN_NAME && input.MW_ADMIN_NAME !== '' ?
				String( input.MW_ADMIN_NAME ).trim() : DEFAULT_MW_ADMIN_NAME,
			MW_ADMIN_PASS: input.MW_ADMIN_PASS && input.MW_ADMIN_PASS !== '' ?
				String( input.MW_ADMIN_PASS ) : generatePassword(),
			DB_NAME: input.DB_NAME && input.DB_NAME !== '' ?
				String( input.DB_NAME ).trim() : DEFAULT_DB_NAME,
			DB_USER: input.DB_USER && input.DB_USER !== '' ?
				String( input.DB_USER ).trim() : DEFAULT_DB_USER,
			DB_PASS: input.DB_PASS && input.DB_PASS !== '' ?
				String( input.DB_PASS ) : generatePassword()
		};

		return { config: configObject, configText: makeConfigText( configObject ) };
	// 3) No .env and no input → template + localhost defaults + generated passwords
	} else {
		const templateEnv = getTemplateEnv();
		const configObject: Record<string, string> = {
			...templateEnv,
			MW_ADMIN_EMAIL: '',
			MW_ADMIN_NAME: templateEnv.MW_ADMIN_NAME && templateEnv.MW_ADMIN_NAME !== '' ?
				templateEnv.MW_ADMIN_NAME : DEFAULT_MW_ADMIN_NAME,
			DB_NAME: templateEnv.DB_NAME && templateEnv.DB_NAME !== '' ?
				templateEnv.DB_NAME : DEFAULT_DB_NAME,
			DB_USER: templateEnv.DB_USER && templateEnv.DB_USER !== '' ?
				templateEnv.DB_USER : DEFAULT_DB_USER,
			WIKIBASE_PUBLIC_HOST: isLocalhostSetup() ? 'wikibase.test' : '',
			WDQS_PUBLIC_HOST: isLocalhostSetup() ? 'query.wikibase.test' : '',
			MW_ADMIN_PASS: generatePassword(),
			DB_PASS: generatePassword(),
			METADATA_CALLBACK: 'true'
		};

		return { config: configObject, configText: makeConfigText( configObject ) };
	}
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
