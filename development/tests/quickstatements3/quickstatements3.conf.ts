import { defaultSettings } from '../_setup/make-test-settings.js';
import TestEnv from '../_setup/test-env.js';
import wdioConfig from '../_setup/wdio.conf.js';

export const testEnv = TestEnv.create( {
	...defaultSettings,
	name: 'quickstatements3',
	specs: [ 'quickstatements3/*.spec.ts' ],
	envFiles: [ ...defaultSettings.envFiles, 'quickstatements3/test-services.env' ],
	composeProfiles: [ 'quickstatements3' ],
	composeFiles: [
		...defaultSettings.composeFiles,
		'quickstatements3/docker-compose.override.yml'
	]
} );

export const config = wdioConfig( testEnv );
