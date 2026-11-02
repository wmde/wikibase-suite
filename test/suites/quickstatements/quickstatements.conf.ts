import { defaultSettings } from '../../setup/make-test-settings.js';
import TestEnv from '../../setup/test-env.js';
import wdioConfig from '../../setup/wdio.conf.js';

export const testEnv = TestEnv.create( {
	...defaultSettings,
	name: 'quickstatements',
	specs: [ 'specs/quickstatements/*.ts' ],
	composeProfiles: [ 'quickstatements' ],
	composeFiles: [
		...defaultSettings.composeFiles,
		'suites/quickstatements/docker-compose.override.yml'
	]
} );

export const config = wdioConfig( testEnv );
