import { getTestString } from 'wdio-mediawiki/Util.js';
import WikibaseApi from 'wdio-wikibase/wikibase.api.js';
import QueryServiceUIPage from '../../helpers/pages/queryservice-ui/queryservice-ui.page.js';
import { wikibasePropertyString } from '../../helpers/wikibase-property-types.js';

type SparqlBinding = {
	p: { value: string };
	o: { value: string };
};

const waitForEntityRdf = async (
	itemId: string,
	predicate: ( bindings: SparqlBinding[] ) => boolean,
	timeoutMsg: string
): Promise<void> => {
	await browser.waitUntil(
		async () => {
			const result = await browser.makeRequest(
				`${ testEnv.vars.WDQS_URL }/sparql`,
				{
					params: {
						query: `SELECT ?p ?o WHERE { <${ testEnv.vars.WIKIBASE_URL }/entity/${ itemId }> ?p ?o }`,
						format: 'json'
					}
				}
			);
			return predicate( result.data.results.bindings );
		},
		{ interval: 1000, timeoutMsg }
	);
};

const federatedQuery = ( endpoint: string, serviceBody = '?s ?p ?o .' ): string => `
	SELECT * WHERE {
		service <${ endpoint }> {
			${ serviceBody }
		}
	}

	LIMIT 1
`;

const federatedSparqlRequest = async (
	endpoint: string,
	serviceBody?: string
): Promise<string> => {
	const result = await browser.makeRequest(
		`${ testEnv.vars.WDQS_URL }/sparql`,
		{
			validateStatus: false,
			params: {
				query: federatedQuery( endpoint, serviceBody )
			}
		}
	);

	return String( result.data );
};

