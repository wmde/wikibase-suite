import { defaultSettings } from '../../setup/make-test-settings.js';
import TestEnv from '../../setup/test-env.js';
import wdioConfig from '../../setup/wdio.conf.js';

export const testEnv = TestEnv.create( {
	...defaultSettings,
	name: 'repo',
	maxInstances: 3,
	specs: [ 'specs/repo/*.ts', 'specs/repo/extensions/*.ts' ],
	envFiles: [
		...defaultSettings.envFiles,
		'../build/wikibase/build.env' // to compare actual MediaWiki version to build
	],
	composeFiles: [
		...defaultSettings.composeFiles,
		'suites/repo/docker-compose.override.yml'
	]
} );

export const config = wdioConfig( testEnv );
