import { getTestString } from 'wdio-mediawiki/Util.js';
import WikibaseApi from 'wdio-wikibase/wikibase.api.js';

type Binding = { value: string; datatype?: string };

const qleverQuery = async (
	query: string
): Promise<Record<string, Binding>[]> => {
	const result = await browser.makeRequest('http://qlever:7001/', {
		params: { query, format: 'application/sparql-results+json' }
	});
	expect(result.status).toEqual(200);
	return result.data.results.bindings;
};

const wdqsQuery = async (query: string): Promise<Record<string, Binding>[]> => {
	const result = await browser.makeRequest(
		'http://wdqs-blazegraph:9999/bigdata/namespace/wdq/sparql',
		{
			params: { query },
			headers: { Accept: 'application/sparql-results+json' }
		}
	);
	expect(result.status).toEqual(200);
	return result.data.results.bindings;
};

const canonicalJson = (value: unknown): string => {
	if (Array.isArray(value)) {
		return `[${value.map(canonicalJson).join(',')}]`;
	}
	if (value && typeof value === 'object') {
		const object = value as Record<string, unknown>;
		return `{${Object.keys(object)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
			.join(',')}}`;
	}
	return JSON.stringify(value);
};

const canonicalBindings = (bindings: Record<string, Binding>[]): string[] =>
	bindings.map(canonicalJson).sort();

const waitForParity = async (
	query: string,
	predicate: (bindings: Record<string, Binding>[]) => boolean,
	timeoutMsg: string
): Promise<void> => {
	let qlever: Record<string, Binding>[] = [];
	let wdqs: Record<string, Binding>[] = [];
	try {
		await browser.waitUntil(
			async () => {
				[qlever, wdqs] = await Promise.all([
					qleverQuery(query),
					wdqsQuery(query)
				]);
				return (
					canonicalBindings(qlever).join('\n') ===
						canonicalBindings(wdqs).join('\n') && predicate(qlever)
				);
			},
			{ interval: 1000, timeoutMsg }
		);
	} catch (error) {
		throw new Error(
			`${timeoutMsg}\nQLever bindings: ${JSON.stringify(canonicalBindings(qlever))}\n` +
				`WDQS bindings: ${JSON.stringify(canonicalBindings(wdqs))}`,
			{ cause: error }
		);
	}
};

const mergeItems = async (fromId: string, toId: string): Promise<void> => {
	const api = await WikibaseApi.getApi();
	await api.request({
		action: 'wbmergeitems',
		fromid: fromId,
		toid: toId,
		ignoreconflicts: 'description',
		token: await api.getEditToken()
	});
};

