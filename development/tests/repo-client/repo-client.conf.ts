import { defaultSettings } from '../_setup/make-test-settings.js';
import TestEnv from '../_setup/test-env.js';
import wdioConfig from '../_setup/wdio.conf.js';

export const testEnv = TestEnv.create( {
	...defaultSettings,
	name: 'repo-client',
	specs: [
		'repo-client/*.spec.ts',
		'repo-client/extensions/*.spec.ts'
	],
	composeProfiles: [ 'wdqs' ],
	composeFiles: [
		...defaultSettings.composeFiles,
		'repo-client/docker-compose.override.yml'
	],
	configurationDirectories: [
		'repo-client/tmp/config',
		'repo-client/tmp/client-config'
	]
} );

export const config = wdioConfig( testEnv );
