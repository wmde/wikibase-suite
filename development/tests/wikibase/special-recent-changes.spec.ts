import page from '../_helpers/pages/page.js';

describe( 'Special:RecentChanges', function () {
	beforeEach( async function () {
		await page.open(
			'/wiki/Special:RecentChanges?limit=50&days=7&urlversion=2&enhanced=0'
		);
	} );

	it( 'Should be able to change limit', async function () {
		await expect(
			$( 'div.mw-rcfilters-ui-changesLimitAndDateButtonWidget' )
		).toHaveText( /50 changes/ );
		await $( 'div.mw-rcfilters-ui-changesLimitAndDateButtonWidget' ).click();
		await $( 'div.mw-rcfilters-ui-changesLimitPopupWidget' )
			.$( 'span=100' )
			.click();
		await expect(
			$( 'div.mw-rcfilters-ui-changesLimitAndDateButtonWidget' )
		).toHaveText( /100 changes/ );
	} );

	it( 'Should be able to change time to 2 hours', async function () {
		await expect(
			$( 'div.mw-rcfilters-ui-changesLimitAndDateButtonWidget' )
		).toHaveText( /7 days/ );
		await $( 'div.mw-rcfilters-ui-changesLimitAndDateButtonWidget' ).click();
		await $( 'div.mw-rcfilters-ui-datePopupWidget-hours' ).$( 'span=2' ).click();
		await expect(
			$( 'div.mw-rcfilters-ui-changesLimitAndDateButtonWidget' )
		).toHaveText( /2 hours/ );
	} );

	it( 'Should be able to change time to 3 days', async function () {
		await expect(
			$( 'div.mw-rcfilters-ui-changesLimitAndDateButtonWidget' )
		).toHaveText( /7 days/ );
		await $( 'div.mw-rcfilters-ui-changesLimitAndDateButtonWidget' ).click();
		await $( 'div.mw-rcfilters-ui-datePopupWidget-days' ).$( 'span=3' ).click();
		await expect(
			$( 'div.mw-rcfilters-ui-changesLimitAndDateButtonWidget' )
		).toHaveText( /3 days/ );
	} );
} );
