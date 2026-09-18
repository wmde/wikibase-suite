import { defaultSettings } from '../_setup/make-test-settings.js';
import TestEnv from '../_setup/test-env.js';
import wdioConfig from '../_setup/wdio.conf.js';

export const testEnv = TestEnv.create( {
	...defaultSettings,
	name: 'wdqs',
	specs: [ 'wdqs/*.spec.ts' ],
	// Runs against qlever, not wdqs
	composeProfiles: [ 'qlever', 'wdqs-frontend' ]
} );

export const config = wdioConfig( testEnv );
