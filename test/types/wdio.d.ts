declare namespace WebdriverIO {
	type AxiosResponse = import( 'axios' ).AxiosResponse;
	type Binding = import( './binding.js' ).default;
	type BotResponse = import( './bot-response.js' ).default;
	type Context = import( 'mocha' ).Context;
	type DatabaseConfig = import( './database-config.js' ).default;
	type ExternalChange = import( './external-change.js' ).default;
	type LuaCPUValue = import( './lua-cpu-value.js' ).default;

	interface Capabilities {
		'mw:user'?: string;
		'mw:pwd'?: string;
		'mw:screenshotPath'?: string;
	}

	interface Browser {
		/**
		 * Execute query on database
		 */
		dbQuery: ( query: string, config?: DatabaseConfig ) => Promise<string>;

		/**
		 * Delete a claim by guid or pipe-separated list of guids
		 */
		deleteClaim: ( claimGuid: string ) => Promise<BotResponse>;

		/**
		 * Creates or edits a page with content
		 */
		editPage: (
			host: string,
			title: string,
			content: Buffer | string,
			captcha?: string
		) => Promise<string>;

		/**
		 * Execute quickstatements query
		 */
		executeQuickStatement: ( theQuery: string ) => Promise<void>;

		/**
		 * Moves browser to recent changes then asserts that a change is in the api result
		 */
		getDispatchedExternalChange: (
			host: string,
			expectedChange: ExternalChange
		) => Promise<ExternalChange | null>;

		/**
		 * Makes a request to a page and returns the lua cpu profiling data
		 */
		getLuaCpuTime: ( host: string, page: string ) => Promise<LuaCPUValue>;

		/**
		 * Make a get request to get full request response
		 */
		makeRequest: (
			url: string,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			params?: any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			postData?: any
		) => Promise<AxiosResponse>;

		/**
		 * Skip test if extension is not installed (present) on the Wikibase server
		 */
		skipIfExtensionNotPresent: (
			test: Context,
			extension: string
		) => Promise<void>;

		waitForJobs: (
			serverURL?: string,
			timeout?: number,
			timeoutMsg?: string
		) => Promise<boolean>;

		getMediaWikiVersion: (
			serverURL?: string
		) => Promise<string>;
	}

	interface Element {
		submit: () => Promise<void>;
	}
}
