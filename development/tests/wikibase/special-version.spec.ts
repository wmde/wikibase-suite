import page from '../_helpers/pages/page.js';

describe( 'Special:Version', function () {
	it( 'Should contain the correct MediaWiki version', async function () {
		await page.open( '/wiki/Special:Version' );
		await expect( $( '#sv-software' ) ).toHaveText(
			// NOTE: do not use browser.getMediaWikiVersion() here in order to compare
			// built version to actual version being tested... as an extra sanity check
			new RegExp( `MediaWiki ${ testEnv.vars.MEDIAWIKI_VERSION }` )
		);
	} );
} );
