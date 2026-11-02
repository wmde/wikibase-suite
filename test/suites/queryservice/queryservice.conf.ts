import { defaultSettings } from '../../setup/make-test-settings.js';
import TestEnv from '../../setup/test-env.js';
import wdioConfig from '../../setup/wdio.conf.js';

export const testEnv = TestEnv.create( {
	...defaultSettings,
	name: 'queryservice',
	specs: [ 'specs/queryservice/*.ts' ],
	composeProfiles: [ 'queryservice' ]
} );

export const config = wdioConfig( testEnv );
