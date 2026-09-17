import page from '../_helpers/pages/page.js';

describe( 'Anonymous access defaults', function () {
	beforeEach( async function () {
		await browser.deleteCookies();
	} );

	it( 'Should allow anonymous users to read wiki pages', async function () {
		await page.open( '/wiki/Main_Page' );

		const currentUrl = await browser.getUrl();
		expect( currentUrl ).not.toContain( 'Special:UserLogin' );
		await expect( $( '#firstHeading' ) ).toBeDisplayed();
		await expect( $( '#mw-content-text' ) ).toBeDisplayed();
	} );

	it( 'Should block anonymous users from editing pages', async function () {
		const pageTitle = `Anonymous_write_smoke_${ Date.now() }`;

		await browser.url( `${ testEnv.vars.WIKIBASE_URL }/wiki/${ pageTitle }?action=edit` );

		await expect( $( '#firstHeading' ) ).toHaveText( 'Permission error' );
		await expect( $( '#mw-content-text' ) ).toHaveText(
			expect.stringContaining( 'You do not have permission to create this page' )
		);
		await expect( $( '#pt-login-2 a' ) ).toBeDisplayed();
	} );
} );
