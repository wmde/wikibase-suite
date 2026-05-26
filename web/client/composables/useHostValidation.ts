import { reactive } from 'vue';
import { HOST_VALIDATION_DEBOUNCE_MS } from '../constants';
import { canSkipDnsValidation, isValidSetupHostname } from '../../shared/validation.ts';
import type { FieldValidationStatus } from '../types';

type HostFieldName = 'WIKIBASE_PUBLIC_HOST' | 'WDQS_PUBLIC_HOST';

type HostStatusMap = Record<HostFieldName, FieldValidationStatus>;
type HostValidationResponse = {
	valid?: boolean;
};

export function useHostValidation( isLocalhostSetup = false ) {
	const statuses = reactive<HostStatusMap>( {
		WIKIBASE_PUBLIC_HOST: 'neutral',
		WDQS_PUBLIC_HOST: 'neutral'
	} );

	const timers = new Map<HostFieldName, number>();
	const runIds = new Map<HostFieldName, number>();

	function clearScheduledValidation( name: HostFieldName ): void {
		const timer = timers.get( name );
		if ( timer ) {
			window.clearTimeout( timer );
			timers.delete( name );
		}
	}

	function setStatus( name: HostFieldName, status: FieldValidationStatus ): void {
		statuses[ name ] = status;
	}

	async function doesHostnameResolveToServer( hostname: string ): Promise<boolean> {
		if ( canSkipDnsValidation( hostname, isLocalhostSetup ) ) {
			return true;
		}

		try {
			const response = await fetch( '/validate/hostname', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( { hostname } )
			} );
			if ( !response.ok ) {
				return false;
			}
			const json = await response.json() as HostValidationResponse;
			return json.valid === true;
		} catch {
			return false;
		}
	}

	async function validateNow( name: HostFieldName, value: string ): Promise<FieldValidationStatus> {
		clearScheduledValidation( name );

		const hostname = value.trim();
		if ( !hostname ) {
			setStatus( name, 'invalid' );
			return 'invalid';
		}

		if ( !isValidSetupHostname( hostname, isLocalhostSetup ) ) {
			setStatus( name, 'invalid' );
			return 'invalid';
		}

		const runId = ( runIds.get( name ) || 0 ) + 1;
		runIds.set( name, runId );
		setStatus( name, 'pending' );

		const status = await doesHostnameResolveToServer( hostname ) ? 'valid' : 'invalid';
		if ( runIds.get( name ) === runId ) {
			setStatus( name, status );
		}

		return status;
	}

	function scheduleValidation( name: HostFieldName, value: string ): void {
		clearScheduledValidation( name );

		const hostname = value.trim();
		if ( !hostname ) {
			setStatus( name, 'invalid' );
			return;
		}

		if ( !isValidSetupHostname( hostname, isLocalhostSetup ) ) {
			setStatus( name, 'invalid' );
			return;
		}

		setStatus( name, 'pending' );
		const timer = window.setTimeout( () => {
			void validateNow( name, hostname );
		}, HOST_VALIDATION_DEBOUNCE_MS );
		timers.set( name, timer );
	}

	return {
		statuses,
		validateNow,
		scheduleValidation
	};
}
