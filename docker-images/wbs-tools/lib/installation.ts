import { existsSync, rmSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { appendOperationLog, up } from './compose.js';

export async function completeWebInstallation( options: {
	localImages?: boolean;
	build?: boolean;
} ): Promise<void> {
	const requestPath = process.env.LAUNCH_TRIGGER_PATH;
	if ( !requestPath ) {
		throw new Error( 'LAUNCH_TRIGGER_PATH is required by the installation worker.' );
	}
	while ( !existsSync( requestPath ) ) {
		await delay( 500 );
	}
	rmSync( requestPath, { force: true } );
	appendOperationLog( 'Configuration saved.', 'config_saved' );
	appendOperationLog( 'Updating Docker images...', 'images_pull_started' );
	await up( {
		...( options.build ? { build: true } : {
			update: true,
			localImages: options.localImages
		} ),
		onStartingServices: () => appendOperationLog(
			'Starting Docker Compose services. Generally takes 2–6 minutes...',
			'services_waiting'
		)
	} );
	appendOperationLog( 'Docker Compose services reported ready.', 'services_ready' );
	appendOperationLog( 'Installation is complete.', 'setup_complete' );
}
