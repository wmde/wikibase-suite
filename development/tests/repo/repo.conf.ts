import { defaultSettings } from '../_setup/make-test-settings.js';
import TestEnv from '../_setup/test-env.js';
import wdioConfig from '../_setup/wdio.conf.js';

export const testEnv = TestEnv.create( {
	...defaultSettings,
	name: 'repo',
	maxInstances: 3,
	specs: [ 'repo/*.spec.ts' ],
	envFiles: [
		...defaultSettings.envFiles,
		'../../docker-images/wikibase/build.env' // to compare actual MediaWiki version to build
	]
} );

export const config = wdioConfig( testEnv );
