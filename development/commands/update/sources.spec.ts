import { afterEach, describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SourceUpdateInteraction } from './source-types.js';
import {
	confirmPinPlan,
	describePinChanges,
	planPins,
	readVariable,
	replaceVariable
} from './source-utils.js';
import { discoverWdqsCandidates, wdqsSourceProvider } from './sources/wdqs.js';
import {
	discoverMediaWikiCandidates,
	wikibasePins,
	wikimediaExtensions
} from './sources/wikibase.js';

const WIKIBASE_IMAGE = resolve('images/wikibase');
const originalFetch = globalThis.fetch;

function sorted(values: Iterable<string>): string[] {
	return [...values].sort();
}

describe('Wikibase source update provider', () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('covers every automatically updated source in build.env', () => {
		const buildEnvironment = readFileSync(
			resolve(WIKIBASE_IMAGE, 'build.env'),
			'utf8'
		);
		const managedSection = buildEnvironment.split(
			'Versions below are automatically updated by wbs-dev update'
		)[1];
		assert.ok(managedSection, 'build.env must identify its managed sources');

		const managedVariables = [
			...managedSection.matchAll(/^([A-Z0-9_]+_(?:COMMIT|ARCHIVE_SHA))=/gmu)
		].map((match) => match[1]);
		const providerVariables = wikibasePins(buildEnvironment).flatMap((pin) =>
			pin.archiveShaVariable
				? [pin.variable, pin.archiveShaVariable]
				: [pin.variable]
		);

		assert.deepEqual(sorted(providerVariables), sorted(managedVariables));
		assert.equal(
			new Set(providerVariables).size,
			providerVariables.length,
			'each managed variable must belong to the provider exactly once'
		);
	});

	it('discovers maintenance and newer stable MediaWiki releases', async () => {
		const pages = new Map([
			[
				'https://releases.wikimedia.org/mediawiki/',
				'<a href="1.47/">1.47</a><a href="1.46/">1.46</a>'
			],
			[
				'https://releases.wikimedia.org/mediawiki/1.47/',
				'mediawiki-1.47.0.tar.gz mediawiki-1.47.0.tar.gz'
			],
			[
				'https://releases.wikimedia.org/mediawiki/1.46/',
				'mediawiki-1.46.2.tar.gz mediawiki-1.46.1.tar.gz'
			]
		]);
		globalThis.fetch = async (input) => {
			const url = String(input);
			const page = pages.get(url);
			assert.notEqual(page, undefined, `unexpected request ${url}`);
			return new Response(page, { status: 200 });
		};

		assert.deepEqual(await discoverMediaWikiCandidates('1.46.0'), {
			maintenance: '1.46.2',
			newerLine: '1.47.0'
		});
	});

	it('keeps the Wikimedia extension policy aligned with the Dockerfile', () => {
		const dockerfile = readFileSync(
			resolve(WIKIBASE_IMAGE, 'Dockerfile'),
			'utf8'
		);
		const match = /^ARG WMF_EXTENSIONS="([^"]+)"$/mu.exec(dockerfile);
		assert.ok(match, 'Dockerfile must declare WMF_EXTENSIONS');

		assert.deepEqual(
			match[1].split(','),
			wikimediaExtensions.map(([, extension]) => extension)
		);
		for (const [variable] of wikimediaExtensions) {
			assert.match(dockerfile, new RegExp(`^ARG ${variable}$`, 'mu'));
		}
	});
});

