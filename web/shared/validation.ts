export type ValidationResult = {
	valid: boolean;
	reason?: string;
};

export const EMAIL_ADDRESS_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const HOST_NAME_REGEX = /^(localhost|([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})$/;

const COMMON_PASSWORD_OVERRIDES = new Set( [
	'change-this-password'
] );

const MEDIAWIKI_INVALID_USERNAME_CHARACTERS = /[@:>=]/;
const IPV4_ADDRESS_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const SAFE_DATABASE_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const SAFE_DATABASE_USER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,79}$/;

function normalizePassword( value: string ): string {
	return value.trim().toLowerCase();
}

export function isValidEmailAddress( value: string ): boolean {
	return EMAIL_ADDRESS_REGEX.test( value.trim() );
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
		return { valid: true };
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
