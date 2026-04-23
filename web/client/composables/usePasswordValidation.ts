import { reactive } from 'vue';
import { PASSWORD_VALIDATION_DEBOUNCE_MS } from '../constants';
import { validatePassword } from '../validation';
import type { FieldValidationStatus } from '../types';

type PasswordFieldName = 'MW_ADMIN_PASS' | 'DB_PASS';
type PasswordStatusMap = Record<PasswordFieldName, FieldValidationStatus>;

export function usePasswordValidation() {
	const statuses = reactive<PasswordStatusMap>( {
		MW_ADMIN_PASS: 'neutral',
		DB_PASS: 'neutral'
	} );

	const timers = new Map<PasswordFieldName, number>();
	const runIds = new Map<PasswordFieldName, number>();

	function clearScheduledValidation( name: PasswordFieldName ): void {
		const timer = timers.get( name );
		if ( timer ) {
			window.clearTimeout( timer );
			timers.delete( name );
		}
	}

	function setStatus( name: PasswordFieldName, status: FieldValidationStatus ): void {
		statuses[ name ] = status;
	}

	async function validateWithServer( password: string ): Promise<boolean> {
		const response = await fetch( '/validate/password', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( { password } )
		} );
		if ( !response.ok ) {
			return false;
		}
		const json = await response.json();
		return json.valid === true;
	}

	async function validateNow( name: PasswordFieldName, value: string ): Promise<FieldValidationStatus> {
		clearScheduledValidation( name );

		const password = value.trim();
		if ( password === '' ) {
			setStatus( name, 'valid' );
			return 'valid';
		}

		const localResult = validatePassword( password );
		if ( !localResult.valid ) {
			setStatus( name, 'invalid' );
			return 'invalid';
		}

		const runId = ( runIds.get( name ) || 0 ) + 1;
		runIds.set( name, runId );
		setStatus( name, 'pending' );

		const status = await validateWithServer( password ) ? 'valid' : 'invalid';
		if ( runIds.get( name ) === runId ) {
			setStatus( name, status );
		}

		return status;
	}

	function scheduleValidation( name: PasswordFieldName, value: string ): void {
		clearScheduledValidation( name );

		const password = value.trim();
		if ( password === '' ) {
			setStatus( name, 'valid' );
			return;
		}

		const localResult = validatePassword( password );
		if ( !localResult.valid ) {
			setStatus( name, 'invalid' );
			return;
		}

		setStatus( name, 'pending' );
		const timer = window.setTimeout( () => {
			void validateNow( name, password );
		}, PASSWORD_VALIDATION_DEBOUNCE_MS );
		timers.set( name, timer );
	}

	return {
		statuses,
		validateNow,
		scheduleValidation
	};
}
