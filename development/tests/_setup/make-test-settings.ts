import { Frameworks } from '@wdio/types';
import { saveScreenshot } from 'wdio-mediawiki';
import WikibaseApi from 'wdio-wikibase/wikibase.api.js';
import { SevereServiceError } from 'webdriverio';
import { defaultFunctions as defaultFunctionsInit } from '../_helpers/default-functions.js';
import TestSettings, {
	TestEnvSettings,
	TestHooks,
	TestRunnerSettings,
	TestSuiteSettings
} from '../_types/test-settings.js';
import loadEnvFiles from './load-env-files.js';
import { applyMaxInstancesCap } from './max-instances.js';

export const ONE_DAY_IN_MS = 86400000;

export const baseTestSettings = {
	envFiles: [],
	composeFiles: [],
	waitForUrls: (): string[] => [],
	onPrepare: async (): Promise<void> => {
		await testEnv.up();
	},
	before: async (): Promise<void> => {
		try {
			defaultFunctionsInit();
			await WikibaseApi.initialize(
				undefined,
				testEnv.vars.MW_ADMIN_NAME,
				testEnv.vars.MW_ADMIN_PASS
			);
		} catch ( e ) {
			throw new SevereServiceError( e );
		}
	},
	afterTest: async (
		mochaTest: Frameworks.Test,
		result: Frameworks.TestResult
	): Promise<void> => {
		if ( result.passed || result.skipped ) {
			return;
		}

		const testFile = encodeURIComponent(
			mochaTest.file.match( /.+\/(.+)\.[jt]s$/ )[ 1 ].replace( /\s+/g, '-' )
		);
		const screenshotFilename = `${ testFile }__${ mochaTest.title }`;
		try {
			await saveScreenshot( screenshotFilename );
		} catch ( error ) {
			console.error( 'failed writing screenshot ...' );
			console.error( error );
		}
	},
	onComplete: async ( exitCode?: number ): Promise<void> => {
		// Prompts to exit and keep Test Services up if there were failures
		if ( exitCode === 1 ) {
			return testEnv.exitPrompt();
		}
		return testEnv.down();
	}
};

export const makeTestSettings = (
	settings: Partial<TestSettings>
): TestSettings => {
	// NOTE: The values from these env files are put in testEnv.vars
	// to better isolate the test-service testEnv from the parent process
	const testEnvVars = loadEnvFiles(
		settings.envFiles || baseTestSettings.envFiles
	);
	const testSuiteSettings: TestSuiteSettings = {
		name: settings.name,
		specs: settings.specs
	};
	const suiteMaxInstances =
		settings.maxInstances ?? parseInt( process.env.MAX_INSTANCES );
	const maxInstances = applyMaxInstancesCap(
		suiteMaxInstances,
		process.env.WBS_TEST_MAX_INSTANCES
	);
	// Docker Compose uses this value to configure the Selenium session limit.
	// Keep it aligned with the number of workers WebdriverIO will start.
	testEnvVars.MAX_INSTANCES = maxInstances.toString();
	const debug = process.env.DEBUG === 'true' || process.env.DEBUG === 'node';
	const debugNode = process.env.DEBUG === 'node';
	const outputDir = `${ settings.name }/results`;
	const testRunnerSettings: TestRunnerSettings = {
		debug,
		debugNode,
		outputDir,
		runHeaded: process.env.WBS_TEST_HEADED === 'true',
		logLevel: process.env.TEST_LOG_LEVEL,
		testTimeout: debug ?
			ONE_DAY_IN_MS :
			parseInt( process.env.MOCHA_OPTS_TIMEOUT ),
		waitForTimeout: debug ?
			ONE_DAY_IN_MS :
			parseInt( process.env.WAIT_FOR_TIMEOUT ),
		maxInstances,
		pwd: process.env.HOST_PWD ?
			`${ process.env.HOST_PWD }/development/tests` :
			process.cwd()
	};
	const testEnvironmentSettings: TestEnvSettings = {
		composeFiles: settings.composeFiles || baseTestSettings.composeFiles,
		composeProfiles: settings.composeProfiles || [],
		waitForUrls: settings.waitForUrls || baseTestSettings.waitForUrls,
		envFiles: settings.envFiles || baseTestSettings.envFiles,
		vars: testEnvVars
	};
	const testHooks: TestHooks = {
		onPrepare: settings.onPrepare || baseTestSettings.onPrepare,
		before: settings.before || baseTestSettings.before,
		afterTest: settings.afterTest || baseTestSettings.afterTest,
		onComplete: settings.onComplete || baseTestSettings.onComplete
	};

	return {
		...testSuiteSettings,
		...testRunnerSettings,
		...testEnvironmentSettings,
		...testHooks
	} as TestSettings;
};

export const defaultSettings: Partial<TestSettings> = {
	envFiles: [
		'../../.env.example',
		'./test-services.env',
		'../local.env'
	],
	composeFiles: [
		'../../docker-compose.yml',
		'_setup/docker-compose.override.yml'
	]
};
