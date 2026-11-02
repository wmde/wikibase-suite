import axios, { AxiosResponse } from 'axios';
import lodash from 'lodash';
import { Context } from 'mocha';
import WikibaseApi from 'wdio-wikibase/wikibase.api.js';
import BotResponse from '../types/bot-response.js';
import DatabaseConfig from '../types/database-config.js';
import ExternalChange from '../types/external-change.js';
import LuaCPUValue from '../types/lua-cpu-value.js';
import { TestSettings } from '../types/test-settings.js';

export function defaultFunctions(): void {
	const settings: TestSettings = testEnv.settings;

	/**
	 * Execute query on database
	 */
	browser.addCommand(
		'dbQuery',
		async ( query: string, config?: DatabaseConfig ): Promise<string> => {
			if ( !config ) {
				config = {
					user: testEnv.vars.DB_USER,
					pass: testEnv.vars.DB_PASS,
					database: testEnv.vars.DB_NAME
				};
			}

			if ( !config.user || !config.pass || !config.database ) {
				throw new Error(
					`dbQuery: Configuration error! ${ JSON.stringify( config ) }`
				);
			}

			const result = await testEnv.runDockerComposeCmd(
				`exec mysql mysql --user ${ config.user } --password=${ config.pass } ${ config.database } -e '${ query }'`
			);

			testEnv.testLog.debug( result );

			return result;
		}
	);

	/**
	 * Delete a claim by guid or pipe-separated list of guids
	 */
	browser.addCommand(
		'deleteClaim',
		async ( claimGuid: string ): Promise<BotResponse> => {
			const api = await WikibaseApi.getApi();

			return api.request( {
				action: 'wbremoveclaims',
				claim: claimGuid,
				token: await api.getEditToken()
			} );
		}
	);

	/**
	 * Creates or edits a page with content
	 */
	browser.addCommand(
		'editPage',
		async (
			host: string,
			title: string,
			content: Buffer | string,
			captcha: string = null
		): Promise<string> => {
			await browser.url( `${ host }/wiki/${ title }?action=edit` );

			// wait for javascript to settle
			// eslint-disable-next-line wdio/no-pause
			await browser.pause( 5 * 1000 );

			// this shows up one time for anonymous users (VisualEditor)
			const startEditbutton = await $(
				'.oo-ui-messageDialog-actions .oo-ui-flaggedElement-progressive'
			);
			if ( startEditbutton.elementId ) {
				await startEditbutton.click();

				// wait for fade out animation to finish
				// eslint-disable-next-line wdio/no-pause
				await browser.pause( 2 * 1000 );
			}

			// fill out form
			await $( '#wpTextbox1' ).setValue( content.toString() );

			if ( captcha ) {
				await $( '#wpCaptchaWord' ).setValue( captcha );
			}

			// save page
			await browser.execute( async () => $( '#editform.mw-editform' ).submit() );

			// eslint-disable-next-line wdio/no-pause
			await browser.pause( 2 * 1000 );

			return await $( '#mw-content-text' ).getText();
		}
	);

	/**
	 * Execute quickstatements query
	 */
	browser.addCommand(
		'executeQuickStatement',
		async ( theQuery: string ): Promise<void> => {
			await browser.url( `${ testEnv.vars.QUICKSTATEMENTS_URL }/#/` );
			await browser.url( `${ testEnv.vars.QUICKSTATEMENTS_URL }/#/batch` );

			// create a batch
			const batchEditor = $( '.create_batch_box textarea' );
			await batchEditor.waitForExist();
			await batchEditor.setValue( theQuery );

			// eslint-disable-next-line wdio/no-pause
			await browser.pause( 1000 );

			// click import
			await $( "button[tt='dialog_import_v1']" ).click();

			// eslint-disable-next-line wdio/no-pause
			await browser.pause( 1000 );

			// click run
			await $( "button[tt='run']" ).click();

			const commands = await $$( '.command_status' );

			await browser.waitUntil(
				async () => {
					const commandTextArray = await Promise.all(
						await commands.map( async ( command ) => command.getText() )
					);
					return commandTextArray.every(
						( commandText ) => commandText === 'done'
					);
				},
				{
					timeout: 10000,
					timeoutMsg: 'Expected to be done after 10 seconds'
				}
			);
		}
	);

	/**
	 * Moves browser to recent changes then asserts that a change is in the api result
	 */
	browser.addCommand(
		'getDispatchedExternalChange',
		async (
			host: string,
			expectedChange: ExternalChange
		): Promise<ExternalChange | null> => {
			// to get a screenshot
			await browser.url(
				`${ host }/wiki/Special:RecentChanges?limit=50&days=7&urlversion=2`
			);

			const apiURL = `${ host }/w/api.php?format=json&action=query&list=recentchanges&rctype=external&rcprop=comment|title`;
			let foundResult: ExternalChange;

			await browser.waitUntil(
				async () => {
					const result = await browser.makeRequest( apiURL );
					expect( result.status ).toEqual( 200 );
					const changes = result.data.query.recentchanges;
					foundResult = lodash.find( changes, expectedChange );
					return Boolean( foundResult );
				},
				{
					timeout: settings.waitForTimeout,
					interval: 1000,
					timeoutMsg: `Could not find dispatched change ${ JSON.stringify(
						expectedChange
					) }`
				}
			);

			return foundResult;
		}
	);

	/**
	 * Makes a request to a page and returns the lua cpu profiling data
	 */
	browser.addCommand(
		'getLuaCpuTime',
		async ( host: string, page: string ): Promise<LuaCPUValue> => {
			const response = await browser.makeRequest( `${ host }/wiki/${ page }` );

			const cpuMatches = response.data.match(
				/(CPU time usage:) ([-.0-9]+) (\w+)/
			);
			const cpuTime = parseFloat( cpuMatches[ 2 ] );
			const cpuTimeScale = cpuMatches[ 3 ];

			return { value: cpuTime, scale: cpuTimeScale };
		}
	);

	/**
	 * Make a get request to get full request response
	 */
	browser.addCommand(
		'makeRequest',
		async (
			url: string,
			params?: Record<string, unknown>,
			postData?: Record<string, unknown>
		): Promise<Partial<AxiosResponse>> => {
			if ( postData ) {
				const { data, status } = await axios.post( url, postData, params );
				return { data, status };
			} else {
				const { data, status } = await axios.get( url, params );
				return { data, status };
			}
		}
	);

	/**
	 * Skip test if extension is not installed (present) on the Wikibase server
	 */
	browser.addCommand(
		'skipIfExtensionNotPresent',
		async ( test: Context, extension: string ): Promise<void> => {
			const installedExtensions = await getInstalledExtensions(
				testEnv.vars.WIKIBASE_URL
			);
			if ( !installedExtensions || installedExtensions.length === 0 ) {
				return;
			} else if (
				installedExtensions &&
				installedExtensions.includes( 'WikibaseRepository' ) &&
				installedExtensions.includes( extension )
			) {
				return;
			} else {
				test.skip();
			}
		}
	);

	browser.addCommand(
		'waitForJobs',
		async (
			serverURL: string = testEnv.vars.WIKIBASE_URL,
			timeout: number = settings.testTimeout - 1000,
			timeoutMsg: string = null
		): Promise<boolean> => {
			let jobsInQueue: number;

			return browser.waitUntil(
				async () => {
					const result = await browser.makeRequest(
						`${ serverURL }/w/api.php?action=query&meta=siteinfo&siprop=statistics&format=json`,
						{ validateStatus: false },
						{}
					);
					jobsInQueue = result.data.query.statistics.jobs;
					testEnv.testLog.info(
						`waitForJobs: ${ jobsInQueue } currently in queue}`
					);
					return jobsInQueue === 0;
				},
				{
					timeout,
					timeoutMsg:
						timeoutMsg ||
						`Timeout: Job queue on "${ serverURL }" still contains ${ jobsInQueue } jobs after waiting ${
							timeout / 1000
						} seconds.`
				}
			);
		}
	);

	browser.addCommand(
		'getMediaWikiVersion',
		async (
			serverURL: string = testEnv.vars.WIKIBASE_URL
		): Promise<string> => {
			const result = await browser.makeRequest(
				`${ serverURL }/w/api.php?action=query&meta=siteinfo&siprop=general&format=json`,
				{ validateStatus: false },
				{}
			);
			const generatorString = result.data.query.general.generator;
			const regex = /MediaWiki\s+(\d+\.\d+\.\d+)/i;
			const match = generatorString.match( regex );

			if ( !match || !match[ 1 ] ) {
				throw new Error(
					`Cannot get MediaWiki Version via ActionAPI serverURL=${ serverURL }, generatorString=${ generatorString }`
				);
			}

			return match[ 1 ];
		}
	);
}

/**
 * Get installed extensions on wiki (for given server URL)
 *
 * @param {string} serverUrl
 * @return {Object}
 */
export async function getInstalledExtensions(
	serverUrl: string
): Promise<string[] | undefined> {
	const result = await browser.makeRequest(
		`${ serverUrl }/w/api.php?action=query&meta=siteinfo&siprop=extensions&format=json`
	);
	return lodash.map( result.data.query.extensions, 'name' );
}
