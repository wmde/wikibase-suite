import { existsSync, rmSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { up } from './compose.js';
import { appendInstallationLog } from './installation-log.js';

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
	appendInstallationLog( 'Configuration saved.', 'config_saved' );
	appendInstallationLog( 'Updating Docker images...', 'images_pull_started' );
	try {
		await up( {
			...( options.build ? { build: true } : {
				update: true,
				localImages: options.localImages
			} ),
			onStartingServices: () => appendInstallationLog(
				'Starting Docker Compose services. Generally takes 2–6 minutes...',
				'services_waiting'
			)
		} );
	} catch ( error ) {
		const detail = error instanceof Error ? error.message : String( error );
		appendInstallationLog( `Installation failed: ${ detail }`, 'installation_failed' );
		throw error;
	}
	appendInstallationLog( 'Docker Compose services reported ready.', 'services_ready' );
	appendInstallationLog( 'Installation is complete.', 'installation_complete' );
}
