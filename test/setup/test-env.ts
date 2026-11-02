import logger, { Logger } from '@wdio/logger';
import chalk from 'chalk';
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import * as readline from 'readline';
import { SevereServiceError } from 'webdriverio';
import TestSettings from '../types/test-settings.js';
import checkIfUp from './check-if-up.js';
import { makeTestSettings } from './make-test-settings.js';

declare global {
	// eslint-disable-next-line no-var, no-use-before-define
	var testEnv: TestEnv | undefined;
}

export default class TestEnv {
	public settings: TestSettings;

	public testLog: Logger;

	public baseDockerComposeCmd: string;

	public static create( settings: Partial<TestSettings> ): TestEnv {
		return new this( makeTestSettings( settings ) );
	}

	public constructor( settings?: TestSettings ) {
		if ( !settings ) {
			throw new Error( 'Settings are required to create a Test Environment' );
		}

		this.settings = settings;
		this.testLog = logger( 'test-env' );
		this.testLog.setDefaultLevel( 'debug' );
		this.baseDockerComposeCmd = this.makeBaseDockerComposeCmd();
	}

	public get vars(): Record<string, string> {
		return this.settings.vars;
	}

	public async up(): Promise<void> {
		try {
			await this.setupExitListener();
			this.resetOutputDir();
			if ( this.settings.beforeServices ) {
				await this.settings.beforeServices();
			}
			console.log(
				`▶️  Bringing up the test environment ${ this.settings.debug ? '(DEBUG)' : '' }`
			);

			await this.stopServices();
			await this.startServices();

			if ( this.settings.runHeaded ) {
				console.log(
					'💻 Open http://localhost:7900/?autoconnect=1&resize=scale to observe headed tests.\n'
				);
			}

			await this.waitForServices();
		} catch ( e ) {
			throw new SevereServiceError( e );
		}
	}

	public async down(): Promise<void> {
		await this.stopServices();
	}

	public async waitForServices(): Promise<void[]> {
		return Promise.all(
			this.settings
				.waitForUrls()
				.map( async ( waitForURL: string ): Promise<void> => {
					await checkIfUp( waitForURL, this.settings.testTimeout );
					this.testLog.info( `ℹ️  Successfully loaded ${ waitForURL }` );
				} )
		);
	}

	public async runDockerComposeCmd(
		dockerComposeOptionsCommandAndArgs: string
	): Promise<string> {
		const dockerComposeCmd = `${ this.baseDockerComposeCmd } ${ dockerComposeOptionsCommandAndArgs }`;

		this.testLog.debug( 'Running: ', dockerComposeCmd );

		const result = spawnSync( dockerComposeCmd, {
			stdio: 'pipe',
			shell: true,
			encoding: 'utf-8',
			env: {
				...process.env,
				...this.vars,
				OUTPUT_DIR: this.settings.outputDir
			}
		} );

		// Docker Compose puts all status logging stderr so we instead use
		// the exit code (status) to catch any actual critical failures, ref:
		// https://github.com/docker/compose/issues/7346
		if ( result.status !== 0 ) {
			this.testLog.debug( result.stderr );
			throw new SevereServiceError( result.stderr );
		}

		return result.stdout;
	}

	public async exitPrompt(): Promise<void> {
		if ( !process.stdout.isTTY ) {
			return null;
		}

		console.log(
			chalk.yellow(
				`\nExiting and taking "${ this.settings.name }" test environment DOWN in 5 seconds...`
			)
		);
		console.log(
			chalk.yellow(
				`<Ctrl-C>  Do that now or <Enter> to exit and keep the "${ this.settings.name }" test environment UP`
			)
		);

		const takeDown = async (): Promise<void> => {
			console.log(
				chalk.red(
					`Exiting. Taking "${ this.settings.name }" test environment DOWN`
				)
			);
			await this.down();
			process.stdin.setEncoding( null );
			// eslint-disable-next-line no-use-before-define
			process.stdin.removeListener( 'keypress', onKeyPress );
			// eslint-disable-next-line n/no-process-exit
			process.exit( 1 );
		};

		const leaveUp = (): void => {
			console.log(
				chalk.green(
					`Exiting. Leaving ${ this.settings.name }" test environment UP`
				)
			);
			process.stdin.setEncoding( null );
			// eslint-disable-next-line no-use-before-define
			process.stdin.removeListener( 'keypress', onKeyPress );
			// eslint-disable-next-line n/no-process-exit
			process.exit( 1 );
		};

		const onKeyPress = async ( _, key ): Promise<void> => {
			if ( key && key.ctrl && key.name === 'c' ) {
				await takeDown();
			}
			if ( key && key.name === 'return' ) {
				leaveUp();
			}
		};

		readline.emitKeypressEvents( process.stdin );
		process.stdin.setEncoding( 'utf8' ).setRawMode( true ).resume();
		process.stdin.on( 'keypress', onKeyPress );

		setTimeout( takeDown, 5000 );
	}

	protected async setupExitListener(): Promise<void> {
		if ( !process.stdout.isTTY ) {
			return null;
		}

		const onKeyPress = async ( _, key ): Promise<void> => {
			if ( key.ctrl && key.name === 'c' ) {
				process.stdin.removeListener( 'keypress', onKeyPress );
				await this.exitPrompt();
			}
		};

		readline.emitKeypressEvents( process.stdin );
		process.stdin.setEncoding( 'utf8' ).setRawMode( true ).resume();
		process.stdin.on( 'keypress', onKeyPress );
	}

	protected resetOutputDir(): void {
		try {
			rmSync( this.settings.outputDir, { recursive: true, force: true } );
			// eslint-disable-next-line security/detect-non-literal-fs-filename
			mkdirSync( this.settings.outputDir, { recursive: true } );
		} catch ( e ) {
			this.testLog.error(
				'❌ Error occurred in setting-up outuput directory:',
				e
			);
		}
	}

	protected makeBaseDockerComposeCmd(): string {
		const dockerComposeCmdArray: string[] = [
			'docker compose',
			'--env-file test-runner.env',
			existsSync( '../local.env' ) ? '--env-file ../local.env' : '',
			`--project-directory ${ this.settings.pwd }/suites`,
			'-p wbs-dev-test-services'
		];

		this.settings.composeFiles.forEach( ( composeFile ) =>
			dockerComposeCmdArray.push( `-f ${ composeFile }` )
		);
		this.settings.composeProfiles.forEach( ( composeProfile ) =>
			dockerComposeCmdArray.push( `--profile ${ composeProfile }` )
		);

		return dockerComposeCmdArray.join( ' ' );
	}

	protected async startServices(): Promise<void> {
		this.testLog.info( '▶️  Starting Wikibase Suite services' );
		await this.runDockerComposeCmd( 'up -d --wait' );
	}

	protected async stopServices( removeVolumes: boolean = true ): Promise<void> {
		this.testLog.info( '▶️  Stopping Wikibase Suite services' );
		await this.runDockerComposeCmd(
			`down ${ removeVolumes && '--volumes' } --remove-orphans --timeout 1`
		);
	}
}
