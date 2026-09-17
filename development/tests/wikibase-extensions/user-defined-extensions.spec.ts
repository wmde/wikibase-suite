import page from '../_helpers/pages/page.js';

describe( 'Special:Version', function () {
	it( 'Should have user defined extension loaded', async function () {
		await page.open( '/wiki/Special:Version' );
		const extensionInfo = await $( '#mw-version-ext-other-Wikibase_Suite_Test_Extension' ).getText();
		await expect( extensionInfo ).toMatch( /^Wikibase Suite Test Extension.*/ );
	} );
} );
