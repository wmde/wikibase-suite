import { afterEach, describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { discoverWdqsCandidates, wdqsSourceProvider } from './projects/wdqs.js';
import {
	discoverMediaWikiCandidates,
	selectMediaWikiUpdate
} from './projects/wikibase.js';
import type { SourceUpdateInteraction } from './source-types.js';
import {
	confirmPinPlan,
	describePinChanges,
	manifestPins,
	planPins,
	readVariable,
	replaceVariable
} from './source-utils.js';

const WIKIBASE_IMAGE = resolve('images/wikibase');
const QUICKSTATEMENTS_MANIFEST = resolve(
	'images/quickstatements/docker-bake.hcl'
);
const WDQS_MANIFEST = resolve('images/wdqs/docker-bake.hcl');
const originalFetch = globalThis.fetch;

const pinManifest = (value: string) =>
	`variable "PIN" {\n  default = "${value}"\n}\n`;

describe('Wikibase source update provider', () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
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

	it('asks only about extensions when MediaWiki is already current', async () => {
		const prompts: string[] = [];
		const selected = await selectMediaWikiUpdate(
			'1.46.0',
			{},
			{
				confirm: async (message) => {
					prompts.push(message);
					return true;
				},
				select: async () => {
					throw new Error('MediaWiki choices should not be shown.');
				}
			}
		);

		assert.equal(selected, '1.46.0');
		assert.deepEqual(prompts, ['Refresh extensions?']);
	});

	it('offers update choices when a newer MediaWiki version exists', async () => {
		const prompts: string[] = [];
		const selected = await selectMediaWikiUpdate(
			'1.46.0',
			{ maintenance: '1.46.1' },
			{
				confirm: async (message) => {
					prompts.push(message);
					return false;
				},
				select: async (_message, options) => {
					assert.equal(options.at(-1)?.label, 'No');
					return options.at(-1)!.value;
				}
			}
		);

		assert.equal(selected, undefined);
		assert.deepEqual(prompts, ['Refresh extensions?']);
	});

	it('refreshes extensions implicitly with a MediaWiki update', async () => {
		const selected = await selectMediaWikiUpdate(
			'1.46.0',
			{ maintenance: '1.46.1', newerLine: '1.47.0' },
			{
				confirm: async () => {
					throw new Error('The extension-only prompt should not be shown.');
				},
				select: async (_message, options) => {
					assert.match(options[0].label, /compatible extensions/u);
					assert.match(options[1].label, /compatible extensions/u);
					return options[0].value;
				}
			}
		);

		assert.equal(selected, '1.46.1');
	});

	it('keeps image package sources in the registry', () => {
		const contents = readFileSync(
			resolve(WIKIBASE_IMAGE, 'build/extensions.json'),
			'utf8'
		);
		const registry = JSON.parse(contents) as {
			schemaVersion: number;
			extensions: Array<{ name: string; source: unknown }>;
		};
		assert.equal(registry.schemaVersion, 1);
		assert.ok(registry.extensions.length > 0);
		assert.equal(
			new Set(registry.extensions.map(({ name }) => name)).size,
			registry.extensions.length
		);
		assert.ok(registry.extensions.every(({ source }) => source !== null));
		assert.deepEqual(
			registry.extensions.slice(0, 4).map(({ name }) => name),
			['Wikibase', 'WikibaseEdtf', 'EntitySchema', 'WikibaseLocalMedia']
		);
	});
});

