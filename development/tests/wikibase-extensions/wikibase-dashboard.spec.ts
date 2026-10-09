import WikibaseApi from 'wdio-wikibase/wikibase.api.js';
import Page from "../_helpers/pages/page.js";

async function hasEntitiesOfType( type: 'item' | 'property' ): Promise<boolean> {
    const api = await WikibaseApi.getApi();

    const namespace = type === 'item' ? 120 : 122;

    const response = await api.request( {
        action: 'query',
        list: 'allpages',
        apnamespace: namespace,
        aplimit: 1,
    } );

    return ( response.query?.allpages?.length ?? 0 ) > 0;
}

async function isWikibaseEmpty(): Promise<boolean> {
    const hasItems = await hasEntitiesOfType('item');
    const hasProperties = await hasEntitiesOfType('property');

    return !hasItems && !hasProperties;
}

describe( 'WikibaseSuite Dashboard', function () {

	before( async function () {
		await browser.skipIfExtensionNotPresent( this, 'WikibaseSuite' );
	} );

	it( 'Should redirect Main Page to the dashboard only while the wikibase is empty', async function () {
		await Page.open( "/" );

        const isEmpty = await isWikibaseEmpty();
        expect( isEmpty ).toBe( true );

        const url = await browser.getUrl();
        expect( url ).toContain( 'Special:WikibaseDashboard' );
	} );

	it( 'Should stop redirecting to the dashboard once an item exists', async function () {
		await WikibaseApi.createItem( 'dashboard-redirect-test' );

        const isEmpty = await isWikibaseEmpty();
        expect( isEmpty ).toBe( false );

		await Page.open( "/" );
        const url = await browser.getUrl();

		expect( url ).not.toContain( 'Special:WikibaseDashboard' );
	} );

    it( 'Should update the table to show the number of entities added', async function () {
        await Page.open( '/wiki/Special:WikibaseDashboard' );

        const startingTableItemCount = await $( '#wbs-dashboard-item-count' ).getText();
        await WikibaseApi.createItem( 'dashboard-redirect-test' );
        const updatedTableItemCount = await $( '#wbs-dashboard-item-count' ).getText();
        expect( Number(updatedTableItemCount) ).toEqual( Number(startingTableItemCount) + 1 );

        const startingTablePropertyCount = await $( '#wbs-dashboard-property-count' ).getText();
        await WikibaseApi.createProperty( 'string', { 'foo': 'bar' } );
        const updatedTablePropertyCount = await $( '#wbs-dashboard-property-count' ).getText();
        expect( Number(updatedTablePropertyCount) ).toEqual( Number(startingTablePropertyCount) + 1 );
    } );
} );