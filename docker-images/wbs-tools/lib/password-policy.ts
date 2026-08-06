import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validatePassword } from './validation.js';
import type { ValidationResult } from './validation.js';

const COMMON_PASSWORDS_FILE_PATH = fileURLToPath(
	new URL( './common-passwords-top-100000.txt', import.meta.url )
);

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
