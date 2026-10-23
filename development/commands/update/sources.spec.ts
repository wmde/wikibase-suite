import { afterEach, describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { discoverWdqsCandidates, wdqsSourceProvider } from './projects/wdqs.js';
import {
	mediaWikiVersionAtCommit,
	wikibaseSourceProvider
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

	it('reads MediaWiki version from the selected source commit', async () => {
		globalThis.fetch = async (input) => {
			assert.equal(
				String(input),
				'https://raw.githubusercontent.com/wikimedia/mediawiki/abc123/includes/Defines.php'
			);
			return new Response("define( 'MW_VERSION', '1.47.0-beta' );", {
				status: 200
			});
		};
		assert.equal(
			await mediaWikiVersionAtCommit(
				'https://github.com/wikimedia/mediawiki.git',
				'abc123'
			),
			'1.47.0-beta'
		);
	});

	it('links MediaWiki updates to the release branch notes', () => {
		const previous = `variable "MEDIAWIKI" {
  default = {
    version       = "1.46.1"
    repo          = "https://github.com/wikimedia/mediawiki.git"
    ref           = "refs/heads/REL1_46"
    commit        = "old-commit"
    release_notes = "https://phabricator.wikimedia.org/source/mediawiki/browse/{branch}/RELEASE-NOTES-{line}"
  }
}
`;
		const next = replaceVariable(previous, 'MEDIAWIKI.version', '1.46.2');
		assert.deepEqual(wikibaseSourceProvider.describeChanges(previous, next), [
			{
				variable: 'MEDIAWIKI.version',
				description: 'MediaWiki',
				previous: '1.46.1',
				next: '1.46.2',
				link: {
					label: 'Release notes',
					url: 'https://phabricator.wikimedia.org/source/mediawiki/browse/REL1_46/RELEASE-NOTES-1.46'
				}
			}
		]);
	});

	it('refreshes the MediaWiki commit from its release branch and describes the diff', async () => {
		const previous = readFileSync(
			resolve(WIKIBASE_IMAGE, 'docker-bake.hcl'),
			'utf8'
		);
		const current = readVariable(previous, 'MEDIAWIKI.commit');
		const currentVersion = readVariable(previous, 'MEDIAWIKI.version');
		const currentBranch = readVariable(previous, 'MEDIAWIKI.ref').replace(
			'refs/heads/',
			''
		);
		const nextCommit = '1111111111111111111111111111111111111111';
		globalThis.fetch = async (input) => {
			const url = String(input);
			if (url.includes('/includes/Defines.php'))
				return new Response(`define( 'MW_VERSION', '${currentVersion}' );`, {
					status: 200
				});
			assert.equal(
				url,
				`https://api.github.com/repos/wikimedia/mediawiki/commits/${currentBranch}`
			);
			return new Response(JSON.stringify({ sha: nextCommit }), {
				status: 200
			});
		};
		const prompts: string[] = [];
		const additional = {
			'build/extensions.json': JSON.stringify({
				schemaVersion: 1,
				extensions: []
			})
		};
		const interaction: SourceUpdateInteraction = {
			confirm: async (message) => {
				prompts.push(message);
				return true;
			},
			select: async () => {
				throw new Error('Version selection should not be shown.');
			},
			note: () => undefined,
			info: () => undefined
		};
		const plan = await wikibaseSourceProvider.planWithAdditional!(
			previous,
			additional,
			interaction
		);
		assert.deepEqual(prompts, [
			`Refresh MediaWiki ${currentBranch} and extensions?`
		]);
		assert.equal(readVariable(plan.contents, 'MEDIAWIKI.commit'), nextCommit);
		assert.equal(
			readVariable(plan.contents, 'MEDIAWIKI.version'),
			readVariable(previous, 'MEDIAWIKI.version')
		);
		assert.deepEqual(
			wikibaseSourceProvider.describeChangesWithAdditional!(
				previous,
				plan.contents,
				additional,
				plan.additionalContents!
			),
			[
				{
					variable: 'MEDIAWIKI.commit',
					description: `MediaWiki ${currentBranch}`,
					previous: current,
					next: nextCommit,
					link: {
						label: 'Diff',
						url: `https://github.com/wikimedia/mediawiki/compare/${current}...${nextCommit}`
					}
				}
			]
		);
	});

	it('derives the version after the configured release branch changes', async () => {
		const previous = readFileSync(
			resolve(WIKIBASE_IMAGE, 'docker-bake.hcl'),
			'utf8'
		);
		const changedRef = replaceVariable(
			previous,
			'MEDIAWIKI.ref',
			'refs/heads/REL1_48'
		);
		const nextCommit = '2222222222222222222222222222222222222222';
		globalThis.fetch = async (input) => {
			const url = String(input);
			if (url.includes('/includes/Defines.php'))
				return new Response("define( 'MW_VERSION', '1.48.0-beta' );", {
					status: 200
				});
			const commits = new Map([
				[
					'https://api.github.com/repos/wikimedia/mediawiki/commits/REL1_48',
					nextCommit
				],
				[
					'https://api.github.com/repos/wikimedia/mediawiki-extensions-Example/commits/REL1_48',
					'3333333333333333333333333333333333333333'
				]
			]);
			const sha = commits.get(url);
			assert.ok(sha, `unexpected request ${url}`);
			return new Response(JSON.stringify({ sha }), {
				status: 200
			});
		};
		const additional = {
			'build/extensions.json': JSON.stringify({
				schemaVersion: 1,
				extensions: [
					{
						name: 'Example',
						source: {
							repo: 'https://github.com/wikimedia/mediawiki-extensions-Example.git',
							ref: readVariable(previous, 'MEDIAWIKI.ref'),
							commit: 'old-extension-commit'
						}
					}
				]
			})
		};
		const result = await wikibaseSourceProvider.planWithAdditional!(
			changedRef,
			additional,
			{
				confirm: async () => true,
				select: async () => {
					throw new Error('Version selection should not be shown.');
				},
				note: () => undefined,
				info: () => undefined
			}
		);
		const updatedExtensions = JSON.parse(
			result.additionalContents!['build/extensions.json']
		);
		assert.equal(
			readVariable(result.contents, 'MEDIAWIKI.version'),
			'1.48.0-beta'
		);
		assert.equal(
			readVariable(result.contents, 'MEDIAWIKI.ref'),
			'refs/heads/REL1_48'
		);
		assert.equal(readVariable(result.contents, 'MEDIAWIKI.commit'), nextCommit);
		assert.equal(
			updatedExtensions.extensions[0].source.ref,
			'refs/heads/REL1_48'
		);
		assert.deepEqual(
			result.changes.map(({ variable }) => variable),
			['MEDIAWIKI.version', 'MEDIAWIKI.commit', 'Example.source.commit']
		);
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
