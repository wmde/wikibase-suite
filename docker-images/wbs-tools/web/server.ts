import { createSession } from 'better-sse';
import { promises as dns } from 'dns';
import express from 'express';
import { appendFileSync, existsSync, readFileSync } from 'fs';
import https from 'https';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createLogStreamer } from './log-streamer.js';
import { validateSetupPassword } from '../lib/password-policy.js';
import {
	canSkipDnsValidation,
	isValidSetupHostname,
	validateSetupConfig
} from '../lib/validation.js';
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
} from '../lib/configuration.js';

const fileName = fileURLToPath( import.meta.url );
const moduleDir = dirname( fileName );

// Constants
const SSL_CERT_KEY_PATH = '/app/certs/key.pem';
const SSL_CERT_PATH = '/app/certs/cert.pem';
// 10 minutes
const AUTO_FINALIZE_TIMEOUT_MS = 10 * 60 * 1000;
const INSTALLATION_STATUS_POLL_MS = 5 * 1000;
const DEV_SERVER = process.env.DEV_SERVER === 'true';
const INSTALLER_DEV_MOCK = DEV_SERVER && process.env.INSTALLER_DEV_MOCK === 'true';
const CONFIGURE_ONLY = process.env.CONFIGURE_ONLY === 'true';
const APP_ROOT = DEV_SERVER ? moduleDir : join( dirname( dirname( moduleDir ) ), 'web' );
const INDEX_TEMPLATE_PATH = join( APP_ROOT, 'index.html' );

type ConfigResponse = ReturnType<typeof getConfig>;

const MOCK_INSTALLATION_EVENTS = [
	{ delayMs: 250, message: 'Configuration saved.', code: 'config_saved' },
	{ delayMs: 900, message: 'Pulling Docker images...', code: 'images_pull_started' },
	{ delayMs: 1700, message: 'Starting Docker Compose services...', code: 'services_waiting' },
	{ delayMs: 2700, message: 'Docker Compose services reported ready.', code: 'services_ready' },
	{ delayMs: 3400, message: 'Installation is complete.', code: 'setup_complete' }
] as const;

let mockConfigResponse: ConfigResponse | null = null;
let mockInstallationTimers: ReturnType<typeof setTimeout>[] = [];

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
		installerDevMock: INSTALLER_DEV_MOCK,
		configurationOnly: CONFIGURE_ONLY,
		isConfigSaved: INSTALLER_DEV_MOCK ? false : isConfigSaved(),
		isBooted: INSTALLER_DEV_MOCK ? false : isBooted(),
		isSetupStarted: INSTALLER_DEV_MOCK ? false : isSetupStarted(),
		existingInstallState: INSTALLER_DEV_MOCK ? 'none' : getExistingInstallState(),
		isLocalhostSetup: isLocalhostSetup(),
		serverIp: process.env.SERVER_IP || ''
	};

	return readFileSync( INDEX_TEMPLATE_PATH, 'utf8' )
		.replace( '%SETUP_STATE%', escapeJsonForHtml( initialState ) )
		.replace( '%SCRIPT_SRC%', escapeHtmlAttribute( scriptSrc ) );
}

function startMockInstallation(): void {
	for ( const timer of mockInstallationTimers ) {
		clearTimeout( timer );
	}
	mockInstallationTimers = [];
	clearLog();

	for ( const event of MOCK_INSTALLATION_EVENTS ) {
		mockInstallationTimers.push( setTimeout( () => {
			appendFileSync(
				LOG_PATH,
				`${ new Date().toISOString() } ${ event.message } [${ event.code }]\n`
			);
		}, event.delayMs ) );
	}
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

		if ( INSTALLER_DEV_MOCK ) {
			mockConfigResponse = { config, configText };
			startMockInstallation();
			console.log( 'Mock installation started; no configuration or services were changed.' );
		} else {
			saveConfigText( configText );
			if ( !CONFIGURE_ONLY ) {
				markConfigReadyForLaunch();
			}
			console.log( '.env file written successfully' );
		}
		res.status( 200 ).json( { status: 'ok', config, configText } );
		if ( CONFIGURE_ONLY && !INSTALLER_DEV_MOCK ) {
			console.log( 'Configuration complete. Exiting configurator...' );
			exitInstaller();
		}
	} catch ( err ) {
		console.error( 'Failed to save configuration:', err );
		res.status( 500 ).send( 'Failed to save configuration' );
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
		const { config, configText } = mockConfigResponse ?? getConfig();
		res.status( 200 ).json( { config, configText } );
	} catch ( err ) {
		console.error( 'Failed to read .env:', err );
		res.status( 500 ).send( 'Failed to read .env' );
	}
} );

function finalizeInstallation(): void {
	if ( !INSTALLER_DEV_MOCK ) {
		sanitizeConfig();
	}
	clearLog();
}

function exitInstaller(): void {
	setTimeout( () => process.exit( 0 ), 300 );
}

app.post( '/finalize-setup', async ( req, res ): Promise<void> => {
	try {
		finalizeInstallation();

		res.status( 200 ).json( { status: 'finalized' } );
		console.log( '💤 Installation finalized. Exiting...' );
		exitInstaller(); // allow response to finish
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
		optimizeDeps: {
			include: [
				'@wikimedia/codex',
				'@wikimedia/codex-icons',
				'tldts',
				'vue'
			]
		},
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

function scheduleAutoFinalizeAfterBoot(): void {
	if ( !isBooted() ) {
		setTimeout( scheduleAutoFinalizeAfterBoot, INSTALLATION_STATUS_POLL_MS );
		return;
	}

	console.log( '⏱️ Installation complete. Auto-finalize scheduled in 10 minutes.' );
	setTimeout( () => {
		try {
			finalizeInstallation();
			console.log( '✅ Auto-finalize complete. Exiting...' );
			exitInstaller();
		} catch ( err ) {
			console.error( '❌ Auto-finalize failed:', err );
		}
	}, AUTO_FINALIZE_TIMEOUT_MS );
}

// A live-reload development server remains available until the developer replaces it.
if ( !DEV_SERVER && !CONFIGURE_ONLY ) {
	scheduleAutoFinalizeAfterBoot();
}
