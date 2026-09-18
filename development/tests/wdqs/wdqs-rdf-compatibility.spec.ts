import { getTestString } from 'wdio-mediawiki/Util.js';
import WikibaseApi from 'wdio-wikibase/wikibase.api.js';

type Binding = { value: string; type: string; datatype?: string; 'xml:lang'?: string };

const query = async ( sparql: string ): Promise<Record<string, Binding>[]> => {
	const response = await browser.makeRequest( `${ testEnv.vars.WDQS_URL }/sparql`, {
		params: { query: sparql, format: 'json' }
	} );
	expect( response.status ).toEqual( 200 );
	return response.data.results.bindings;
};

const waitForQuery = async (
	sparql: string,
	predicate: ( bindings: Record<string, Binding>[] ) => boolean,
	timeoutMsg: string
): Promise<void> => {
	await browser.waitUntil( async () => predicate( await query( sparql ) ), {
		interval: 1000,
		timeoutMsg
	} );
};

const mergeItems = async ( fromId: string, toId: string ): Promise<void> => {
	const api = await WikibaseApi.getApi();
	await api.request( {
		action: 'wbmergeitems',
		fromid: fromId,
		toid: toId,
		ignoreconflicts: 'description',
		token: await api.getEditToken()
	} );
};

describe( 'Wikidata Query Service RDF compatibility', function () {
	it( 'exposes statement qualifiers and references', async function () {
		const statementProperty = await WikibaseApi.createProperty( 'string' );
		const qualifierProperty = await WikibaseApi.createProperty( 'string' );
		const referenceProperty = await WikibaseApi.createProperty( 'string' );
		const qualifier = getTestString( 'query-contract-qualifier-' );
		const reference = getTestString( 'query-contract-reference-' );
		const item = await WikibaseApi.createItem( getTestString( 'query-contract-statement-' ), {
			claims: [ {
				mainsnak: {
					snaktype: 'value', property: statementProperty,
					datavalue: { value: 'statement value', type: 'string' }
				},
				qualifiers: {
					[ qualifierProperty ]: [ {
						snaktype: 'value', property: qualifierProperty,
						datavalue: { value: qualifier, type: 'string' }
					} ]
				},
				'qualifiers-order': [ qualifierProperty ],
				references: [ {
					snaks: {
						[ referenceProperty ]: [ {
							snaktype: 'value', property: referenceProperty,
							datavalue: { value: reference, type: 'string' }
						} ]
					},
					'snaks-order': [ referenceProperty ]
				} ],
				type: 'statement', rank: 'normal'
			} ]
		} );
		const base = testEnv.vars.WIKIBASE_URL;

		await waitForQuery(
			`SELECT ?qualifier ?reference WHERE {
				<${ base }/entity/${ item }> <${ base }/prop/${ statementProperty }> ?statement .
				?statement <${ base }/prop/qualifier/${ qualifierProperty }> ?qualifier ;
					<http://www.w3.org/ns/prov#wasDerivedFrom> ?referenceNode .
				?referenceNode <${ base }/prop/reference/${ referenceProperty }> ?reference
			}`,
			( bindings ) => bindings.length === 1 &&
				bindings[ 0 ].qualifier.value === qualifier && bindings[ 0 ].reference.value === reference,
			'Expected qualifier and reference RDF to be queryable'
		);
	} );

	it( 'represents statement ranks and unknown-value snaks', async function () {
		const property = await WikibaseApi.createProperty( 'string' );
		const item = await WikibaseApi.createItem( getTestString( 'query-contract-ranks-' ), {
			claims: [
				{
					mainsnak: {
						snaktype: 'value', property,
						datavalue: { value: 'normal value', type: 'string' }
					},
					type: 'statement', rank: 'normal'
				},
				{ mainsnak: { snaktype: 'somevalue', property }, type: 'statement', rank: 'preferred' },
				{ mainsnak: { snaktype: 'novalue', property }, type: 'statement', rank: 'deprecated' }
			]
		} );
		const base = testEnv.vars.WIKIBASE_URL;

		await waitForQuery(
			`SELECT ?rank (STR(COUNT(?statement)) AS ?count) WHERE {
				<${ base }/entity/${ item }> <${ base }/prop/${ property }> ?statement .
				?statement <http://wikiba.se/ontology#rank> ?rank
			} GROUP BY ?rank`,
			( bindings ) => bindings.length === 3 && bindings.every( ( binding ) => binding.count.value === '1' ),
			'Expected normal, preferred, and deprecated statement ranks to be queryable'
		);
		await waitForQuery(
			`SELECT ?value WHERE {
				<${ base }/entity/${ item }> <${ base }/prop/direct/${ property }> ?value
				FILTER( isBlank( ?value ) )
			}`,
			( bindings ) => bindings.length === 1,
			'Expected a somevalue snak to be queryable as an unknown RDF value'
		);
		await waitForQuery(
			`SELECT ?type WHERE {
				<${ base }/prop/novalue/${ property }>
					<http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ?type
			}`,
			( bindings ) => bindings.some(
				( binding ) => binding.type.value === 'http://www.w3.org/2002/07/owl#Class'
			),
			'Expected the novalue property vocabulary to be queryable'
		);
	} );

	it( 'represents common Wikibase datavalues', async function () {
		const linkedItem = await WikibaseApi.createItem( getTestString( 'query-contract-linked-' ) );
		const itemProperty = await WikibaseApi.createProperty( 'wikibase-item' );
		const quantityProperty = await WikibaseApi.createProperty( 'quantity' );
		const timeProperty = await WikibaseApi.createProperty( 'time' );
		const coordinateProperty = await WikibaseApi.createProperty( 'globe-coordinate' );
		const textProperty = await WikibaseApi.createProperty( 'monolingualtext' );
		const urlProperty = await WikibaseApi.createProperty( 'url' );
		const externalIdProperty = await WikibaseApi.createProperty( 'external-id' );
		const externalId = getTestString( 'query-contract-id-' );
		const item = await WikibaseApi.createItem( getTestString( 'query-contract-datavalues-' ), {
			claims: [
				{
					mainsnak: {
						snaktype: 'value', property: itemProperty,
						datavalue: {
							value: { 'entity-type': 'item', 'numeric-id': Number( linkedItem.slice( 1 ) ) },
							type: 'wikibase-entityid'
						}
					}, type: 'statement', rank: 'normal'
				},
				{
					mainsnak: {
						snaktype: 'value', property: quantityProperty,
						datavalue: { value: { amount: '+42', unit: '1' }, type: 'quantity' }
					}, type: 'statement', rank: 'normal'
				},
				{
					mainsnak: {
						snaktype: 'value', property: timeProperty,
						datavalue: {
							value: {
								time: '+2020-01-02T00:00:00Z', timezone: 0, before: 0, after: 0,
								precision: 11, calendarmodel: 'http://www.wikidata.org/entity/Q1985727'
							}, type: 'time'
						}
					}, type: 'statement', rank: 'normal'
				},
				{
					mainsnak: {
						snaktype: 'value', property: coordinateProperty,
						datavalue: {
							value: {
								latitude: 12.34, longitude: 56.78, altitude: null,
								globe: 'http://www.wikidata.org/entity/Q2', precision: 0.0001
							}, type: 'globecoordinate'
						}
					}, type: 'statement', rank: 'normal'
				},
				{
					mainsnak: {
						snaktype: 'value', property: textProperty,
						datavalue: { value: { text: 'Wikibase RDF contract', language: 'en' }, type: 'monolingualtext' }
					}, type: 'statement', rank: 'normal'
				},
				{
					mainsnak: {
						snaktype: 'value', property: urlProperty,
						datavalue: { value: 'https://example.test/rdf-contract', type: 'string' }
					}, type: 'statement', rank: 'normal'
				},
				{
					mainsnak: {
						snaktype: 'value', property: externalIdProperty,
						datavalue: { value: externalId, type: 'string' }
					}, type: 'statement', rank: 'normal'
				}
			]
		} );
		const base = testEnv.vars.WIKIBASE_URL;

		await waitForQuery(
			`SELECT ?property ?value WHERE {
				VALUES ?property {
					<${ base }/prop/direct/${ itemProperty }>
					<${ base }/prop/direct/${ quantityProperty }>
					<${ base }/prop/direct/${ timeProperty }>
					<${ base }/prop/direct/${ coordinateProperty }>
					<${ base }/prop/direct/${ textProperty }>
					<${ base }/prop/direct/${ urlProperty }>
					<${ base }/prop/direct/${ externalIdProperty }>
				}
				<${ base }/entity/${ item }> ?property ?value
			}`,
			( bindings ) => bindings.length === 7 &&
				bindings.some( ( binding ) => binding.property.value.endsWith( `/prop/direct/${ itemProperty }` ) && binding.value.value.endsWith( `/entity/${ linkedItem }` ) ) &&
				bindings.some( ( binding ) => binding.property.value.endsWith( `/prop/direct/${ quantityProperty }` ) && Number( binding.value.value ) === 42 ) &&
				bindings.some( ( binding ) => binding.property.value.endsWith( `/prop/direct/${ timeProperty }` ) && binding.value.datatype === 'http://www.w3.org/2001/XMLSchema#dateTime' ) &&
				bindings.some( ( binding ) => binding.property.value.endsWith( `/prop/direct/${ coordinateProperty }` ) && binding.value.datatype === 'http://www.opengis.net/ont/geosparql#wktLiteral' ) &&
				bindings.some( ( binding ) => binding.property.value.endsWith( `/prop/direct/${ textProperty }` ) && binding.value.value === 'Wikibase RDF contract' && binding.value[ 'xml:lang' ] === 'en' ) &&
				bindings.some( ( binding ) => binding.property.value.endsWith( `/prop/direct/${ urlProperty }` ) && binding.value.value === 'https://example.test/rdf-contract' ) &&
				bindings.some( ( binding ) => binding.property.value.endsWith( `/prop/direct/${ externalIdProperty }` ) && binding.value.value === externalId ),
			'Expected core Wikibase datavalues to be queryable with their RDF value kinds'
		);
	} );

	it( 'exposes labels, aliases, and descriptions without redundant label predicates', async function () {
		const label = getTestString( 'query-contract-label-' );
		const alias = getTestString( 'query-contract-alias-' );
		const description = getTestString( 'query-contract-description-' );
		const item = await WikibaseApi.createItem( label, {
			aliases: { en: [ { language: 'en', value: alias } ] },
			descriptions: { en: { language: 'en', value: description } }
		} );
		const base = testEnv.vars.WIKIBASE_URL;

		await waitForQuery(
			`SELECT ?predicate ?value WHERE {
				VALUES ?predicate {
					<http://www.w3.org/2000/01/rdf-schema#label>
					<http://schema.org/description>
					<http://www.w3.org/2004/02/skos/core#altLabel>
				}
				<${ base }/entity/${ item }> ?predicate ?value
			}`,
			( bindings ) => bindings.length === 3 &&
				bindings.some( ( binding ) => binding.value.value === label ) &&
				bindings.some( ( binding ) => binding.value.value === alias ) &&
				bindings.some( ( binding ) => binding.value.value === description ),
			'Expected labels, aliases, and descriptions to be queryable'
		);
		await waitForQuery(
			`SELECT ?predicate WHERE {
				VALUES ?predicate {
					<http://schema.org/name>
					<http://www.w3.org/2004/02/skos/core#prefLabel>
				}
				<${ base }/entity/${ item }> ?predicate ?value
			}`,
			( bindings ) => bindings.length === 0,
			'Expected the query-service RDF representation to omit redundant label predicates'
		);
	} );

	it( 'represents item merges as redirects with transferred statements', async function () {
		const property = await WikibaseApi.createProperty( 'string' );
		const value = getTestString( 'query-contract-merged-value-' );
		const source = await WikibaseApi.createItem( getTestString( 'query-contract-merge-source-' ), {
			claims: [ {
				mainsnak: {
					snaktype: 'value', property,
					datavalue: { value, type: 'string' }
				}, type: 'statement', rank: 'normal'
			} ]
		} );
		const target = await WikibaseApi.createItem( getTestString( 'query-contract-merge-target-' ) );
		const base = testEnv.vars.WIKIBASE_URL;

		await mergeItems( source, target );
		await waitForQuery(
			`SELECT ?subject ?predicate ?value WHERE {
				VALUES ?subject { <${ base }/entity/${ source }> <${ base }/entity/${ target }> }
				VALUES ?predicate {
					<http://www.w3.org/2002/07/owl#sameAs>
					<${ base }/prop/direct/${ property }>
				}
				?subject ?predicate ?value
			}`,
			( bindings ) =>
				bindings.some( ( binding ) =>
					binding.subject.value.endsWith( `/entity/${ source }` ) &&
					binding.predicate.value === 'http://www.w3.org/2002/07/owl#sameAs' &&
					binding.value.value.endsWith( `/entity/${ target }` )
				) &&
				bindings.some( ( binding ) =>
					binding.subject.value.endsWith( `/entity/${ target }` ) &&
					binding.predicate.value.endsWith( `/prop/direct/${ property }` ) &&
					binding.value.value === value
				),
			'Expected item merges to expose redirect RDF and transferred statements'
		);
	} );
} );