describe('other source update providers', () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('discovers newer Query Service releases in version order', async () => {
		globalThis.fetch = async () =>
			new Response(
				JSON.stringify([
					{ name: 'query-service-parent-0.3.166' },
					{ name: 'unrelated-tag' },
					{ name: 'query-service-parent-0.3.165' },
					{ name: 'query-service-parent-0.3.164' }
				]),
				{ status: 200 }
			);

		assert.deepEqual(await discoverWdqsCandidates('0.3.164'), [
			'0.3.166',
			'0.3.165'
		]);
	});

	it('shows a Query Service comparison before confirmation', async () => {
		globalThis.fetch = async (input, init) => {
			const url = String(input);
			if (url.startsWith('https://api.github.com/')) {
				return new Response(
					JSON.stringify([
						{ name: 'query-service-parent-0.3.165' },
						{ name: 'query-service-parent-0.3.164' }
					]),
					{ status: 200 }
				);
			}
			if (init?.method === 'HEAD') {
				return new Response(null, { status: 200 });
			}
			if (url.endsWith('.md5')) {
				return new Response('0123456789abcdef0123456789abcdef', {
					status: 200
				});
			}
			throw new Error(`unexpected request ${url}`);
		};
		const notes: string[] = [];
		const interaction: SourceUpdateInteraction = {
			confirm: async () => false,
			select: async () => {
				throw new Error('selection was not expected');
			},
			note: (_title, lines) => notes.push(...lines),
			info: () => undefined
		};

		const result = await wdqsSourceProvider.plan(
			'WDQS_VERSION=0.3.164\n',
			interaction
		);

		assert.deepEqual(result, {
			contents: 'WDQS_VERSION=0.3.164\n',
			changes: []
		});
		assert.ok(
			notes.some((line) =>
				line.includes(
					'compare/query-service-parent-0.3.164...query-service-parent-0.3.165'
				)
			)
		);
	});

	it('describes Query Service changes without rediscovering upstream state', () => {
		assert.deepEqual(
			wdqsSourceProvider.describeChanges(
				'WDQS_VERSION=0.3.164\n',
				'WDQS_VERSION=0.3.165\n'
			),
			[
				{
					variable: 'WDQS_VERSION',
					description: 'Query Service',
					previous: '0.3.164',
					next: '0.3.165',
					link: {
						label: 'Diff',
						url: 'https://github.com/wikimedia/wikidata-query-rdf/compare/query-service-parent-0.3.164...query-service-parent-0.3.165'
					}
				}
			]
		);
	});

	it('preserves the original file when a deterministic update is declined', async () => {
		const interaction: SourceUpdateInteraction = {
			confirm: async () => false,
			select: async () => {
				throw new Error('selection was not expected');
			},
			note: () => undefined,
			info: () => undefined
		};
		const result = await confirmPinPlan(
			'Example',
			'PIN=old\n',
			{
				contents: 'PIN=new\n',
				changes: [
					{
						variable: 'PIN',
						description: 'Example source',
						previous: 'old',
						next: 'new',
						link: {
							label: 'Diff',
							url: 'https://example.test/compare/old...new'
						}
					}
				]
			},
			interaction
		);

		assert.deepEqual(result, { contents: 'PIN=old\n', changes: [] });
	});

	it('populates an intentionally empty source declaration', async () => {
		const plan = await planPins('PIN=\n', [
			{
				variable: 'PIN',
				description: 'Example source',
				resolve: async () => 'abc123',
				compareUrl: (previous, next) =>
					`https://example.test/compare/${previous}...${next}`,
				commitUrl: (commit) => `https://example.test/commit/${commit}`
			}
		]);

		assert.deepEqual(plan, {
			contents: 'PIN=abc123\n',
			changes: [
				{
					variable: 'PIN',
					description: 'Example source',
					previous: '',
					next: 'abc123',
					link: {
						label: 'Commit',
						url: 'https://example.test/commit/abc123'
					}
				}
			]
		});
	});

	it('describes a source absent from the previous release as newly added', () => {
		assert.deepEqual(
			describePinChanges('', 'PIN=abc123\n', [
				{
					variable: 'PIN',
					description: 'Example source',
					resolve: async () => 'unused',
					compareUrl: (previous, next) =>
						`https://example.test/compare/${previous}...${next}`,
					commitUrl: (commit) => `https://example.test/commit/${commit}`
				}
			]),
			[
				{
					variable: 'PIN',
					description: 'Example source',
					next: 'abc123',
					link: {
						label: 'Commit',
						url: 'https://example.test/commit/abc123'
					}
				}
			]
		);
	});

	it('still rejects a source missing from the current build schema', async () => {
		assert.equal(readVariable('PIN=\n', 'PIN'), '');
		assert.equal(replaceVariable('PIN=\n', 'PIN', 'abc123'), 'PIN=abc123\n');
		await assert.rejects(
			planPins('', [
				{
					variable: 'PIN',
					description: 'Example source',
					resolve: async () => 'abc123'
				}
			]),
			/Could not find PIN in build\.env\./u
		);
	});
});
