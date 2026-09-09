import { getTestString } from 'wdio-mediawiki/Util.js';
import WikibaseApi from 'wdio-wikibase/wikibase.api.js';

type Binding = { value: string; datatype?: string };

const qleverQuery = async ( query: string ): Promise<Record<string, Binding>[]> => {
	const result = await browser.makeRequest( 'http://query:7001/', {
		params: { query, format: 'application/sparql-results+json' }
	} );
	expect( result.status ).toEqual( 200 );
	return result.data.results.bindings;
};

const waitForBindings = async (
	query: string,
	predicate: ( bindings: Record<string, Binding>[] ) => boolean,
	timeoutMsg: string
): Promise<void> => {
	await browser.waitUntil(
		async () => predicate( await qleverQuery( query ) ),
		{ interval: 1000, timeoutMsg }
	);
};

const editEntity = async ( id: string, data: object ): Promise<void> => {
	const api = await WikibaseApi.getApi();
	await api.request( {
		action: 'wbeditentity',
		id,
		data: JSON.stringify( data ),
		token: await api.getEditToken()
	} );
};

const deleteEntity = async ( id: string ): Promise<void> => {
	const api = await WikibaseApi.getApi();
	await api.request( {
		action: 'delete',
		title: `Item:${ id }`,
		token: await api.getEditToken()
	} );
};

