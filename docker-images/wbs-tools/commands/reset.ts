import { confirm, isCancel } from '@clack/prompts';
import { Option, type Command } from 'commander';
import process from 'node:process';
import { configurationExists, reset } from '../lib/compose.js';

type ResetOptions = {
	force?: boolean;
};

async function resetSuite( options: ResetOptions ): Promise<void> {
	let deleteConfiguration = options.force === true;
	let deleteData = options.force === true;
	if ( options.force !== true ) {
		if ( !process.stdin.isTTY ) {
			throw new Error( 'reset requires confirmation; rerun with --force for automation.' );
		}
		if ( configurationExists() ) {
			const configurationAnswer = await confirm( {
				message: 'Delete the current Wikibase Suite configuration in .env?',
				initialValue: false
			} );
			if ( isCancel( configurationAnswer ) ) {
				console.log( 'Reset canceled.' );
				return;
			}
			deleteConfiguration = configurationAnswer;
		}
		const dataAnswer = await confirm( {
			message: 'Permanently delete all Wikibase Suite services and data?',
			initialValue: false
		} );
		if ( isCancel( dataAnswer ) ) {
			console.log( 'Reset canceled.' );
			return;
		}
		deleteData = dataAnswer;
	}
	if ( !deleteConfiguration && !deleteData ) {
		console.log( 'Nothing was reset.' );
		return;
	}
	await reset( {
		configuration: deleteConfiguration,
		data: deleteData
	} );
	if ( deleteConfiguration ) {
		console.log( 'Wikibase Suite .env configuration was removed.' );
	}
	if ( deleteData ) {
		console.log( 'Wikibase Suite services, data, and generated runtime files were removed.' );
	}
}

export function registerResetCommand( program: Command ): void {
	program.command( 'reset' )
		.description( 'Delete Suite configuration, services, and data.' )
		.addOption( new Option( '--force', 'Delete both configuration and data without prompting.' ) )
		.action( resetSuite );
}
