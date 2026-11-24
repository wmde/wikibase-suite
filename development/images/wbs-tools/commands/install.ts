import { Option, type Command } from 'commander';
import { completeWebInstallation } from '../lib/installation.js';
import { up } from '../lib/compose.js';
import { getConfig, sanitizeConfig } from '../lib/configuration.js';
import {
	addConfigureOptions,
	configure,
	registerConfigureCommand,
	type ConfigureResult,
	type ConfigureOptions
} from './configure.js';
import { registerPrepareCommand } from './prepare.js';

function printInstallationComplete( configuration: ConfigureResult ): void {
	const { config } = getConfig();
	const wikibaseUrl = `https://${ config.WIKIBASE_PUBLIC_HOST }`;
	const generatedCredentials: string[] = [];
	if ( configuration.generatedPasswords.admin ) {
		generatedCredentials.push(
			`  Admin username:    ${ config.MW_ADMIN_NAME }`,
			`  Admin password:    ${ config.MW_ADMIN_PASS }`
		);
	}
	if ( configuration.generatedPasswords.database ) {
		generatedCredentials.push(
			`  Database username: ${ config.DB_USER }`,
			`  Database password: ${ config.DB_PASS }`
		);
	}
	sanitizeConfig( { announce: false } );
	const generatedPasswordCount = Number( configuration.generatedPasswords.admin ) +
		Number( configuration.generatedPasswords.database );
	const generatedPasswordReference = generatedPasswordCount === 1 ?
		'This generated password' : 'These generated passwords';
	const credentialNotice = generatedPasswordCount ? [
		`Save the generated credential${ generatedPasswordCount === 1 ? '' : 's' } below in a secure place.`,
		'All passwords have been removed from the saved configuration. ' +
			`${ generatedPasswordReference } will not be shown again.`,
		'',
		...generatedCredentials
	] : [
		'Keep the passwords you chose in a secure place. They have been removed from the saved configuration.'
	];
	console.log( [
		'',
		'Wikibase Suite is now running.',
		'',
		...credentialNotice,
		'',
		`  Wikibase:        ${ wikibaseUrl }`,
		`  Query Service:   https://${ config.WDQS_PUBLIC_HOST }`,
		`  QuickStatements 3: ${ wikibaseUrl }/tools/quickstatements3`
	].join( '\n' ) );
}

export function registerInstallCommand( program: Command ): void {
	const install = addConfigureOptions( program.command( 'install' )
		.description( 'Configure and install Wikibase Suite.' ) )
		.addOption( new Option( '--from-source', 'Build and install images from this checkout.' ) )
		.action( async ( options: ConfigureOptions & { fromSource: boolean } ) => {
			const configuration = await configure( { ...options, build: options.fromSource } );
			if ( !configuration ) {
				return;
			}
			if ( !options.web ) {
				await up( options.fromSource ? { build: true } : { update: true } );
				printInstallationComplete( configuration );
			}
		} );

	registerConfigureCommand( install );
	registerPrepareCommand( install );

	install.command( 'worker', { hidden: true } )
		.option( '--local-images' )
		.option( '--build' )
		.action( completeWebInstallation );

	install.command( 'web-server', { hidden: true } )
		.action( async () => {
			await import( '../web/server.js' );
		} );
}
