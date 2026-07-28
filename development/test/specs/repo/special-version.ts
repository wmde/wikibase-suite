import page from '../../helpers/pages/page.js';

describe( 'Special:Version', function () {
	it( 'Should contain the correct MediaWiki version', async function () {
		await page.open( '/wiki/Special:Version' );
		await expect( $( '#sv-software' ) ).toHaveText(
			// NOTE: do not use browser.getMediaWikiVersion() here in order to compare
			// built version to actual version being tested... as an extra sanity check
			// eslint-disable-next-line security/detect-non-literal-regexp
			new RegExp( `MediaWiki ${ testEnv.vars.MEDIAWIKI_VERSION }` )
		);
	} );

	it( 'Should not contain Wikibase EDTF by default', async function () {
		await page.open( '/wiki/Special:Version' );
		await expect( $( '#mw-version-ext-other-Wikibase_EDTF' ) ).not.toExist();
	} );

	const extensions = {
		wikibase: [
			'EntitySchema',
			'WikibaseCirrusSearch',
			'WikibaseClient',
			'Wikibase Local Media',
			'WikibaseRepository',
			'WikibaseManifest'
		],
		other: [
			'CLDR',
			'CirrusSearch',
			'DiscussionTools',
			'Elastica',
			'OAuth',
			'Parsoid',
			'UniversalLanguageSelector'
		],
		parserhook: [ 'Babel', 'Scribunto' ],
		editor: [ 'VisualEditor' ],
		antispam: [ 'ConfirmEdit' ],
		specialpage: [ 'Confirm User Accounts', 'Echo', 'Linter', 'Nuke' ]
	};

	// should be disabled for dynamic tests
	// eslint-disable-next-line mocha/no-setup-in-describe
	Object.keys( extensions ).forEach( ( extensionPackage ) => {
		extensions[ extensionPackage ].forEach( ( extension: string ) => {
			// Get the extension name from the override if available
			const name = extension;

			it( `Should contain ${ name } extensions`, async function () {
				await browser.skipIfExtensionNotPresent( this, name );
				await page.open( '/wiki/Special:Version' );

				// /wiki/Special:Version generate these for each installed extension
				const elementSelector = await $(
					`#mw-version-ext-${ extensionPackage }-${ extension.replace( / /g, '_' ) }`
				);
				await elementSelector.scrollIntoView();

				await expect( elementSelector ).toHaveText( /.+/ );
			} );
		} );
	} );
} );