describe( 'QueryService', function () {
	it( 'Should be able to get sparql endpoint', async function () {
		const result = await browser.makeRequest(
			`${ testEnv.vars.WDQS_URL }/sparql`
		);
		expect( result.status ).toEqual( 200 );
	} );

	it( 'Should not be able to post to sparql endpoint', async function () {
		const result = await browser.makeRequest(
			`${ testEnv.vars.WDQS_URL }/sparql`,
			{ validateStatus: false },
			{}
		);
		expect( result.status ).toEqual( 405 );
	} );

	it( 'Should not be possible to reach blazegraph ldf api that is not enabled', async function () {
		const result = await browser.makeRequest(
			`${ testEnv.vars.WDQS_URL }/ldf`,
			{ validateStatus: false }
		);
		expect( result.status ).toEqual( 404 );
	} );

	it( 'Should not be possible to reach blazegraph ldf assets thats not enabled', async function () {
		const result = await browser.makeRequest(
			`${ testEnv.vars.WDQS_URL }/assets`,
			{ validateStatus: false }
		);
		expect( result.status ).toEqual( 404 );
	} );

	it( 'Should show up with property in queryservice ui after creation', async function () {
		const itemLabel = 'T267743-';
		const propertyValue = 'PropertyExampleStringValue';

		const propertyId = await WikibaseApi.createProperty( 'string' );
		const data = {
			claims: [
				{
					mainsnak: {
						snaktype: 'value',
						property: propertyId,
						datavalue: { value: propertyValue, type: 'string' }
					},
					type: 'statement',
					rank: 'normal'
				}
			]
		};

		const itemId = await WikibaseApi.createItem( getTestString( itemLabel ), data );

		// query the item using wd: prefix
		await QueryServiceUIPage.open( `SELECT * WHERE{ <http://wikibase.example/entity/${ itemId }> ?p ?o }` );

		await waitForEntityRdf(
			itemId,
			( bindings ) => bindings.some(
				( binding ) =>
					binding.p.value ===
						`${ testEnv.vars.WIKIBASE_URL }/prop/direct/${ propertyId }` &&
					binding.o.value === propertyValue
			),
			`Expected ${ itemId } to be added to WDQS`
		);

		await QueryServiceUIPage.submit();
		await QueryServiceUIPage.resultTable;

		await expect(
			QueryServiceUIPage.resultIncludes( 'schema:version' )
		).resolves.toEqual( true );
		await expect(
			QueryServiceUIPage.resultIncludes( 'schema:dateModified' )
		).resolves.toEqual( true );
		await expect(
			QueryServiceUIPage.resultIncludes( 'wikibase:timestamp' )
		).resolves.toEqual( true );

		// label should match on the prefix
		await expect(
			QueryServiceUIPage.resultIncludes( 'rdfs:label', itemLabel )
		).resolves.toEqual( true );

		// should have one statement
		await expect(
			QueryServiceUIPage.resultIncludes( 'wikibase:statements', '1' )
		).resolves.toEqual( true );

		await expect(
			QueryServiceUIPage.resultIncludes( 'wikibase:sitelinks', '0' )
		).resolves.toEqual( true );
		await expect(
			QueryServiceUIPage.resultIncludes( 'wikibase:identifiers', '0' )
		).resolves.toEqual( true );

		// property value is set with correct rdf
		await expect(
			QueryServiceUIPage.resultIncludes(
				`<${ testEnv.vars.WIKIBASE_URL }/prop/direct/${ propertyId }>`,
				propertyValue
			)
		).resolves.toEqual( true );

		// query the property using wdt: prefix
		await QueryServiceUIPage.open( `SELECT * WHERE{ ?s <http://wikibase.example/prop/direct/${ propertyId }> ?o }` );

		await QueryServiceUIPage.submit();
		await QueryServiceUIPage.resultTable;

		// should be set only to the item
		await expect(
			QueryServiceUIPage.resultIncludes(
				`<${ testEnv.vars.WIKIBASE_URL }/entity/${ itemId }>`,
				propertyValue
			)
		).resolves.toEqual( true );
	} );

	it( 'Should not show up in queryservice ui after deletion', async function () {
		const itemId = await WikibaseApi.createItem(
			getTestString( 'T267743-' )
		);

		// Check it shows up after creation
		await QueryServiceUIPage.open( `SELECT * WHERE{ <http://wikibase.example/entity/${ itemId }> ?p ?o }` );

		await waitForEntityRdf(
			itemId,
			( bindings ) => bindings.some(
				( binding ) => binding.p.value === 'http://schema.org/version'
			),
			`Expected ${ itemId } to be added to WDQS`
		);

		await QueryServiceUIPage.submit();
		await QueryServiceUIPage.resultTable;

		await expect(
			QueryServiceUIPage.resultIncludes( 'schema:version' )
		).resolves.toBe( true );

		const api = await WikibaseApi.getApi();
		await api.request( {
			action: 'delete',
			title: `Item:${ itemId }`,
			token: await api.getEditToken()
		} );
		await browser.waitUntil(
			async () => ( await WikibaseApi.getEntity( itemId ) ).missing === '',
			{ timeoutMsg: `Expected ${ itemId } to be deleted from Wikibase` }
		);

		await QueryServiceUIPage.open( `SELECT * WHERE{ <http://wikibase.example/entity/${ itemId }> ?p ?o }` );

		await waitForEntityRdf(
			itemId,
			( bindings ) => !bindings.some(
				( binding ) => binding.p.value === 'http://schema.org/version'
			),
			`Expected ${ itemId } to be removed from WDQS`
		);

		await QueryServiceUIPage.submit();

		const resultText = await QueryServiceUIPage.resultTable.getText();

		// item should not be included
		expect( resultText ).not.toMatch( 'schema:version' );
		expect( resultText ).not.toMatch( 'schema:dateModified' );
		expect( resultText ).not.toMatch( 'wikibase:sitelinks' );
		expect( resultText ).not.toMatch( 'wikibase:identifiers' );
		expect( resultText ).not.toMatch( 'rdfs:label' );

		// timestamp always shows
		expect( resultText ).toMatch( 'wikibase:timestamp' );
	} );

	it( 'Should show results for a select query', async function () {
		await QueryServiceUIPage.open( 'SELECT * where { ?a ?b ?c }' );
		await QueryServiceUIPage.submit();
		expect(
			( await QueryServiceUIPage.resultTable.$( 'tbody' ).$$( 'tr' ) ).length
		).toBeGreaterThan( 0 );
	} );

	it( 'Should show list of properties', async function () {
		await QueryServiceUIPage.open( `SELECT ?property ?propertyType ?propertyLabel ?propertyDescription ?propertyAltLabel WHERE {
			?property wikibase:propertyType ?propertyType .
			SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
		  }
		  ORDER BY ASC(xsd:integer(STRAFTER(STR(?property), 'P')))` );
		await QueryServiceUIPage.submit();
		await expect(
			QueryServiceUIPage.resultTable.$( 'th[data-field="property"]' )
		).toExist();
		await expect(
			QueryServiceUIPage.resultTable.$( 'th[data-field="propertyType"]' )
		).toExist();
		await expect(
			QueryServiceUIPage.resultTable.$( 'th[data-field="propertyLabel"]' )
		).toExist();
		await expect(
			QueryServiceUIPage.resultTable.$( 'th[data-field="propertyDescription"]' )
		).toExist();
		await expect(
			QueryServiceUIPage.resultTable.$( 'th[data-field="propertyAltLabel"]' )
		).toExist();
		expect(
			( await QueryServiceUIPage.resultTable.$( 'tbody' ).$$( 'tr' ) ).length
		).toBeGreaterThan( 0 );
	} );

	it( 'Should show a property connected to item', async function () {
		const propertyId = await WikibaseApi.createProperty(
			wikibasePropertyString.urlName
		);
		const data = {
			claims: [
				{
					mainsnak: {
						snaktype: 'value',
						property: propertyId,
						datavalue: {
							value: 'test-property',
							type: wikibasePropertyString.urlName
						}
					},
					type: 'statement',
					rank: 'normal'
				}
			]
		};

		const itemId = await WikibaseApi.createItem(
			getTestString( 'test-item-label' ),
			data
		);

		await QueryServiceUIPage.open( `SELECT (COUNT(*) AS ?count)
		WHERE {
		  <${ testEnv.vars.WIKIBASE_URL }/entity/${ itemId }> <${ testEnv.vars.WIKIBASE_URL }/prop/direct/${ propertyId }> "test-property" .
		}` );

		await waitForEntityRdf(
			itemId,
			( bindings ) => bindings.some(
				( binding ) =>
					binding.p.value ===
						`${ testEnv.vars.WIKIBASE_URL }/prop/direct/${ propertyId }` &&
					binding.o.value === 'test-property'
			),
			`Expected ${ itemId } to be added to WDQS`
		);

		await QueryServiceUIPage.submit();

		await expect(
			QueryServiceUIPage.resultTable.$( 'th[data-field="count"]' ).$( 'div' )
		).toHaveText( 'count' );
		await expect(
			QueryServiceUIPage.resultTable
				.$( 'tbody' )
				.$( 'tr[data-index="0"]' )
				.$( 'span' )
		).toHaveText( '1' );
	} );

	it( 'Should show results from a page in allowlist.txt', async function () {
		// We don't currently have a way for WBS Deploy to pass tests with breaking changes
		// Please see T361575 for more info
		if ( testEnv.settings.name === 'deploy' ) {
			this.skip();
		}

		const allowedEndpoint = 'https://query.wikidata.org/sparql';
		const result = await federatedSparqlRequest(
			allowedEndpoint,
			'BIND( <http://www.wikidata.org/entity/Q42> AS ?s )'
		);

		expect( result ).not.toMatch(
			`Service URI ${ allowedEndpoint } is not allowed`
		);
	} );

	it( 'Should show error from a page not in allowlist.txt', async function () {
		// Returns results if https://wikibase.world/query/sparql added to allowlist.txt
		const blockedEndpoint = 'https://wikibase.world/query/sparql';
		const result = await federatedSparqlRequest( blockedEndpoint );

		expect( result ).toMatch(
			`Service URI ${ blockedEndpoint } is not allowed`
		);
	} );
} );
