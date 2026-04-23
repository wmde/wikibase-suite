import { readFileSync } from 'fs';
import { validatePassword } from './shared/validation.js';
import type { ValidationResult } from './shared/validation.js';

const COMMON_PASSWORDS_FILE_PATH = new URL( './data/common-passwords-top-100000.txt', import.meta.url );

let commonPasswords: Set<string> | null = null;

function loadCommonPasswords(): Set<string> {
	if ( commonPasswords ) {
		return commonPasswords;
	}

	commonPasswords = new Set(
		readFileSync( COMMON_PASSWORDS_FILE_PATH, 'utf8' )
			.split( '\n' )
			.map( ( password ) => password.trim().toLowerCase() )
			.filter( Boolean )
	);

	return commonPasswords;
}

export function validateSetupPassword( password: string ): ValidationResult {
	return validatePassword( password, loadCommonPasswords() );
}
