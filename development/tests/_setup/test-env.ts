import logger, { Logger } from '@wdio/logger';
import chalk from 'chalk';
import { spawnSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import * as readline from 'readline';
import { SevereServiceError } from 'webdriverio';
import TestSettings from '../_types/test-settings.js';
import checkIfUp from './check-if-up.js';
import { makeTestSettings } from './make-test-settings.js';

declare global {
	var testEnv: TestEnv | undefined;
}

export default class TestEnv {
	public settings: TestSettings;

	public testLog: Logger;

	public baseDockerComposeCmd: string;

	private exitKeypressListener?: (
		character: string,
		key: readline.Key
	) => Promise<void>;

	private stdinWasRaw = false;

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
			if ( this.settings.beforeServices ) {
				await this.settings.beforeServices();
			}
			console.log(
				`▶️ Bringing up the "${ this.settings.name }" test environment${ this.settings.debug ? ' (DEBUG)' : '' }`
			);

			await this.stopServices();
			this.resetOutputDir();
			this.prepareConfigurationDirectories();
			await this.startServices();

			if ( this.settings.runHeaded ) {
				console.log(
					'💻 Open http://localhost:7900/?autoconnect=1&resize=scale to observe headed tests.\n'
				);
			}

			await this.waitForServices();
		} catch ( e ) {
			this.releaseExitListener();
			throw new SevereServiceError( e );
		}
	}

	public async down(): Promise<void> {
		try {
			await this.stopServices();
		} finally {
			this.releaseExitListener();
		}
	}

	public releaseExitListener(): void {
		if ( !this.exitKeypressListener ) {
			return;
		}

		process.stdin.removeListener( 'keypress', this.exitKeypressListener );
		if ( process.stdin.isTTY ) {
			process.stdin.setRawMode( this.stdinWasRaw );
		}
		process.stdin.pause();
		this.exitKeypressListener = undefined;
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
			// A non-interactive runner cannot answer the failure prompt. Do not
			// strand its isolated Compose project (or its volumes) in that case.
			await this.down();
			return;
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
			process.stdin.removeListener( 'keypress', onKeyPress );
			process.exit( 1 );
		};

		const leaveUp = (): void => {
			console.log(
				chalk.green(
					`Exiting. Leaving ${ this.settings.name }" test environment UP`
				)
			);
			process.stdin.setEncoding( null );
			process.stdin.removeListener( 'keypress', onKeyPress );
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
		if ( !process.stdout.isTTY || !process.stdin.isTTY ) {
			return null;
		}

		this.releaseExitListener();
		this.stdinWasRaw = process.stdin.isRaw;
		this.exitKeypressListener = async ( _, key ): Promise<void> => {
			if ( key.ctrl && key.name === 'c' ) {
				this.releaseExitListener();
				await this.exitPrompt();
			}
		};

		readline.emitKeypressEvents( process.stdin );
		process.stdin.setEncoding( 'utf8' ).setRawMode( true ).resume();
		process.stdin.on( 'keypress', this.exitKeypressListener );
	}

	protected resetOutputDir(): void {
		try {
			rmSync( this.settings.outputDir, { recursive: true, force: true } );
			mkdirSync( this.settings.outputDir, { recursive: true } );
		} catch ( e ) {
			this.testLog.error(
				'❌ Error occurred in setting-up outuput directory:',
				e
			);
		}
	}

	protected prepareConfigurationDirectories(): void {
		for ( const relativeDirectory of this.settings.configurationDirectories ) {
			const configurationDirectory = resolve(
				process.cwd(),
				relativeDirectory
			);
			rmSync( configurationDirectory, { recursive: true, force: true } );
			if ( this.settings.prepareConfigurationDirectory ) {
				mkdirSync( configurationDirectory, { recursive: true } );
				this.settings.prepareConfigurationDirectory( configurationDirectory );
				continue;
			}
			mkdirSync( resolve( configurationDirectory, '.wikibase-image' ), {
				recursive: true
			} );
			writeFileSync(
				resolve(
					configurationDirectory,
					'.wikibase-image/installation-state'
				),
				'preparing\n'
			);
			copyFileSync(
				resolve( process.cwd(), '_setup/LocalSettings.php' ),
				resolve( configurationDirectory, 'LocalSettings.php' )
			);
		}
	}

	protected makeBaseDockerComposeCmd(): string {
		const dockerComposeCmdArray: string[] = [
			'docker compose',
			'--env-file test-runner.env',
			existsSync( '../local.env' ) ? '--env-file ../local.env' : '',
			`--project-directory ${ this.settings.pwd }`,
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
		// A cold MediaWiki install can exceed Compose's 60-second default on CI.
		await this.runDockerComposeCmd( 'up -d --wait --wait-timeout 180' );
	}

	protected async stopServices( removeVolumes: boolean = true ): Promise<void> {
		this.testLog.info( '▶️  Stopping Wikibase Suite services' );
		await this.runDockerComposeCmd(
			`down ${ removeVolumes && '--volumes' } --remove-orphans --timeout 1`
		);
	}
}