describe('QLever WDQS RDF compatibility', function () {
	it('matches WDQS graph shaping for shared references', async function () {
		const mainProperty = await WikibaseApi.createProperty('quantity');
		const referenceProperty = await WikibaseApi.createProperty('string');
		const referenceValue = getTestString('qlever-shared-reference-');
		const claim = () => ({
			mainsnak: {
				snaktype: 'value',
				property: mainProperty,
				datavalue: { value: { amount: '+42', unit: '1' }, type: 'quantity' }
			},
			references: [
				{
					snaks: {
						[referenceProperty]: [
							{
								snaktype: 'value',
								property: referenceProperty,
								datavalue: { value: referenceValue, type: 'string' }
							}
						]
					},
					'snaks-order': [referenceProperty]
				}
			],
			type: 'statement',
			rank: 'normal'
		});
		const first = await WikibaseApi.createItem(
			getTestString('qlever-shared-first-'),
			{ claims: [claim()] }
		);
		const second = await WikibaseApi.createItem(
			getTestString('qlever-shared-second-'),
			{ claims: [claim()] }
		);
		const base = testEnv.vars.WIKIBASE_URL;
		await waitForParity(
			`SELECT ?item ?reference ?quantity WHERE {
				VALUES ?item { <${base}/entity/${first}> <${base}/entity/${second}> }
				?item <${base}/prop/${mainProperty}> ?statement .
				?statement <http://www.w3.org/ns/prov#wasDerivedFrom> ?reference ; <${base}/prop/statement/value/${mainProperty}> ?quantity .
			} ORDER BY ?item`,
			(bindings) =>
				bindings.length === 2 &&
				bindings.every(
					(binding) =>
						binding.reference.value.includes('/reference/') &&
						binding.quantity.value.includes('/value/')
				),
			'Expected QLever and WDQS to agree on shared-reference RDF'
		);
		await waitForParity(
			`SELECT ?value WHERE { <${base}/entity/${first}> <http://schema.org/name> ?value }`,
			(bindings) => bindings.length === 0,
			'Expected both services to omit redundant schema:name triples'
		);
	});

	it('matches WDQS Lexeme RDF', async function () {
		const api = await WikibaseApi.getApi();
		const language = await WikibaseApi.createItem(
			getTestString('qlever-lexeme-language-')
		);
		const category = await WikibaseApi.createItem(
			getTestString('qlever-lexeme-category-')
		);
		const lemma = getTestString('qlever-lexeme-');
		const created = await api.request({
			action: 'wbeditentity',
			new: 'lexeme',
			data: JSON.stringify({
				lemmas: { en: { language: 'en', value: lemma } },
				language,
				lexicalCategory: category
			}),
			token: await api.getEditToken()
		});
		const lexeme = created.entity.id;
		const base = testEnv.vars.WIKIBASE_URL;
		// Establish that both updaters have reached this Lexeme before checking
		// absent predicates: two empty results alone would not establish parity.
		await waitForParity(
			`SELECT ?lemma WHERE {
				<${base}/entity/${lexeme}> <http://wikiba.se/ontology#lemma> ?lemma
			}`,
			(bindings) => bindings.length === 1 && bindings[0].lemma.value === lemma,
			'Expected both services to index the Lexeme lemma'
		);
		await waitForParity(
			`SELECT ?predicate ?value WHERE {
				VALUES ?predicate { <http://www.w3.org/2000/01/rdf-schema#label> <http://schema.org/name> <http://www.w3.org/2004/02/skos/core#prefLabel> }
				<${base}/entity/${lexeme}> ?predicate ?value
			} ORDER BY ?predicate ?value`,
			(bindings) =>
				bindings.every(
					(binding) =>
						binding.predicate.value !== 'http://schema.org/name' &&
						binding.predicate.value !==
							'http://www.w3.org/2004/02/skos/core#prefLabel'
				),
			'Expected QLever and WDQS to agree on Lexeme RDF shaping'
		);
	});

	it('matches WDQS redirect RDF after an item merge', async function () {
		const property = await WikibaseApi.createProperty('string');
		const value = getTestString('qlever-merged-value-');
		const source = await WikibaseApi.createItem(
			getTestString('qlever-merge-source-'),
			{
				claims: [
					{
						mainsnak: {
							snaktype: 'value',
							property,
							datavalue: { value, type: 'string' }
						},
						type: 'statement',
						rank: 'normal'
					}
				]
			}
		);
		const target = await WikibaseApi.createItem(
			getTestString('qlever-merge-target-')
		);
		const base = testEnv.vars.WIKIBASE_URL;
		await mergeItems(source, target);
		await waitForParity(
			`SELECT ?subject ?predicate ?value WHERE {
				VALUES ?subject { <${base}/entity/${source}> <${base}/entity/${target}> }
				VALUES ?predicate { <http://www.w3.org/2002/07/owl#sameAs> <${base}/prop/direct/${property}> }
				?subject ?predicate ?value
			} ORDER BY ?subject ?predicate ?value`,
			(bindings) =>
				bindings.some(
					(binding) =>
						binding.subject.value.endsWith(`/entity/${source}`) &&
						binding.predicate.value ===
							'http://www.w3.org/2002/07/owl#sameAs' &&
						binding.value.value.endsWith(`/entity/${target}`)
				) &&
				bindings.some(
					(binding) =>
						binding.subject.value.endsWith(`/entity/${target}`) &&
						binding.predicate.value.endsWith(`/prop/direct/${property}`) &&
						binding.value.value === value
				),
			'Expected QLever and WDQS to agree on redirect RDF and transferred statements'
		);
	});
});
