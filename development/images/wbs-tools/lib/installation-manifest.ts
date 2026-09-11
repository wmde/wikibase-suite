import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { composeOverride, runtimeImageNames, suiteImageServices } from './compose-image-overrides.js';
import { composeConfiguration } from './compose.js';

const WBS_TOOLS_IMAGE = 'wbs-tools';
const COMMIT_SHA = /^[0-9a-f]{40}$/u;

type InstallationManifest = {
	schemaVersion: number;
	source: {
		commit: string;
	};
	images: Record<string, string>;
};

function assertManifest( value: unknown, required: string[] ): InstallationManifest {
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
	const missing = required.filter( ( name ) => !( name in manifest.images! ) );
	if ( missing.length ) {
		throw new Error( `Installation manifest is missing required images: ${ missing.join( ', ' ) }.` );
	}
	for ( const [ name, image ] of Object.entries( manifest.images ) ) {
		if ( typeof image !== 'string' || !image.trim() || /[\r\n]/u.test( image ) ) {
			throw new Error( `Installation manifest has an invalid ${ name } image.` );
		}
	}
	return manifest as InstallationManifest;
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
	const services = suiteImageServices( await composeConfiguration( options.repositoryRoot ) );
	const installationManifest = assertManifest(
		manifest,
		[ ...runtimeImageNames( services ), WBS_TOOLS_IMAGE ]
	);
	if ( installationManifest.source.commit !== options.resolvedSha ) {
		throw new Error( `Installation manifest does not match checkout ${ options.resolvedSha }.` );
	}

	const overridePath = join( options.repositoryRoot, 'docker-compose.override.yml' );
	if ( existsSync( overridePath ) ) {
		throw new Error( `${ overridePath } already exists; refusing to replace it.` );
	}
	writeFileSync(
		overridePath,
		composeOverride( services, installationManifest.images ),
		{ mode: 0o644 }
	);
	mkdirSync( join( options.repositoryRoot, '.wbs' ), { recursive: true } );
	writeFileSync(
		join( options.repositoryRoot, '.wbs/install.env' ),
		[
			'# Generated from a Wikibase Suite installation manifest. Do not edit.',
			`WBS_INSTALL_MANIFEST_URL=${ shellValue( url.toString() ) }`,
			`WBS_INSTALL_SOURCE_COMMIT=${ shellValue( installationManifest.source.commit ) }`,
			`WBS_TOOLS_IMAGE=${ shellValue( installationManifest.images[ WBS_TOOLS_IMAGE ] ) }`,
			''
		].join( '\n' ),
		{ mode: 0o600 }
	);
	console.log( `Applied installation manifest for ${ options.resolvedSha }.` );
}
