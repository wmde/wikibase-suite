import { reactive } from 'vue';
import {
	HOST_NAME_REGEX,
	HOST_VALIDATION_DEBOUNCE_MS
} from '../constants';
import type { FieldValidationStatus } from '../types';

type HostFieldName = 'WIKIBASE_PUBLIC_HOST' | 'WDQS_PUBLIC_HOST';

type HostStatusMap = Record<HostFieldName, FieldValidationStatus>;

export function useHostValidation( serverIp: string ) {
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
		if ( hostname === 'localhost' || /\.test$/i.test( hostname ) ) {
			return true;
		}

		try {
			const response = await fetch(
				`https://dns.google/resolve?name=${ encodeURIComponent( hostname ) }&type=A`
			);
			if ( !response.ok ) {
				return false;
			}
			const json = await response.json();
			const answers = Array.isArray( json?.Answer ) ? json.Answer : [];
			return answers.some( ( answer ) => answer.type === 1 && answer.data === serverIp );
		} catch {
			return false;
		}
	}

	async function validateNow( name: HostFieldName, value: string ): Promise<FieldValidationStatus> {
		clearScheduledValidation( name );

		const hostname = value.trim();
		if ( !hostname ) {
			setStatus( name, 'neutral' );
			return 'neutral';
		}

		if ( !HOST_NAME_REGEX.test( hostname ) ) {
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
			setStatus( name, 'neutral' );
			return;
		}

		if ( !HOST_NAME_REGEX.test( hostname ) ) {
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
