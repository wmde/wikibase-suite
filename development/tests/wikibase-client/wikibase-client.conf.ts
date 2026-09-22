import { defaultSettings } from '../_setup/make-test-settings.js';
import TestEnv from '../_setup/test-env.js';
import wdioConfig from '../_setup/wdio.conf.js';

export const testEnv = TestEnv.create( {
	...defaultSettings,
	name: 'wikibase-client',
	specs: [
		'wikibase-client/*.spec.ts',
		'wikibase-client/extensions/*.spec.ts'
	],
	composeProfiles: [ 'wdqs' ],
	composeFiles: [
		...defaultSettings.composeFiles,
		'wikibase-client/docker-compose.override.yml'
	],
	configurationDirectories: [
		'wikibase-client/tmp/config',
		'wikibase-client/tmp/client-config'
	]
} );

export const config = wdioConfig( testEnv );
