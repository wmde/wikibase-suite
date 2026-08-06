import { Option, type Command } from 'commander';
import process from 'node:process';
import { completeWebInstallation } from '../lib/installation.js';
import { up } from '../lib/compose.js';
import { getConfig } from '../lib/configuration.js';
import {
	addConfigureOptions,
	configure,
	type ConfigureOptions
} from './configure.js';

function printInstallationComplete(): void {
	const { config } = getConfig();
	const wikibaseUrl = `https://${ config.WIKIBASE_PUBLIC_HOST }`;
	console.log( [
		'',
		'Wikibase Suite is now running.',
		'',
		`  Wikibase:        ${ wikibaseUrl }`,
		`  Query Service:   https://${ config.WDQS_PUBLIC_HOST }`,
		`  QuickStatements: ${ wikibaseUrl }/tools/quickstatements`
	].join( '\n' ) );
}

export function registerInstallCommand( program: Command ): void {
	addConfigureOptions( program.command( 'install' )
		.description( 'Configure and install Wikibase Suite.' ) )
		.addOption( new Option( '--from-source', 'Build and install images from this checkout.' ) )
		.action( async ( options: ConfigureOptions & { fromSource: boolean } ) => {
			await configure( options );
			if ( process.env.WBS_VALIDATE_OPTIONS === 'true' ) {
				return;
			}
			if ( !options.web ) {
				await up( options.fromSource ? { build: true } : { update: true } );
				printInstallationComplete();
			}
		} );

	program.command( 'install-worker', { hidden: true } )
		.option( '--local-images' )
		.option( '--build' )
		.action( completeWebInstallation );
}
