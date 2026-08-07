import { confirm, isCancel } from '@clack/prompts';
import { Option, type Command } from 'commander';
import process from 'node:process';
import { configurationExists, reset } from '../lib/compose.js';

type ResetOptions = {
	force?: boolean;
};

async function resetSuite( options: ResetOptions ): Promise<void> {
	let deleteEnvironment = options.force === true;
	let deleteData = options.force === true;
	if ( options.force !== true ) {
		if ( !process.stdin.isTTY ) {
			throw new Error( 'reset requires confirmation; rerun with --force for automation.' );
		}
		const dataAnswer = await confirm( {
			message: 'Permanently delete all Wikibase Suite services, data, and generated runtime configuration files?',
			initialValue: false
		} );
		if ( isCancel( dataAnswer ) ) {
			console.log( 'Reset canceled.' );
			return;
		}
		deleteData = dataAnswer;
		if ( !deleteData ) {
			console.log( 'Nothing was reset.' );
			return;
		}
		if ( configurationExists() ) {
			const environmentAnswer = await confirm( {
				message: 'Also delete the saved installer configuration in .env?',
				initialValue: false
			} );
			if ( isCancel( environmentAnswer ) ) {
				console.log( 'Reset canceled.' );
				return;
			}
			deleteEnvironment = environmentAnswer;
		}
	}
	await reset( {
		environment: deleteEnvironment,
		data: deleteData
	} );
	if ( deleteData ) {
		console.log( 'Wikibase Suite services, data, and generated runtime configuration files were removed.' );
	}
	if ( deleteEnvironment ) {
		console.log( 'Wikibase Suite .env configuration was removed.' );
	}
}

export function registerResetCommand( program: Command ): void {
	program.command( 'reset' )
		.description( 'Reset Suite services, data, and generated runtime configuration, optionally including .env.' )
		.addOption( new Option( '--force', 'Delete services, data, generated runtime configuration, and .env without prompting.' ) )
		.action( resetSuite );
}
