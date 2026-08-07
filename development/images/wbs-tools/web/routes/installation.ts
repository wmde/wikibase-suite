import { createSession } from 'better-sse';
import express, { type Router } from 'express';
import type { InstallerLifecycle } from '../installer-lifecycle.js';
import { createLogStreamer } from '../log-streamer.js';

export function createInstallationRouter(
	wbsLogPath: string,
	installationLogPath: string,
	installerLifecycle: InstallerLifecycle
): Router {
	const router = express.Router();
	const wbsLogStreamer = createLogStreamer( wbsLogPath );
	const installationLogStreamer = createLogStreamer( installationLogPath );
	wbsLogStreamer.start();
	installationLogStreamer.start();

	router.get( '/log/stream', async ( req, res ) => {
		const session = await createSession( req, res );
		const lastId = typeof req.headers[ 'last-event-id' ] === 'string' ?
			req.headers[ 'last-event-id' ] : undefined;
		const unsubscribe = await wbsLogStreamer.register( session, lastId );
		req.on( 'close', unsubscribe );
	} );

	router.get( '/installation/stream', async ( req, res ) => {
		const session = await createSession( req, res );
		const lastId = typeof req.headers[ 'last-event-id' ] === 'string' ?
			req.headers[ 'last-event-id' ] : undefined;
		const unsubscribe = await installationLogStreamer.register( session, lastId );
		req.on( 'close', unsubscribe );
	} );

	router.post( '/installation/finalize', async ( _req, res ): Promise<void> => {
		try {
			installerLifecycle.finalize();

			res.status( 200 ).json( { status: 'finalized' } );
			console.log( '💤 Installation finalized. Exiting...' );
			installerLifecycle.exit(); // allow response to finish
		} catch ( err ) {
			console.error( '❌ Finalize error:', err );
			res.status( 500 ).send( 'Failed to finalize installation' );
		}
	} );

	return router;
}
