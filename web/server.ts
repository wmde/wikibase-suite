import { createSession, createChannel } from 'better-sse';
import express from 'express';
import { existsSync, readFileSync, createReadStream } from 'fs';
import https, { request } from 'https';
import { dirname, join } from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { createLogStreamer } from './logStreamer.js';
import { validateSetupPassword } from './passwordPolicy.js';
import {
	LOG_PATH,
	isBooted,
	isConfigSaved,
	isLocalhostSetup,
	getConfig,
	saveConfigText,
	clearLog,
	sanitizeConfig
} from './serverHelpers.js';

const fileName = fileURLToPath( import.meta.url );
const dirName = dirname( fileName );

// Constants
const SSL_CERT_KEY_PATH = '/app/certs/key.pem';
const SSL_CERT_PATH = '/app/certs/cert.pem';
// 10 minutes
const AUTO_FINALIZE_TIMEOUT_MS = 10 * 60 * 1000;

// Express setup
const app = express();
app.use( express.static( join( dirName, 'public' ) ) );
app.use(
	'/codex-assets',
	express.static( join( dirName, 'node_modules', '@wikimedia', 'codex', 'dist' ) )
);
app.use(
	'/codex-icons',
	express.static( join( dirName, 'node_modules', '@wikimedia', 'codex-icons', 'dist', 'images' ) )
);
app.use( express.json() );

const logChannel = createChannel();

function escapeJsonForHtml( value: unknown ): string {
	return JSON.stringify( value ).replace( /</g, '\\u003c' );
}

function renderSetupShell(): string {
	const initialState = {
		isConfigSaved: isConfigSaved(),
		isBooted: isBooted(),
		isLocalhostSetup: isLocalhostSetup(),
		serverIp: process.env.SERVER_IP || ''
	};

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Wikibase Suite Deploy Setup</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="/codex-assets/codex.style.css" />
  <link rel="stylesheet" href="/setup.css" />
</head>
<body>
  <div id="app"></div>
  <script>window.__SETUP_STATE__ = ${ escapeJsonForHtml( initialState ) };</script>
  <script type="module" src="/assets/setup-app.js"></script>
</body>
</html>`;
}

// ---------- Routes ----------
app.get( '/', async ( req, res ) => {
	try {
		res.type( 'html' ).send( renderSetupShell() );
	} catch ( err ) {
		console.error( 'Failed to render template:', err );
		res.status( 500 ).send( 'Template render error' );
	}
} );

// create and start the log streamer
const streamer = createLogStreamer( LOG_PATH );
streamer.start();
app.get( '/log/stream', async ( req, res ) => {
	const session = await createSession( req, res );
	const lastId = typeof req.headers[ 'last-event-id' ] === 'string' ?
		req.headers[ 'last-event-id' ] : undefined;
	const unsubscribe = await streamer.register( session, lastId );
	req.on( 'close', unsubscribe );
} );

app.post( '/config', async ( req, res ): Promise<void> => {
	try {
		const adminPasswordValidation = validateSetupPassword( String( req.body.MW_ADMIN_PASS ?? '' ) );
		const databasePasswordValidation = validateSetupPassword( String( req.body.DB_PASS ?? '' ) );
		if ( !adminPasswordValidation.valid || !databasePasswordValidation.valid ) {
			res.status( 400 ).json( {
				status: 'invalid',
				errors: {
					MW_ADMIN_PASS: adminPasswordValidation.valid ? undefined : adminPasswordValidation.reason,
					DB_PASS: databasePasswordValidation.valid ? undefined : databasePasswordValidation.reason
				}
			} );
			return;
		}

		const { config, configText } = getConfig( req.body );
		saveConfigText( configText );
		console.log( '.env file written successfully' );
		res.status( 200 ).json( { status: 'ok', config, configText } );
	} catch ( err ) {
		console.error( 'Failed to write .env:', err );
		res.status( 500 ).send( 'Failed to write .env' );
	}
} );

app.post( '/validate/password', async ( req, res ): Promise<void> => {
	try {
		const password = typeof req.body?.password === 'string' ? req.body.password : '';
		const validation = validateSetupPassword( password );
		res.status( 200 ).json( validation );
	} catch ( err ) {
		console.error( 'Failed to validate password:', err );
		res.status( 500 ).json( { valid: false, reason: 'validation-error' } );
	}
} );

app.get( '/config', async ( req, res ): Promise<void> => {
	try {
		const { config, configText } = getConfig();
		res.status( 200 ).json( { config, configText } );
	} catch ( err ) {
		console.error( 'Failed to read .env:', err );
		res.status( 500 ).send( 'Failed to read .env' );
	}
} );

app.post( '/finalize-setup', async ( req, res ): Promise<void> => {
	try {
		sanitizeConfig();
		clearLog();

		res.status( 200 ).json( { status: 'finalized' } );
		console.log( '💤 Setup finalized. Exiting...' );
		// eslint-disable-next-line n/no-process-exit
		setTimeout( () => process.exit( 0 ), 300 ); // allow response to finish
	} catch ( err ) {
		console.error( '❌ Finalize error:', err );
		res.status( 500 ).send( 'Failed to finalize setup' );
	}
} );

if ( !existsSync( SSL_CERT_PATH ) || !existsSync( SSL_CERT_KEY_PATH ) ) {
	throw new Error( 'Not able to access SSL certificate or key in /app/certs' );
}

const credentials = {
	cert: readFileSync( SSL_CERT_PATH ),
	key: readFileSync( SSL_CERT_KEY_PATH )
};

https.createServer( credentials, app ).listen( 443, () => {
	console.log( '✅ HTTPS server running at https://localhost:443' );
} );

// Kick off finalize if booted and inactive
setTimeout( () => {
	if ( isBooted() ) {
		console.log( '⏱️ Auto-finalizing setup after timeout...' );

		const req = request(
			{
				method: 'POST',
				host: 'localhost',
				port: 443,
				path: '/finalize-setup',
				rejectUnauthorized: false, // allow self-signed certs
				headers: {
					'Content-Type': 'application/json'
				}
			},
			( res ) => {
				if ( res.statusCode && res.statusCode >= 200 && res.statusCode < 300 ) {
					console.log( '✅ Auto-finalize complete' );
				} else {
					console.error( `❌ Auto-finalize failed: ${ res.statusCode }` );
				}
			}
		);

		req.on( 'error', ( err ) => {
			console.error( '❌ Auto-finalize request error:', err );
		} );

		req.end(); // no body needed
	} else {
		console.log( '⏱️ Auto-finalize skipped: not yet booted' );
	}
}, AUTO_FINALIZE_TIMEOUT_MS );
