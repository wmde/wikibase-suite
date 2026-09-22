import page from '../_helpers/pages/page.js';

describe( 'Wikimedia login', function () {
	it( 'Should offer login through Wikimedia when a consumer is configured', async function () {
		await page.open( '/wiki/Special:UserLogin' );

		await browser.waitUntil(
			async () => {
				const pageText = await browser.execute( () => document.body.innerText );
				return pageText.includes( 'Log in with Wikimedia' );
			},
			{
				timeout: 10000,
				timeoutMsg:
					'Expected a Wikimedia login option when OAuth credentials are configured'
			}
		);
	} );
} );
