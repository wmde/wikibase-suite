import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { testEnv } from './wikibase-bootstrap.conf.js';

const bundlePath = fileURLToPath(
	new URL(
		'../../images/wikibase/runtime/var/www/html/extensions/WikibaseBootstrap/ontologies/wikibase-bootstrap.ttl',
		import.meta.url
	)
);
const source = readFileSync(bundlePath);
const sourceHash =
	'49e87c0e78d3bf5bf8dc28f3260e0ad407c5dbcf3075aac80b7fa2595c29643b';

type Plan = {
	properties: Array<{
		sourceIri: string;
		datatype: string;
		claims: Array<{ property: string; value: string }>;
	}>;
	errors: string[];
};

async function plan(contents: string): Promise<Plan> {
	const encoded = Buffer.from(contents).toString('base64');
	const php = String.raw`require "/var/www/html/extensions/WikibaseBootstrap/includes/BundlePlanner.php"; echo json_encode((new \MediaWiki\Extension\WikibaseBootstrap\BundlePlanner())->plan(base64_decode("${encoded}")), JSON_THROW_ON_ERROR);`;
	const output = await testEnv.runDockerComposeCmd(
		`exec -T wikibase php -r '${php}'`
	);
	return JSON.parse(output) as Plan;
}

describe('Bundled bootstrap source', function () {
	it('matches the pinned upstream file', function () {
		assert.equal(createHash('sha256').update(source).digest('hex'), sourceHash);
	});

	it('plans the upstream properties with source-key references', async function () {
		const result = await plan(source.toString());
		assert.deepEqual(result.errors, []);
		assert.deepEqual(
			result.properties.map((property) => property.sourceIri),
			Array.from(
				{ length: 8 },
				(_, index) => `https://wikiba.se/bootstrap#P${index + 1}`
			)
		);
		assert.deepEqual(
			result.properties.map((property) => property.datatype),
			[
				'wikibase-item',
				'wikibase-item',
				'wikibase-item',
				'wikibase-property',
				'url',
				'external-id',
				'string',
				'string'
			]
		);
		assert.deepEqual(result.properties[0].claims, [
			{
				property: 'https://wikiba.se/bootstrap#P5',
				value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
			},
			{ property: 'https://wikiba.se/bootstrap#P6', value: 'P31' }
		]);
		assert.deepEqual(result.properties[5].claims, [
			{
				property: 'https://wikiba.se/bootstrap#P7',
				value: 'http://www.wikidata.org/entity/$1'
			},
			{
				property: 'https://wikiba.se/bootstrap#P8',
				value: 'http://www.wikidata.org/entity/$1'
			}
		]);
	});

	it('accepts another property in the same source format', async function () {
		const added = source
			.toString()
			.replace(
				'wb: a owl:Ontology ;',
				'wb:P9 a owl:DatatypeProperty ;\n' +
					'    rdfs:label "example"@en ;\n' +
					'    dcterms:description "An additional property"@en ;\n' +
					'    skos:note "Wikibase ID: P9"@en,\n' +
					'        "Wikibase datatype: string"@en ;\n' +
					'    wb:P6 "P999" .\n\n' +
					'wb: a owl:Ontology ;'
			);
		const result = await plan(added);
		assert.deepEqual(result.errors, []);
		assert.equal(result.properties.length, 9);
		assert.deepEqual(result.properties[8].claims, [
			{ property: 'https://wikiba.se/bootstrap#P6', value: 'P999' }
		]);
	});
});
