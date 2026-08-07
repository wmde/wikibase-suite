import express from 'express';
import { existsSync, readFileSync } from 'fs';
import https from 'https';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { INSTALLATION_LOG_PATH } from '../lib/installation-log.js';
import { WBS_LOG_PATH } from '../lib/wbs-log.js';
import { createInstallerAccess } from './installer-access.js';
import { createInstallerLifecycle } from './installer-lifecycle.js';
import { createMockInstallation } from './mock-installation.js';
import { createConfigurationRouter } from './routes/configuration.js';
import { createInstallationRouter } from './routes/installation.js';
import { createValidationRouter } from './routes/validation.js';
import { createInstallerShellRenderer } from './installer-shell.js';

const fileName = fileURLToPath( import.meta.url );
const moduleDir = dirname( fileName );

const SSL_CERT_KEY_PATH = process.env.SSL_CERT_KEY_PATH || '/app/certs/key.pem';
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || '/app/certs/cert.pem';
const DEV_SERVER = process.env.DEV_SERVER === 'true';
const INSTALLER_DEV_MOCK = DEV_SERVER && process.env.INSTALLER_DEV_MOCK === 'true';
const CONFIGURE_ONLY = process.env.CONFIGURE_ONLY === 'true';
const INSTALLER_ACCESS_CODE = process.env.INSTALLER_ACCESS_CODE || '';
const SERVER_IP = process.env.SERVER_IP || '';
const APP_ROOT = DEV_SERVER ? moduleDir : join( dirname( dirname( moduleDir ) ), 'web' );
const INDEX_TEMPLATE_PATH = join( APP_ROOT, 'index.html' );

const app = express();
const installerAccess = createInstallerAccess( INSTALLER_ACCESS_CODE );
const installerLifecycle = createInstallerLifecycle( {
	configurationOnly: CONFIGURE_ONLY,
	devServer: DEV_SERVER,
	installerDevMock: INSTALLER_DEV_MOCK
} );
const mockInstallation = createMockInstallation( INSTALLATION_LOG_PATH );
const renderInstallerShell = createInstallerShellRenderer( {
	configurationOnly: CONFIGURE_ONLY,
	devServer: DEV_SERVER,
	indexTemplatePath: INDEX_TEMPLATE_PATH,
	installerDevMock: INSTALLER_DEV_MOCK,
	serverIp: SERVER_IP
} );

app.use( ( _req, res, next ) => {
	res.setHeader( 'Cache-Control', 'no-store' );
	res.setHeader( 'Referrer-Policy', 'no-referrer' );
	next();
} );
app.use( installerAccess.publicRoutes );
app.use( installerAccess.requireAccess );
app.use( express.static( join( APP_ROOT, 'public' ) ) );
app.use( express.json() );

app.use( '/validate', createValidationRouter( SERVER_IP ) );
app.use( '/config', createConfigurationRouter( {
	configurationOnly: CONFIGURE_ONLY,
	installerDevMock: INSTALLER_DEV_MOCK,
	installerLifecycle,
	mockInstallation
} ) );
app.use( createInstallationRouter(
	WBS_LOG_PATH,
	INSTALLATION_LOG_PATH,
	installerLifecycle
) );

if ( !existsSync( SSL_CERT_PATH ) || !existsSync( SSL_CERT_KEY_PATH ) ) {
	throw new Error( 'Not able to access the SSL certificate or key.' );
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
				renderInstallerShell( '/client/main.ts' )
			);
			res.type( 'html' ).send( html );
		} catch ( err ) {
			vite.ssrFixStacktrace( err as Error );
			console.error( 'Failed to render dev template:', err );
			res.status( 500 ).send( 'Template render error' );
		}
	} );
} else {
	app.get( '/', async ( _req, res ) => {
		try {
			res.type( 'html' ).send( renderInstallerShell( '/assets/installer-app.js' ) );
		} catch ( err ) {
			console.error( 'Failed to render template:', err );
			res.status( 500 ).send( 'Template render error' );
		}
	} );
}

httpsServer.listen( 443 );

installerLifecycle.startAutoFinalizeMonitor();
