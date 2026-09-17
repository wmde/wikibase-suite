import page from '../_helpers/pages/page.js';

describe( 'UniversalLanguageSelector', function () {
	beforeEach( async function () {
		await browser.skipIfExtensionNotPresent( this, 'UniversalLanguageSelector' );
	} );

	it( 'Should be able to see the language selector menu', async function () {
		await page.open( '' );

		const searchInput = $( '#searchform input' );

		await searchInput.click();
		// work around lang selector not showing up the first time
		// blur the search bar
		await browser.keys( 'Tab' );
		// focus search bar again, lang selector should be there now
		await searchInput.click();

		// We need to use getHTML(). If an element isn't interactable
		// getText() returns an empty string.
		// https://webdriver.io/docs/api/element/getText/
		await expect(
			$( 'div.imeselector-menu h3.ime-list-title' ).getHTML()
		).resolves.toMatch( /English/ );
	} );
} );
