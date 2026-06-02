import { parse as parseDomain } from 'tldts';

export type ValidationResult = {
	valid: boolean;
	reason?: string;
};

export const SETUP_CONFIG_FIELDS = [
	'MW_ADMIN_EMAIL',
	'WIKIBASE_PUBLIC_HOST',
	'WDQS_PUBLIC_HOST',
	'METADATA_CALLBACK',
	'MW_ADMIN_NAME',
	'MW_ADMIN_PASS',
	'DB_NAME',
	'DB_USER',
	'DB_PASS'
] as const;

export type SetupConfigField = typeof SETUP_CONFIG_FIELDS[number];

export type SetupConfigValidationIssue = {
	field?: SetupConfigField;
	code: string;
	message: string;
};

export type SetupConfigValidationOptions = {
	isLocalhostSetup?: boolean;
	passwordValidator?: ( value: string ) => ValidationResult;
};

export const EMAIL_ADDRESS_REGEX = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;
export const HOST_NAME_REGEX = /^(localhost|([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})$/;

const COMMON_PASSWORD_OVERRIDES = new Set( [
	'change-this-password'
] );

const MEDIAWIKI_INVALID_USERNAME_CHARACTERS = /[@:>=]/;
const IPV4_ADDRESS_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const SAFE_DATABASE_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const SAFE_DATABASE_USER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,79}$/;
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ENV_LINE_PATTERN = /^([^#=\s]+)=(.*)$/;
const SAFE_UNQUOTED_ENV_VALUE_PATTERN = /^[A-Za-z0-9_./:@%+=-]*$/;

function normalizePassword( value: string ): string {
	return value.trim().toLowerCase();
}

export function isValidEmailAddress( value: string ): boolean {
	const emailAddress = value.trim();
	if ( !EMAIL_ADDRESS_REGEX.test( emailAddress ) ) {
		return false;
	}

	const domain = emailAddress.slice( emailAddress.lastIndexOf( '@' ) + 1 ).toLowerCase();
	const parsedDomain = parseDomain( domain, { extractHostname: false } );
	return parsedDomain.hostname !== null && parsedDomain.isIcann === true;
}

export function isLocalTestHostname( value: string ): boolean {
	const hostname = value.trim().toLowerCase();
	return hostname === 'localhost' || /\.test$/i.test( hostname );
}

export function canSkipDnsValidation(
	value: string,
	isLocalhostSetup = false
): boolean {
	return isLocalhostSetup && isLocalTestHostname( value );
}

export function isValidSetupHostname(
	value: string,
	isLocalhostSetup = false
): boolean {
	const hostname = value.trim();
	if ( !HOST_NAME_REGEX.test( hostname ) ) {
		return false;
	}
	return isLocalhostSetup || !isLocalTestHostname( hostname );
}

export function areSetupHostsDistinct(
	wikibaseHost: string,
	queryServiceHost: string
): boolean {
	return wikibaseHost.trim().toLowerCase() !== queryServiceHost.trim().toLowerCase();
}

export function isValidAdminUsername( value: string ): boolean {
	const username = value.trim();
	return username.length > 3 &&
		username.length <= 255 &&
		!MEDIAWIKI_INVALID_USERNAME_CHARACTERS.test( username ) &&
		!IPV4_ADDRESS_PATTERN.test( username );
}

export function isValidDatabaseName( value: string ): boolean {
	return SAFE_DATABASE_IDENTIFIER_PATTERN.test( value.trim() );
}

export function isValidDatabaseUser( value: string ): boolean {
	const username = value.trim();
	return username.length > 3 &&
		SAFE_DATABASE_USER_PATTERN.test( username );
}

export function validatePassword(
	value: string,
	commonPasswords: ReadonlySet<string> = COMMON_PASSWORD_OVERRIDES
): ValidationResult {
	const password = value.trim();
	if ( password.length === 0 ) {
		return { valid: false, reason: 'empty-password' };
	}

	if ( password.length < 10 ) {
		return { valid: false, reason: 'too-short' };
	}

	if ( password.length > 4096 ) {
		return { valid: false, reason: 'too-long' };
	}

	if ( commonPasswords.has( normalizePassword( password ) ) ||
		COMMON_PASSWORD_OVERRIDES.has( normalizePassword( password ) )
	) {
		return { valid: false, reason: 'common-password' };
	}

	return { valid: true };
}

export function isValidPassword(
	value: string,
	commonPasswords?: ReadonlySet<string>
): boolean {
	return validatePassword( value, commonPasswords ).valid;
}

export function validateSetupConfig(
	input: Record<string, unknown>,
	options: SetupConfigValidationOptions = {}
): SetupConfigValidationIssue[] {
	const issues: SetupConfigValidationIssue[] = [];
	const isLocalhost = options.isLocalhostSetup ?? false;
	const validateConfigPassword = options.passwordValidator ?? validatePassword;
	const config = normalizeSetupConfig( input );

	if ( !isValidEmailAddress( config.MW_ADMIN_EMAIL ) ) {
		issues.push( {
			field: 'MW_ADMIN_EMAIL',
			code: 'invalid-email',
			message: 'Admin email address must be valid.'
		} );
	}

	if ( !isValidSetupHostname( config.WIKIBASE_PUBLIC_HOST, isLocalhost ) ) {
		issues.push( {
			field: 'WIKIBASE_PUBLIC_HOST',
			code: 'invalid-hostname',
			message: isLocalhost ?
				'Wikibase host must be a valid host name.' :
				'Wikibase host must be a public host name.'
		} );
	}

	if ( !isValidSetupHostname( config.WDQS_PUBLIC_HOST, isLocalhost ) ) {
		issues.push( {
			field: 'WDQS_PUBLIC_HOST',
			code: 'invalid-hostname',
			message: isLocalhost ?
				'Query Service host must be a valid host name.' :
				'Query Service host must be a public host name.'
		} );
	}

	if ( !areSetupHostsDistinct( config.WIKIBASE_PUBLIC_HOST, config.WDQS_PUBLIC_HOST ) ) {
		issues.push( {
			field: 'WDQS_PUBLIC_HOST',
			code: 'duplicate-hostname',
			message: 'Query Service host must be different from the Wikibase host.'
		} );
	}

	if ( !isValidAdminUsername( config.MW_ADMIN_NAME ) ) {
		issues.push( {
			field: 'MW_ADMIN_NAME',
			code: 'invalid-admin-username',
			message: 'Admin username must use MediaWiki-compatible characters.'
		} );
	}

	const adminPasswordValidation = validateConfigPassword( config.MW_ADMIN_PASS );
	if ( !adminPasswordValidation.valid ) {
		issues.push( {
			field: 'MW_ADMIN_PASS',
			code: adminPasswordValidation.reason || 'invalid-password',
			message: 'Admin password must be entered or generated and meet the password policy.'
		} );
	}

	if ( !isValidDatabaseName( config.DB_NAME ) ) {
		issues.push( {
			field: 'DB_NAME',
			code: 'invalid-database-name',
			message: 'Database name must use letters, numbers, and underscores.'
		} );
	}

	if ( !isValidDatabaseUser( config.DB_USER ) ) {
		issues.push( {
			field: 'DB_USER',
			code: 'invalid-database-user',
			message: 'Database user must use letters, numbers, and underscores.'
		} );
	}

	const databasePasswordValidation = validateConfigPassword( config.DB_PASS );
	if ( !databasePasswordValidation.valid ) {
		issues.push( {
			field: 'DB_PASS',
			code: databasePasswordValidation.reason || 'invalid-password',
			message: 'Database password must be entered or generated and meet the password policy.'
		} );
	}

	if ( ![ 'true', 'false' ].includes( config.METADATA_CALLBACK.toLowerCase() ) ) {
		issues.push( {
			field: 'METADATA_CALLBACK',
			code: 'invalid-boolean',
			message: 'Metadata directory preference must be true or false.'
		} );
	}

	return issues;
}

export function normalizeSetupConfig( input: Record<string, unknown> ): Record<SetupConfigField, string> {
	return SETUP_CONFIG_FIELDS.reduce( ( normalized, field ) => {
		normalized[ field ] = String( input[ field ] ?? '' ).trim();
		return normalized;
	}, {} as Record<SetupConfigField, string> );
}

export function parseEnvContent( content: string ): Record<string, string> {
	const env: Record<string, string> = {};
	for ( const line of content.split( '\n' ) ) {
		const match = line.match( ENV_LINE_PATTERN );
		if ( match ) {
			env[ match[ 1 ] ] = parseEnvValue( match[ 2 ] );
		}
	}
	return env;
}

export function serializeEnvContent( configObject: Record<string, unknown> ): string {
	const header = '# Autogenerated from Wikibase Suite Installer';
	const lines = Object.entries( configObject ).map( ( [ key, value ] ) => (
		`${ serializeEnvKey( key ) }=${ serializeEnvValue( String( value ?? '' ) ) }`
	) );
	return `${ header }\n${ lines.join( '\n' ) }\n`;
}

function serializeEnvKey( key: string ): string {
	if ( !ENV_KEY_PATTERN.test( key ) ) {
		throw new Error( `Invalid environment variable name: ${ key }` );
	}
	return key;
}

function serializeEnvValue( value: string ): string {
	if ( SAFE_UNQUOTED_ENV_VALUE_PATTERN.test( value ) ) {
		return value;
	}

	return `"${ value
		.replace( /\\/g, '\\\\' )
		.replace( /"/g, '\\"' )
		.replace( /\$/g, '\\$' )
		.replace( /`/g, '\\`' )
		.replace( /\r/g, '\\r' )
		.replace( /\n/g, '\\n' ) }"`;
}

function parseEnvValue( rawValue: string ): string {
	const value = rawValue.trim();
	if ( value.length < 2 || !value.startsWith( '"' ) || !value.endsWith( '"' ) ) {
		return rawValue;
	}

	let parsed = '';
	for ( let index = 1; index < value.length - 1; index++ ) {
		const character = value[ index ];
		if ( character !== '\\' || index === value.length - 2 ) {
			parsed += character;
			continue;
		}

		const nextCharacter = value[ index + 1 ];
		index++;
		if ( nextCharacter === 'n' ) {
			parsed += '\n';
		} else if ( nextCharacter === 'r' ) {
			parsed += '\r';
		} else {
			parsed += nextCharacter;
		}
	}

	return parsed;
}
