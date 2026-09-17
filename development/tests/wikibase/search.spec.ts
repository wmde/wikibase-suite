import { getTestString } from 'wdio-mediawiki/Util.js';
import WikibaseApi from 'wdio-wikibase/wikibase.api.js';

describe( 'Fallback entity search', function () {
	it( 'Should find a newly created item without OpenSearch', async function () {
		const itemLabel = getTestString( 'search-' );
		const itemId = await WikibaseApi.createItem( itemLabel, {} );

		let searchResult;
		await browser.waitUntil(
			async () => {
				const result = await browser.makeRequest(
					`${ testEnv.vars.WIKIBASE_URL }/w/api.php?action=wbsearchentities&search=${ encodeURIComponent( itemLabel ) }&format=json&errorformat=plaintext&language=en&uselang=en&type=item`
				);
				searchResult = result.data.search.find(
					( item ) => item.id === itemId
				);
				return searchResult !== undefined;
			},
			{
				timeoutMsg: `Expected ${ itemId } to appear in search results`
			}
		);

		expect( searchResult.label ).toEqual( itemLabel );
	} );
} );
