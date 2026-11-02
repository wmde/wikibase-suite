import { Frameworks } from '@wdio/types';

export type TestSuiteSettings = {
	name: string;
	specs: string[];
};

export type TestRunnerSettings = {
	logLevel: string;
	testTimeout: number;
	waitForTimeout: number;
	maxInstances: number;
	pwd: string;
	outputDir: string;
	runHeaded?: boolean;
	debug?: boolean;
	debugNode?: boolean;
};

export type TestHooks = {
	// Runs immediately after testEnv is created but before it is ran
	onPrepare?(): Promise<void>;
	// Runs before services are started but after `outputDir` is
	// cleared and BEFORE existing services are stopped
	beforeServices?(): Promise<void>;
	// Runs after services are started
	afterServices?(): Promise<void>;
	// Runs after services are started and available (waitForItUrls all respond true)
	afterServicesAvailable?(): Promise<void>;
	// Runs once at the beginning of each spec file (before each WDIO runner)
	before?(): Promise<void>;
	// Runs before every Mocha "suite" (`describe` blocks)
	beforeMochaSuite?( mochaSuite: Frameworks.Suite ): Promise<void>;
	// Runs at the start of every WDIO worker
	beforeTest?( mochaTest: Frameworks.Test ): Promise<void>;
	// Runs at the end of every WDIO worker
	afterTest?(
		mochaTest: Frameworks.Test,
		result: Frameworks.TestResult
	): Promise<void>;
	// Runs after every Mocha "suite" (`describe` blocks)
	afterMochaSuite?( mochaSuite: Frameworks.Suite ): Promise<void>;
	// Runs once at the end of each spec file (after each WDIO runner)
	after?(): Promise<void>;
	// Executed after all workers have shut down and the process is about to exit
	onComplete?( exitCode?: number ): Promise<void>;
};

export type TestEnvSettings = {
	composeFiles?: string[];
	composeProfiles?: string[];
	waitForUrls?(): string[];
	envFiles?: string[];
	vars: Record<string, string>;
};

export type TestSettings = TestSuiteSettings &
TestRunnerSettings &
TestHooks &
TestEnvSettings;

export default TestSettings;
