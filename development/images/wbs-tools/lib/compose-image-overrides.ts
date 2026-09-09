import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ComposeImageService = {
	service: string;
	image: string;
};

const SUITE_IMAGE_REPOSITORY = 'wikibase/';

function imageRepository( image: string ): string {
	const digest = image.indexOf( '@' );
	if ( digest >= 0 ) return image.slice( 0, digest );
	const slash = image.lastIndexOf( '/' );
	const colon = image.lastIndexOf( ':' );
	return colon > slash ? image.slice( 0, colon ) : image;
}

// Root Compose is intentionally the service authority. The Suite root file uses
// a conventional two-space service mapping and literal image references.
export function composeImageServices( repositoryRoot: string ): ComposeImageService[] {
	const contents = readFileSync( join( repositoryRoot, 'docker-compose.yml' ), 'utf8' );
	let service: string | undefined;
	const services: ComposeImageService[] = [];
	for ( const line of contents.split( '\n' ) ) {
		const serviceMatch = line.match( /^\s{2}([A-Za-z0-9_-]+):\s*$/u );
		if ( serviceMatch ) {
			service = serviceMatch[1];
			continue;
		}
		const imageMatch = service && line.match( /^\s{4}image:\s*([^\s#]+)\s*$/u );
		if ( imageMatch ) services.push( { service, image: imageRepository( imageMatch[1] ) } );
	}
	return services;
}

export function suiteImageServices( repositoryRoot: string ): Array<ComposeImageService & { imageName: string }> {
	return composeImageServices( repositoryRoot ).flatMap( ( service ) => {
		if ( !service.image.startsWith( SUITE_IMAGE_REPOSITORY ) ) return [];
		return [ { ...service, imageName: service.image.slice( SUITE_IMAGE_REPOSITORY.length ) } ];
	} );
}

export function runtimeImageNames( repositoryRoot: string ): string[] {
	return [ ...new Set( suiteImageServices( repositoryRoot ).map( ( service ) => service.imageName ) ) ].sort();
}

export function composeOverride(
	repositoryRoot: string,
	images: Record<string, string>,
	options: { pullPolicy?: 'never' } = {}
): string {
	const services = suiteImageServices( repositoryRoot );
	const missing = services.find( ( service ) => !images[service.imageName] );
	if ( missing ) throw new Error( `No image override supplied for ${ missing.service } (${ missing.imageName }).` );
	return [
		'# Generated from the root Compose service definitions. Do not edit.',
		'services:',
		...services.flatMap( ( service ) => [
			`  ${ service.service }:`,
			`    image: ${ JSON.stringify( images[service.imageName] ) }`,
			...( options.pullPolicy ? [ `    pull_policy: ${ options.pullPolicy }` ] : [] )
		] ),
		''
	].join( '\n' );
}
