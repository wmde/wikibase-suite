import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { composeOverride, runtimeImageNames } from './compose-image-overrides.js';

const WBS_TOOLS_IMAGE = 'wbs-tools';
const COMMIT_SHA = /^[0-9a-f]{40}$/u;

type InstallationManifest = {
	schemaVersion: number;
	source: {
		commit: string;
	};
	images: Record<string, string>;
};

function assertManifest( value: unknown, repositoryRoot: string ): asserts value is InstallationManifest {
	if ( !value || typeof value !== 'object' ) {
		throw new Error( 'Installation manifest must be a JSON object.' );
	}
	const manifest = value as Partial<InstallationManifest>;
	if ( manifest.schemaVersion !== 1 ) {
		throw new Error( 'Unsupported installation manifest.' );
	}
	if ( !manifest.source || !COMMIT_SHA.test( manifest.source.commit ) ) {
		throw new Error( 'Installation manifest has an invalid source commit.' );
	}
	if ( !manifest.images || typeof manifest.images !== 'object' || Array.isArray( manifest.images ) ) {
		throw new Error( 'Installation manifest does not contain an image set.' );
	}
	const required = [ ...runtimeImageNames( repositoryRoot ), WBS_TOOLS_IMAGE ];
	const missing = required.filter( ( name ) => !( name in manifest.images! ) );
	if ( missing.length ) {
		throw new Error( `Installation manifest is missing required images: ${ missing.join( ', ' ) }.` );
	}
	for ( const [ name, image ] of Object.entries( manifest.images ) ) {
		if ( typeof image !== 'string' || !image.trim() || /[\r\n]/u.test( image ) ) {
			throw new Error( `Installation manifest has an invalid ${ name } image.` );
		}
	}
}

function shellValue( value: string ): string {
	return `'${ value.replaceAll( "'", `'"'"'` ) }'`;
}

export async function applyInstallationManifest( options: {
	repositoryRoot: string;
	manifestUrl: string;
	resolvedSha: string;
} ): Promise<void> {
	const url = new URL( options.manifestUrl );
	if ( url.protocol !== 'https:' ) {
		throw new Error( 'Installation manifest URL must use HTTPS.' );
	}
	const response = await fetch( url );
	if ( !response.ok ) {
		throw new Error( `Could not download installation manifest: HTTP ${ response.status }.` );
	}
	const manifest: unknown = await response.json();
	assertManifest( manifest, options.repositoryRoot );
	if ( manifest.source.commit !== options.resolvedSha ) {
		throw new Error( `Installation manifest does not match checkout ${ options.resolvedSha }.` );
	}

	const overridePath = join( options.repositoryRoot, 'docker-compose.override.yml' );
	if ( existsSync( overridePath ) ) {
		throw new Error( `${ overridePath } already exists; refusing to replace it.` );
	}
	writeFileSync( overridePath, composeOverride( options.repositoryRoot, manifest.images ), { mode: 0o644 } );
	mkdirSync( join( options.repositoryRoot, '.wbs' ), { recursive: true } );
	writeFileSync(
		join( options.repositoryRoot, '.wbs/install.env' ),
		[
			'# Generated from a Wikibase Suite installation manifest. Do not edit.',
			`WBS_INSTALL_MANIFEST_URL=${ shellValue( url.toString() ) }`,
			`WBS_INSTALL_SOURCE_COMMIT=${ shellValue( manifest.source.commit ) }`,
			`WBS_TOOLS_IMAGE=${ shellValue( manifest.images[ WBS_TOOLS_IMAGE ] ) }`,
			''
		].join( '\n' ),
		{ mode: 0o600 }
	);
	console.log( `Applied installation manifest for ${ options.resolvedSha }.` );
}
