import { Options } from '@wdio/types';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import JsonReporter from '../helpers/json-reporter.js';
import TestEnv from './test-env.js';

// eslint-disable-next-line no-underscore-dangle
const __dirname = dirname( fileURLToPath( import.meta.url ) );

// Most values here should be derived from the currently globally set testEnv and
// not set directly in this file. The one exception is capabilities (i.e. our
// Selenium Grid Standalone / Test Browser setup) which largely is configured only here.
export function wdioConfig( providedTestEnv: TestEnv ): WebdriverIO.Config {
	global.testEnv = providedTestEnv;
	const settings = testEnv.settings;

	return {
		specs: settings.specs.map(
			( specFilepath ) => `${ __dirname }/../${ specFilepath }`
		),
		maxInstances: settings.maxInstances,

		hostname: 'browser',
		port: 4444,
		path: '/wd/hub',
		baseUrl: `${ testEnv.vars.WIKIBASE_URL }${ testEnv.vars.MW_SCRIPT_PATH }`,
		// ============
		// Capabilities
		// ============
		// https://sites.google.com/a/chromium.org/chromedriver/capabilities
		capabilities: [
			{
				browserName: 'chrome',
				'mw:user': testEnv.vars.MW_ADMIN_NAME,
				'mw:pwd': testEnv.vars.MW_ADMIN_PASS,
				'mw:screenshotPath': `${ settings.outputDir }/screenshots`,
				'goog:chromeOptions': {
					args: [
						// The window size is relevant for responsive pages rendering differently on
						// different screen sizes. Bootstrap considers widths between 1200 and 1400
						// as XL, let's use that.
						// https://getbootstrap.com/docs/5.0/layout/breakpoints/#available-breakpoints
						'--window-size=1280,800',
						// https://www.selenium.dev/blog/2023/headless-is-going-away
						...( settings.runHeaded ? [] : [ '--headless=new' ] ),
						// Chrome sandbox does not work in Docker
						...( existsSync( '/.dockerenv' ) ? [ '--no-sandbox' ] : [] )
					]
				}
			} as WebdriverIO.Capabilities
		],

		// Experimental: Turns-on Node debugging (for VS Code debugger, etc)
		execArgv: [ ...( settings.debugNode ? [ '--inspect=0.0.0.0' ] : [] ) ],

		// ===================
		// Test Configurations
		// ===================

		// Level of verbosity: "trace", "debug", "info", "warn", "error", "silent"
		logLevel: settings.logLevel as Options.WebDriverLogTypes,

		outputDir: settings.outputDir,

		// Default timeout for each waitFor* command.
		waitforTimeout: settings.waitForTimeout as number,

		// See also: http://webdriver.io/guide/testrunner/reporters.html
		reporters: [
			[
				'spec',
				{
					showPreface: false
				}
			],
			[
				JsonReporter,
				{
					suiteName: settings.name,
					resultFilePath: `${ settings.outputDir }/result.json`
				}
			]
		],

		// See also: http://mochajs.org
		mochaOpts: {
			ui: 'bdd',
			timeout: settings.testTimeout
		},

		// =====
		// Hooks
		// =====

		onPrepare: async () => {
			if ( settings.onPrepare ) {
				await settings.onPrepare();
			}
		},

		before: async () => {
			if ( settings.before ) {
				await settings.before();
			}
		},

		beforeSuite: async ( mochaSuite ) => {
			testEnv.testLog.info( `================= TEST: ${ mochaSuite.title }` );
			testEnv.testLog.info( `📘 ${ mochaSuite.title.toUpperCase() }` );
			if ( settings.beforeMochaSuite ) {
				await settings.beforeMochaSuite( mochaSuite );
			}
		},

		beforeTest: async function ( mochaTest ) {
			testEnv.testLog.info( `================= SPEC: ${ mochaTest.title }` );
			if ( settings.beforeTest ) {
				await settings.beforeTest( mochaTest );
			}
		},

		afterTest: async function ( mochaTest, _context, result ) {
			if ( settings.afterTest ) {
				await settings.afterTest( mochaTest, result );
			}
		},

		afterSuite: async ( mochaSuite ) => {
			if ( settings.afterMochaSuite ) {
				await settings.afterMochaSuite( mochaSuite );
			}
		},

		after: async () => {
			if ( settings.after ) {
				await settings.after();
			}
		},

		onComplete: async ( exitCode ) => {
			if ( settings.onComplete ) {
				await settings.onComplete( exitCode );
			}
		}
	};
}

export default wdioConfig;
