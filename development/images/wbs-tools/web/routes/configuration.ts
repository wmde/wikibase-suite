import express, { type Router } from 'express';
import {
	getConfig,
	isLocalMode,
	markConfigReadyForLaunch,
	saveConfigText
} from '../../lib/configuration.js';
import { validateConfigurationPassword } from '../../lib/password-policy.js';
import { validateConfiguration } from '../../lib/validation.js';
import type { InstallerLifecycle } from '../installer-lifecycle.js';
import type { MockInstallation } from '../mock-installation.js';

export interface ConfigurationRouterOptions {
	configurationOnly: boolean;
	installerDevMock: boolean;
	installerLifecycle: InstallerLifecycle;
	mockInstallation: MockInstallation;
}

export function createConfigurationRouter(
	options: ConfigurationRouterOptions
): Router {
	const router = express.Router();

	router.post( '/', async ( req, res ): Promise<void> => {
		try {
			const { config, configText } = getConfig( req.body );
			const validationIssues = validateConfiguration( config, {
				isLocalMode: isLocalMode(),
				passwordValidator: validateConfigurationPassword
			} );

			if ( validationIssues.length ) {
				res.status( 400 ).json( {
					status: 'invalid',
					message: 'Configuration did not pass final validation.',
					errors: validationIssues
				} );
				return;
			}

			if ( options.installerDevMock ) {
				options.mockInstallation.start( { config, configText } );
				console.log( 'Mock installation started; no configuration or services were changed.' );
			} else {
				saveConfigText( configText );
				if ( !options.configurationOnly ) {
					markConfigReadyForLaunch();
				}
				console.log( '.env file written successfully' );
			}
			res.status( 200 ).json( { status: 'ok', config, configText } );
			if ( options.configurationOnly && !options.installerDevMock ) {
				console.log( 'Configuration complete. Exiting configurator...' );
				options.installerLifecycle.exit();
			}
		} catch ( err ) {
			console.error( 'Failed to save configuration:', err );
			res.status( 500 ).send( 'Failed to save configuration' );
		}
	} );

	router.get( '/', async ( _req, res ): Promise<void> => {
		try {
			const { config, configText } = options.mockInstallation.getConfigResponse() ?? getConfig();
			res.status( 200 ).json( { config, configText } );
		} catch ( err ) {
			console.error( 'Failed to read .env:', err );
			res.status( 500 ).send( 'Failed to read .env' );
		}
	} );

	return router;
}
