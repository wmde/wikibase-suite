import { createSession, createChannel } from 'better-sse';
import { promises as dns } from 'dns';
import express from 'express';
import { existsSync, readFileSync, createReadStream } from 'fs';
import https, { request } from 'https';
import { dirname, join } from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { createLogStreamer } from './logStreamer.js';
import { validateSetupPassword } from './passwordPolicy.js';
import {
	canSkipDnsValidation,
	isValidSetupHostname,
	validateSetupConfig
} from './shared/validation.js';
import {
	LOG_PATH,
	isBooted,
	isConfigSaved,
	isSetupStarted,
	getExistingInstallState,
	isLocalhostSetup,
	getConfig,
	saveConfigText,
	markConfigReadyForLaunch,
	clearLog,
	sanitizeConfig
} from './serverHelpers.js';

const fileName = fileURLToPath( import.meta.url );
const moduleDir = dirname( fileName );

// Constants
const SSL_CERT_KEY_PATH = '/app/certs/key.pem';
const SSL_CERT_PATH = '/app/certs/cert.pem';
// 10 minutes
const AUTO_FINALIZE_TIMEOUT_MS = 10 * 60 * 1000;
const DEV_SERVER = process.env.DEV_SERVER === 'true';
const APP_ROOT = DEV_SERVER ? moduleDir : dirname( moduleDir );
const INDEX_TEMPLATE_PATH = join( APP_ROOT, 'index.html' );

// Express setup
const app = express();
app.use( express.static( join( APP_ROOT, 'public' ) ) );
app.use(
	'/codex-assets',
	express.static( join( APP_ROOT, 'node_modules', '@wikimedia', 'codex', 'dist' ) )
);
app.use(
	'/codex-icons',
	express.static( join( APP_ROOT, 'node_modules', '@wikimedia', 'codex-icons', 'dist', 'images' ) )
);
app.use( express.json() );

const logChannel = createChannel();

function escapeJsonForHtml( value: unknown ): string {
	return JSON.stringify( value ).replace( /</g, '\\u003c' );
}

function escapeHtmlAttribute( value: string ): string {
	return value
		.replace( /&/g, '&amp;' )
		.replace( /"/g, '&quot;' )
		.replace( /</g, '&lt;' )
		.replace( />/g, '&gt;' );
}

function renderSetupShell( scriptSrc: string ): string {
	const initialState = {
		isConfigSaved: isConfigSaved(),
		isBooted: isBooted(),
		isSetupStarted: isSetupStarted(),
		existingInstallState: getExistingInstallState(),
		isLocalhostSetup: isLocalhostSetup(),
		serverIp: process.env.SERVER_IP || ''
	};

	return readFileSync( INDEX_TEMPLATE_PATH, 'utf8' )
		.replace( '%SETUP_STATE%', escapeJsonForHtml( initialState ) )
		.replace( '%SCRIPT_SRC%', escapeHtmlAttribute( scriptSrc ) );
}

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
		const { config, configText } = getConfig( req.body );
		const validationIssues = validateSetupConfig( config, {
			isLocalhostSetup: isLocalhostSetup(),
			passwordValidator: validateSetupPassword
		} );

		if ( validationIssues.length ) {
			res.status( 400 ).json( {
				status: 'invalid',
				message: 'Configuration did not pass final validation.',
				errors: validationIssues
			} );
			return;
		}

		saveConfigText( configText );
		markConfigReadyForLaunch();
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

app.post( '/validate/hostname', async ( req, res ): Promise<void> => {
	const hostname = typeof req.body?.hostname === 'string' ? req.body.hostname.trim() : '';
	const serverIp = process.env.SERVER_IP || '';
	const localhostSetup = isLocalhostSetup();

	if ( !hostname ) {
		res.status( 200 ).json( { valid: false, reason: 'empty-hostname' } );
		return;
	}

	if ( !isValidSetupHostname( hostname, localhostSetup ) ) {
		res.status( 200 ).json( { valid: false, reason: 'invalid-hostname' } );
		return;
	}

	if ( canSkipDnsValidation( hostname, localhostSetup ) ) {
		res.status( 200 ).json( { valid: true, addresses: [ hostname ], expected: hostname } );
		return;
	}

	if ( !serverIp ) {
		res.status( 200 ).json( { valid: false, reason: 'missing-server-ip' } );
		return;
	}

	try {
		const addresses = await dns.resolve4( hostname );
		res.status( 200 ).json( {
			valid: addresses.includes( serverIp ),
			addresses,
			expected: serverIp,
			reason: addresses.includes( serverIp ) ? undefined : 'address-mismatch'
		} );
	} catch ( error ) {
		console.error( `Failed to resolve hostname ${ hostname }:`, error );
		res.status( 200 ).json( {
			valid: false,
			addresses: [],
			expected: serverIp,
			reason: 'dns-lookup-failed'
		} );
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
		console.log( '💤 Installation finalized. Exiting...' );
		// eslint-disable-next-line n/no-process-exit
		setTimeout( () => process.exit( 0 ), 300 ); // allow response to finish
	} catch ( err ) {
		console.error( '❌ Finalize error:', err );
		res.status( 500 ).send( 'Failed to finalize installation' );
	}
} );

if ( !existsSync( SSL_CERT_PATH ) || !existsSync( SSL_CERT_KEY_PATH ) ) {
	throw new Error( 'Not able to access SSL certificate or key in /app/certs' );
}

const credentials = {
	cert: readFileSync( SSL_CERT_PATH ),
	key: readFileSync( SSL_CERT_KEY_PATH )
};

const httpsServer = https.createServer( credentials, app );

if ( DEV_SERVER ) {
	const { createServer: createViteServer } = await import( 'vite' );
	const { default: vue } = await import( '@vitejs/plugin-vue' );
	const vite = await createViteServer( {
		configFile: false,
		root: APP_ROOT,
		appType: 'custom',
		plugins: [ vue() ],
		publicDir: false,
		server: {
			middlewareMode: true,
			hmr: {
				server: httpsServer
			}
		}
	} );

	app.use( vite.middlewares );

	app.get( '/', async ( req, res ) => {
		try {
			const html = await vite.transformIndexHtml(
				req.originalUrl,
				renderSetupShell( '/client/main.ts' )
			);
			res.type( 'html' ).send( html );
		} catch ( err ) {
			vite.ssrFixStacktrace( err as Error );
			console.error( 'Failed to render dev template:', err );
			res.status( 500 ).send( 'Template render error' );
		}
	} );
} else {
	app.get( '/', async ( req, res ) => {
		try {
			res.type( 'html' ).send( renderSetupShell( '/assets/installer-app.js' ) );
		} catch ( err ) {
			console.error( 'Failed to render template:', err );
			res.status( 500 ).send( 'Template render error' );
		}
	} );
}

httpsServer.listen( 443, () => {
	console.log( `✅ HTTPS server running at https://localhost:443${ DEV_SERVER ? ' (dev mode)' : '' }` );
} );

// Kick off finalize if booted and inactive
setTimeout( () => {
	if ( isBooted() ) {
		console.log( '⏱️ Auto-finalizing installation after timeout...' );

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
