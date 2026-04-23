import { DEFAULT_FORM } from './constants';
import type { ConfigForm } from './types';

export function deriveWdqsHost( wikibaseHost: string ): string {
	return wikibaseHost.trim() ? `query.${ wikibaseHost.trim() }` : '';
}

export function configToForm( config: Record<string, string> | null | undefined ): ConfigForm {
	return {
		...DEFAULT_FORM,
		...( config || {} ),
		METADATA_CALLBACK: String( config?.METADATA_CALLBACK ?? DEFAULT_FORM.METADATA_CALLBACK ).toLowerCase() === 'true'
	};
}

export function formToPayload( form: ConfigForm ): Record<string, string> {
	return {
		MW_ADMIN_EMAIL: form.MW_ADMIN_EMAIL.trim(),
		WIKIBASE_PUBLIC_HOST: form.WIKIBASE_PUBLIC_HOST.trim(),
		WDQS_PUBLIC_HOST: form.WDQS_PUBLIC_HOST.trim(),
		METADATA_CALLBACK: form.METADATA_CALLBACK ? 'true' : 'false',
		MW_ADMIN_NAME: form.MW_ADMIN_NAME.trim(),
		MW_ADMIN_PASS: form.MW_ADMIN_PASS,
		DB_NAME: form.DB_NAME.trim(),
		DB_USER: form.DB_USER.trim(),
		DB_PASS: form.DB_PASS
	};
}

export async function fetchConfig(): Promise<{ config: Record<string, string>; configText: string } | null> {
	const response = await fetch( '/config' );
	if ( !response.ok ) {
		return null;
	}
	return await response.json();
}

export async function saveConfig( form: ConfigForm ): Promise<{ config: Record<string, string>; configText: string }> {
	const response = await fetch( '/config', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify( formToPayload( form ) )
	} );

	if ( !response.ok ) {
		throw new Error( `Failed to save configuration: HTTP ${ response.status }` );
	}

	return await response.json();
}
