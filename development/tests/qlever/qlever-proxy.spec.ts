import { getTestString } from 'wdio-mediawiki/Util.js';
import WikibaseApi from 'wdio-wikibase/wikibase.api.js';

const proxyQuery = async ( query: string ) =>
	await browser.makeRequest( `${ testEnv.vars.WDQS_URL }/sparql`, {
		params: { query, format: 'application/sparql-results+json' }
	} );

describe( 'WDQS QLever proxy', function () {
	it( 'serves ordinary SPARQL through the public Query Service endpoint', async function () {
		const result = await proxyQuery( 'ASK {}' );

		expect( result.status ).toEqual( 200 );
		expect( result.data.boolean ).toEqual( true );
	} );

	it( 'rewrites SERVICE wikibase:label for the Suite RDF base', async function () {
		const label = getTestString( 'qlever-proxy-label-' );
		const itemId = await WikibaseApi.createItem( label );

		await browser.waitUntil( async () => {
			const result = await proxyQuery( `
				SELECT ?itemLabel WHERE {
					BIND(<${ testEnv.vars.WIKIBASE_URL }/entity/${ itemId }> AS ?item)
					SERVICE wikibase:label {
						bd:serviceParam wikibase:language "en".
					}
				}` );
			return result.status === 200 && result.data.results.bindings.some(
				( binding: { itemLabel: { value: string } } ) => binding.itemLabel.value === label
			);
		}, {
			interval: 1000,
			timeoutMsg: `Expected the proxy to return the English label for ${ itemId }`
		} );
	} );

	it( 'returns federated results through the public endpoint', async function () {
		const value = getTestString( 'qlever-federation-' );
		const itemId = await WikibaseApi.createItem( value );
		// Retrieve Unicode data from the reference store. Raw non-ASCII query
		// literals expose a separate QLever/legacy-Blazegraph POST charset issue
		// documented in the ADR; this query contains only the entity's ASCII IRI.
		await browser.waitUntil( async () => {
			const result = await proxyQuery( `
				SELECT ?value WHERE {
					SERVICE <http://wdqs-blazegraph:9999/bigdata/namespace/wdq/sparql> {
						<${ testEnv.vars.WIKIBASE_URL }/entity/${ itemId }>
							<http://www.w3.org/2000/01/rdf-schema#label> ?value
					}
				}` );
			return result.status === 200 && result.data.results.bindings.some(
				( binding: { value: { value: string } } ) => binding.value.value === value
			);
		}, {
			interval: 1000,
			timeoutMsg: 'Expected the public endpoint to return the federated Unicode label'
		} );
	} );
} );
