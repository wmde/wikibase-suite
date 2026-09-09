import { defaultSettings } from '../_setup/make-test-settings.js';
import TestEnv from '../_setup/test-env.js';
import wdioConfig from '../_setup/wdio.conf.js';

export const testEnv = TestEnv.create( {
	...defaultSettings,
	name: 'qlever',
	specs: [ 'qlever/*.spec.ts' ],
	composeProfiles: [ 'qlever' ],
	composeFiles: [
		'../../docker-compose.yml',
		'_setup/docker-compose.override.yml',
		'qlever/docker-compose.override.yml'
	]
} );

export const config = wdioConfig( testEnv );
