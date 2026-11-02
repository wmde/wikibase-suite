import LoginPage from '../../helpers/pages/login.page.js';
import { getTestString } from 'wdio-mediawiki/Util.js';
import WikibaseApi from 'wdio-wikibase/wikibase.api.js';
import ItemPage from '../../helpers/pages/entity/item.page.js';
import page from '../../helpers/pages/page.js';
import SearchResult from '../../types/search-result.js';

const itemAlias: string = getTestString( 'alias' );
const itemLabel: string = getTestString( 'testItem' );

describe( 'ElasticSearch', function () {
	let itemId: string;

	before( async function () {
		await LoginPage.login(
			testEnv.vars.MW_ADMIN_NAME,
			testEnv.vars.MW_ADMIN_PASS
		);
	} );

	it( 'Should create an item', async function () {
		itemId = await WikibaseApi.createItem( itemLabel );

		await ItemPage.open( itemId );
		await $(
			'.wikibase-toolbarbutton.wikibase-toolbar-item.wikibase-toolbar-button.wikibase-toolbar-button-add'
		);
	} );

	it( 'Should be able to set alias', async function () {
		await page.open( '/wiki/Special:SetAliases/' );

		// input id
		await $( '#wb-modifyentity-id input' ).setValue( itemId );

		// input alias term and submit
		await $( '#wb-modifyterm-value input' ).setValue( itemAlias );

		await $( 'button.oo-ui-inputWidget-input' ).click();

		// alias should be visible on item page
		await expect( $( '.wikibase-aliasesview-list-item' ) ).toHaveText( itemAlias );
	} );

	it( 'Should load the Elasticsearch extensions', async function () {
		await page.open( '/wiki/Special:Version' );
		await expect( $( '#mw-version-ext-wikibase-WikibaseCirrusSearch' ) ).toExist();
		await expect( $( '#mw-version-ext-other-CirrusSearch' ) ).toExist();
		await expect( $( '#mw-version-ext-other-Elastica' ) ).toExist();
	} );

	it( 'should be able to search case-insensitive', async function () {
		let searchResult: SearchResult[];

		const testLabel = 'Testitem';
		expect( itemLabel ).not.toMatch( testLabel );
		expect( itemLabel.toLowerCase() ).toMatch( testLabel.toLowerCase() );

		await browser.waitUntil(
			async () => {
				const resp = await browser.makeRequest(
					`${ testEnv.vars.WIKIBASE_URL }/w/api.php?action=wbsearchentities&search=${ testLabel }&format=json&errorformat=plaintext&language=en&uselang=en&type=item`
				);
				searchResult = resp.data.search;

				return (
					searchResult.length === 1 &&
					searchResult[ 0 ].id === itemId &&
					searchResult[ 0 ].match.type === 'label' &&
					searchResult[ 0 ].match.text === itemLabel
				);
			},
			{
				timeout: 20 * 1000,
				timeoutMsg: 'Elasticsearch should have updated the label by now.'
			}
		);

		expect( searchResult ).toHaveLength( 1 );
		expect( searchResult[ 0 ].id ).toEqual( itemId );
		expect( searchResult[ 0 ].match.type ).toEqual( 'label' );
		expect( searchResult[ 0 ].match.text ).toEqual( itemLabel );
	} );

	it( 'should be able to search via alias', async function () {
		let searchResult: SearchResult[];

		await browser.waitUntil(
			async () => {
				const resp = await browser.makeRequest(
					`${ testEnv.vars.WIKIBASE_URL }/w/api.php?action=wbsearchentities&search=alias&format=json&errorformat=plaintext&language=en&uselang=en&type=item`
				);
				searchResult = resp.data.search;

				return (
					searchResult.length === 1 &&
					searchResult[ 0 ].id === itemId &&
					searchResult[ 0 ].match.type === 'alias' &&
					searchResult[ 0 ].match.text === itemAlias
				);
			},
			{
				timeout: 20 * 1000,
				timeoutMsg: 'Elasticsearch should have updated the alias by now.'
			}
		);

		expect( searchResult ).toHaveLength( 1 );
		expect( searchResult[ 0 ].id ).toEqual( itemId );
		expect( searchResult[ 0 ].match.type ).toEqual( 'alias' );
		expect( searchResult[ 0 ].match.text ).toEqual( itemAlias );
	} );
} );
