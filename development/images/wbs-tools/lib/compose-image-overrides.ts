import type { ComposeConfiguration } from './compose.js';

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

export function composeImageServices( config: ComposeConfiguration ): ComposeImageService[] {
	return Object.entries( config.services ?? {} ).flatMap( ( [ service, definition ] ) =>
		typeof definition.image === 'string' ?
			[ { service, image: imageRepository( definition.image ) } ] : []
	);
}

export function suiteImageServices( config: ComposeConfiguration ): Array<ComposeImageService & { imageName: string }> {
	return composeImageServices( config ).flatMap( ( service ) => {
		if ( !service.image.startsWith( SUITE_IMAGE_REPOSITORY ) ) return [];
		return [ { ...service, imageName: service.image.slice( SUITE_IMAGE_REPOSITORY.length ) } ];
	} );
}

export function runtimeImageNames( services: Array<ComposeImageService & { imageName: string }> ): string[] {
	return [ ...new Set( services.map( ( service ) => service.imageName ) ) ].sort();
}

export function composeOverride(
	services: Array<ComposeImageService & { imageName: string }>,
	images: Record<string, string>,
	options: { pullPolicy?: 'never' } = {}
): string {
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
