import { Option, type Command } from 'commander';
import type { RepositoryContext } from '../../lib/context.js';
import { runInstallerDevWeb } from './web.js';

export function registerInstallerDevCommand(
	program: Command,
	context: RepositoryContext
): void {
	const installerDev = program
		.command( 'installer-dev' )
		.description( 'Develop and manually exercise the WBS installer.' )
		.addHelpText(
			'after',
			[
				'',
				'The web command runs the installer from the current checkout with live reload.',
				'By default it performs a real local installation. Use --mock for UI and UX',
				'work without changing configuration or services.',
				'',
				'Examples:',
				'  wbs-dev installer-dev web',
				'  wbs-dev installer-dev web --mock'
			].join( '\n' )
		);

	installerDev
		.command( 'web' )
		.description( 'Start the browser installer with live reload.' )
		.addOption(
			new Option( '--mock [outcome]', 'Simulate installation without starting Suite services.' )
				.choices( [ 'success', 'failure' ] )
				.preset( 'success' )
		)
		.addHelpText(
			'after',
			[
				'',
				'Default behavior:',
				'  Builds all local Suite images, serves the installer at https://localhost:8888,',
				'  uses local test domains, writes the repository-root .env, and runs the normal',
				'  host launch scripts to start a real Suite instance. Installer steps follow the',
				'  same sequence available to an installing user and cannot be skipped.',
				'',
				'Mock behavior:',
				'  Uses the same live development server, makes installer steps directly navigable,',
				'  and retains normal form validation. Starting installation streams an accelerated',
				'  simulated image-pull and service-startup log. The default outcome is success;',
				'  use --mock failure to preview and exercise the installation failure screen.',
				'  Mock mode does not write .env, signal the host launcher, or start Suite services.',
				'',
				'Examples:',
				'  wbs-dev installer-dev web',
				'  wbs-dev installer-dev web --mock',
				'  wbs-dev installer-dev web --mock failure'
			].join( '\n' )
		)
		.action( async ( options: { mock?: 'success' | 'failure' } ) =>
			await runInstallerDevWeb( context, { mock: options.mock } )
		);
}