describe('Bake source pins', () => {
	it('discovers branch-pinned sources without kind metadata', () => {
		const pins = manifestPins(readFileSync(QUICKSTATEMENTS_MANIFEST, 'utf8'));

		assert.deepEqual(
			pins
				.map(({ variable, description }) => ({ variable, description }))
				.sort((left, right) => left.variable.localeCompare(right.variable)),
			[
				{
					variable: 'MAGNUSTOOLS.commit',
					description: 'MagnusTools master'
				},
				{
					variable: 'QUICKSTATEMENTS.commit',
					description: 'QuickStatements master'
				}
			]
		);
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
						{ name: 'query-service-parent-0.3.166' },
						{ name: 'query-service-parent-0.3.165' }
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
		const contents = readFileSync(WDQS_MANIFEST, 'utf8');
		const result = await wdqsSourceProvider.plan(contents, interaction);

		assert.deepEqual(result, { contents, changes: [] });
		assert.ok(
			notes.some((line) =>
				line.includes(
					'compare/query-service-parent-0.3.165...query-service-parent-0.3.166'
				)
			)
		);
	});

	it('describes Query Service changes without rediscovering upstream state', () => {
		const previous = readFileSync(WDQS_MANIFEST, 'utf8');
		const next = replaceVariable(previous, 'WDQS.version', '0.3.166');
		assert.deepEqual(wdqsSourceProvider.describeChanges(previous, next), [
			{
				variable: 'WDQS.version',
				description: 'Query Service',
				previous: '0.3.165',
				next: '0.3.166',
				link: {
					label: 'Diff',
					url: 'https://github.com/wikimedia/wikidata-query-rdf/compare/query-service-parent-0.3.165...query-service-parent-0.3.166'
				}
			}
		]);
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
		const original = pinManifest('old');
		const result = await confirmPinPlan(
			'Example',
			original,
			{
				contents: pinManifest('new'),
				changes: [
					{
						variable: 'PIN',
						description: 'Example source',
						previous: 'old',
						next: 'new'
					}
				]
			},
			interaction
		);
		assert.deepEqual(result, { contents: original, changes: [] });
	});

	it('populates an intentionally empty source declaration', async () => {
		const plan = await planPins(pinManifest(''), [
			{
				variable: 'PIN',
				description: 'Example source',
				resolve: async () => 'abc123',
				commitUrl: (commit) => `https://example.test/commit/${commit}`
			}
		]);
		assert.equal(readVariable(plan.contents, 'PIN'), 'abc123');
		assert.equal(plan.changes[0].next, 'abc123');
	});

	it('resolves Wikimedia GitLab source pins and comparison links', async () => {
		globalThis.fetch = async (input) => {
			assert.equal(
				String(input),
				'https://gitlab.wikimedia.org/api/v4/projects/repos%2Fwmde%2Fexample/repository/branches/main'
			);
			return new Response(JSON.stringify({ commit: { id: 'new-commit' } }), {
				status: 200
			});
		};
		const manifest = `variable "SOURCE" {
  default = {
    name = "Example"
    repo = "https://gitlab.wikimedia.org/repos/wmde/example.git"
    ref = "refs/heads/main"
    commit = "old-commit"
  }
}
`;
		const plan = await planPins(manifest, manifestPins(manifest));

		assert.equal(readVariable(plan.contents, 'SOURCE.commit'), 'new-commit');
		assert.equal(
			plan.changes[0].link?.url,
			'https://gitlab.wikimedia.org/repos/wmde/example/-/compare/old-commit...new-commit'
		);
	});

	it('describes a source absent from the previous release as newly added', () => {
		assert.equal(
			describePinChanges('', pinManifest('abc123'), [
				{
					variable: 'PIN',
					description: 'Example source',
					resolve: async () => 'unused',
					commitUrl: (commit) => `https://example.test/commit/${commit}`
				}
			])[0].next,
			'abc123'
		);
	});

	it('still rejects a source missing from the current manifest', async () => {
		assert.equal(readVariable(pinManifest(''), 'PIN'), '');
		assert.equal(
			readVariable(replaceVariable(pinManifest(''), 'PIN', 'abc123'), 'PIN'),
			'abc123'
		);
		await assert.rejects(
			planPins('', [
				{
					variable: 'PIN',
					description: 'Example source',
					resolve: async () => 'abc123'
				}
			]),
			/Could not find PIN in the Bake manifest\./u
		);
	});
});