describe( 'QLever incremental updater', function () {
	it( 'indexes a newly-created statement with its entity RDF snapshot', async function () {
		const propertyId = await WikibaseApi.createProperty( 'string' );
		const value = getTestString( 'qlever-incremental-value-' );
		const itemId = await WikibaseApi.createItem( getTestString( 'qlever-item-' ), {
			claims: [ {
				mainsnak: {
					snaktype: 'value',
					property: propertyId,
					datavalue: { value, type: 'string' }
				},
				type: 'statement',
				rank: 'normal'
			} ]
		} );

		await waitForBindings(
			`
				SELECT ?value WHERE {
					<${ testEnv.vars.WIKIBASE_URL }/entity/${ itemId }>
						<${ testEnv.vars.WIKIBASE_URL }/prop/direct/${ propertyId }> ?value
				}`,
			( bindings ) => bindings.some( ( binding ) => binding.value.value === value ),
			`Expected QLever to index the ${ itemId } statement`
		);
	} );

	it( 'indexes a quantity statement as a typed RDF literal', async function () {
		const propertyId = await WikibaseApi.createProperty( 'quantity' );
		const itemId = await WikibaseApi.createItem( getTestString( 'qlever-quantity-item-' ), {
			claims: [ {
				mainsnak: {
					snaktype: 'value', property: propertyId,
					datavalue: {
						value: { amount: '+42', unit: '1' }, type: 'quantity'
					}
				},
				type: 'statement', rank: 'normal'
			} ]
		} );

		await waitForBindings(
			`SELECT ?value WHERE {
				<${ testEnv.vars.WIKIBASE_URL }/entity/${ itemId }>
					<${ testEnv.vars.WIKIBASE_URL }/prop/direct/${ propertyId }> ?value
			}`,
			( bindings ) => bindings.some( ( binding ) =>
				binding.value.value === '42.0' &&
				binding.value.datatype === 'http://www.w3.org/2001/XMLSchema#decimal'
			),
			`Expected QLever to index the ${ itemId } quantity as an xsd:decimal literal`
		);
	} );

	it( 'indexes statement qualifiers and references in the same entity graph', async function () {
		const mainProperty = await WikibaseApi.createProperty( 'string' );
		const qualifierProperty = await WikibaseApi.createProperty( 'string' );
		const referenceProperty = await WikibaseApi.createProperty( 'string' );
		const qualifierValue = getTestString( 'qlever-qualifier-' );
		const referenceValue = getTestString( 'qlever-reference-' );
		const itemId = await WikibaseApi.createItem( getTestString( 'qlever-qualified-item-' ), {
			claims: [ {
				mainsnak: {
					snaktype: 'value', property: mainProperty,
					datavalue: { value: getTestString( 'qlever-main-' ), type: 'string' }
				},
				qualifiers: {
					[ qualifierProperty ]: [ {
						snaktype: 'value', property: qualifierProperty,
						datavalue: { value: qualifierValue, type: 'string' }
					} ]
				},
				references: [ {
					snaks: {
						[ referenceProperty ]: [ {
							snaktype: 'value', property: referenceProperty,
							datavalue: { value: referenceValue, type: 'string' }
						} ]
					},
					'snaks-order': [ referenceProperty ]
				} ],
				type: 'statement', rank: 'normal'
			} ]
		} );

		await waitForBindings(
			`SELECT ?qualifier ?reference WHERE {
				<${ testEnv.vars.WIKIBASE_URL }/entity/${ itemId }> ?p ?statement .
				?statement <${ testEnv.vars.WIKIBASE_URL }/prop/qualifier/${ qualifierProperty }> ?qualifier ;
					<http://www.w3.org/ns/prov#wasDerivedFrom> ?referenceNode .
				?referenceNode <${ testEnv.vars.WIKIBASE_URL }/prop/reference/${ referenceProperty }> ?reference .
			}`,
			( bindings ) => bindings.some( ( binding ) =>
				binding.qualifier.value === qualifierValue && binding.reference.value === referenceValue
			),
			`Expected QLever to index qualifiers and references for ${ itemId }`
		);
	} );

	it( 'replaces an entity graph after an edit without retaining stale RDF', async function () {
		const firstLabel = getTestString( 'qlever-old-label-' );
		const secondLabel = getTestString( 'qlever-new-label-' );
		const itemId = await WikibaseApi.createItem( firstLabel );
		await editEntity( itemId, { labels: { en: { language: 'en', value: secondLabel } } } );

		await waitForBindings(
			`SELECT ?label WHERE {
				<${ testEnv.vars.WIKIBASE_URL }/entity/${ itemId }>
					<http://www.w3.org/2000/01/rdf-schema#label> ?label
			}`,
			( bindings ) => bindings.length === 1 && bindings[0].label.value === secondLabel,
			`Expected QLever to replace ${ itemId } with its edited RDF graph`
		);
	} );

	it( 'replays an edit made while the updater is interrupted', async function () {
		const label = getTestString( 'qlever-replayed-edit-' );
		let updaterStopped = false;

		try {
			await testEnv.runDockerComposeCmd( 'stop query-updater' );
			updaterStopped = true;
			const itemId = await WikibaseApi.createItem( label );
			const query = `SELECT ?item WHERE {
				?item <http://www.w3.org/2000/01/rdf-schema#label> ${ JSON.stringify( label ) }@en
			}`;

			expect( await qleverQuery( query ) ).toHaveLength( 0 );
			await testEnv.runDockerComposeCmd(
				'up -d --no-deps --force-recreate query-updater'
			);
			updaterStopped = false;

			await waitForBindings(
				query,
				( bindings ) => bindings.some( ( binding ) => binding.item.value.endsWith( `/entity/${ itemId }` ) ),
				`Expected QLever to replay the change to ${ itemId } after the updater restarted`
			);
		} finally {
			if ( updaterStopped ) {
				await testEnv.runDockerComposeCmd( 'up -d --no-deps --force-recreate query-updater' );
			}
		}
	} );

	it( 'updates property RDF and removes an entity graph on deletion', async function () {
		const firstLabel = getTestString( 'qlever-property-old-' );
		const secondLabel = getTestString( 'qlever-property-new-' );
		const propertyId = await WikibaseApi.createProperty( 'string', {
			labels: { en: { language: 'en', value: firstLabel } }
		} );
		await editEntity( propertyId, { labels: { en: { language: 'en', value: secondLabel } } } );
		await waitForBindings(
			`SELECT ?label WHERE {
				<${ testEnv.vars.WIKIBASE_URL }/entity/${ propertyId }>
					<http://www.w3.org/2000/01/rdf-schema#label> ?label
			}`,
			( bindings ) => bindings.length === 1 && bindings[0].label.value === secondLabel,
			`Expected QLever to replace ${ propertyId } property RDF`
		);

		const itemId = await WikibaseApi.createItem( getTestString( 'qlever-deleted-item-' ) );
		await waitForBindings(
			`SELECT ?p WHERE { <${ testEnv.vars.WIKIBASE_URL }/entity/${ itemId }> ?p ?o }`,
			( bindings ) => bindings.length > 0,
			`Expected QLever to index ${ itemId } before deletion`
		);
		await deleteEntity( itemId );
		await waitForBindings(
			`SELECT ?p WHERE { <${ testEnv.vars.WIKIBASE_URL }/entity/${ itemId }> ?p ?o }`,
			( bindings ) => bindings.length === 0,
			`Expected QLever to remove deleted ${ itemId } RDF`
		);
	} );

	it( 'drains a Recent Changes backlog across pagination boundaries', async function () {
		const label = getTestString( 'qlever-pagination-' );
		const itemCount = 55;
		for ( let index = 0; index < itemCount; index++ ) {
			await WikibaseApi.createItem( label );
		}

		await waitForBindings(
			`SELECT (COUNT(?item) AS ?count) WHERE {
				?item <http://www.w3.org/2000/01/rdf-schema#label> ${ JSON.stringify( label ) }@en
			}`,
			( bindings ) => bindings[0]?.count.value === String( itemCount ),
			`Expected QLever to drain all ${ itemCount } Recent Changes events`
		);
	} );
} );
