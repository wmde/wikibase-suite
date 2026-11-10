import { defaultSettings } from '../_setup/make-test-settings.js';
import TestEnv from '../_setup/test-env.js';
import wdioConfig from '../_setup/wdio.conf.js';

export const testEnv = TestEnv.create( {
	...defaultSettings,
	name: 'ontology-presets',
	specs: [ 'ontology-presets/*.spec.ts' ]
} );

export const config = wdioConfig( testEnv );
