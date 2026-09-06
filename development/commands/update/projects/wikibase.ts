import semver from 'semver';
import { bakeObject, resolveBakeVariables } from '../../../lib/bake.js';
import { strong } from '../presentation.js';
import type {
	SourceChange,
	SourceUpdateInteraction,
	SourceUpdateProvider
} from '../source-types.js';
import {
	changeLines,
	gitRefName,
	gitSourcePin,
	pinLink,
	readVariable,
	replaceVariable,
	request
} from '../source-utils.js';

const REGISTRY_PATH = 'build/extensions.json';
type GitSource = {
	repo: string;
	ref: string;
	commit: string;
	patches?: string[];
};
type Extension = { name: string; source: GitSource | { path: string } };
type Registry = { schemaVersion: number; extensions: Extension[] };

function settings(contents: string) {
	const value = bakeObject(
		resolveBakeVariables(contents, process.cwd()),
		'MEDIAWIKI'
	);
	return {
		source: String(value.source).replace(/\/?$/u, '/'),
		notes: String(value.release_notes)
	};
}
function notesUrl(settingsValue: ReturnType<typeof settings>, version: string) {
	return settingsValue.notes.replace('{line}', version.replace(/\.\d+$/u, ''));
}
function registry(contents: string): Registry {
	const value = JSON.parse(contents) as Registry;
	if (value.schemaVersion !== 1 || !Array.isArray(value.extensions))
		throw new Error('Invalid Wikibase extension manifest.');
	return value;
}
function git(source: Extension['source']): source is GitSource {
	return Boolean(
		source && 'repo' in source && 'ref' in source && 'commit' in source
	);
}
function isWmfRef(ref: string) {
	return /^refs\/heads\/REL\d+_\d+$/u.test(ref);
}
function wmfRef(version: string) {
	const [major, minor] = version.split('.');
	return `refs/heads/REL${major}_${minor}`;
}

async function versions(line: string, source: string) {
	const page = await (await request(`${source}${line}/`)).text();
	return [
		...new Set(
			[...page.matchAll(/mediawiki-(\d+\.\d+\.\d+)\.tar\.gz/gmu)].map(
				(match) => match[1]
			)
		)
	].sort(semver.rcompare);
}
export async function discoverMediaWikiCandidates(
	currentVersion: string,
	source = 'https://releases.wikimedia.org/mediawiki/'
) {
	const current = semver.parse(currentVersion);
	if (!current)
		throw new Error(`Invalid MEDIAWIKI_VERSION "${currentVersion}".`);
	const base = source.replace(/\/?$/u, '/');
	const page = await (await request(base)).text();
	const lines = [
		...new Set(
			[...page.matchAll(/href="(\d+\.\d+)\//gmu)].map((match) => match[1])
		)
	]
		.filter((line) => {
			const value = semver.parse(`${line}.0`);
			return value && semver.gte(value, `${current.major}.${current.minor}.0`);
		})
		.sort((a, b) => semver.rcompare(`${a}.0`, `${b}.0`));
	const found = await Promise.all(
		lines.map(async (line) => ({ line, versions: await versions(line, base) }))
	);
	const line = `${current.major}.${current.minor}`;
	const maintenance = found.find((value) => value.line === line)?.versions[0];
	const newerLine = found.find(
		(value) => value.line !== line && value.versions.length
	)?.versions[0];
	return {
		maintenance:
			maintenance && semver.gt(maintenance, currentVersion)
				? maintenance
				: undefined,
		newerLine
	};
}
export async function selectMediaWikiUpdate(
	current: string,
	candidates: { maintenance?: string; newerLine?: string },
	interaction: Pick<SourceUpdateInteraction, 'confirm' | 'select'>
) {
	if (!candidates.maintenance && !candidates.newerLine)
		return (await interaction.confirm('Refresh extensions?'))
			? current
			: undefined;
	const selected = await interaction.select(
		`Update ${strong('MediaWiki')}? (current: ${strong(current)})`,
		[
			...(candidates.maintenance
				? [
						{
							value: candidates.maintenance,
							label: `Update to ${strong(candidates.maintenance)} and refresh compatible extensions`
						}
					]
				: []),
			...(candidates.newerLine
				? [
						{
							value: candidates.newerLine,
							label: `Move to ${strong(candidates.newerLine)} and refresh compatible extensions`,
							hint: 'requires major-version compatibility review'
						}
					]
				: []),
			{ value: 'skip', label: 'No' }
		]
	);
	return selected === 'skip'
		? (await interaction.confirm('Refresh extensions?'))
			? current
			: undefined
		: selected;
}

function registryChanges(previous: string, next: string): SourceChange[] {
	const old = new Map(
		registry(previous).extensions.map((item) => [item.name, item])
	);
	return registry(next).extensions.flatMap((item) => {
		if (!git(item.source)) return [];
		const prior = old.get(item.name)?.source;
		const before = git(prior) ? prior.commit : undefined;
		return before === item.source.commit
			? []
			: [
					{
						variable: `${item.name}.source.commit`,
						description: `${item.name} ${gitRefName(item.source.ref)}`,
						...(before ? { previous: before } : {}),
						next: item.source.commit,
						link: pinLink(gitSourcePin(item.source), before, item.source.commit)
					}
				];
	});
}

export const wikibaseSourceProvider: SourceUpdateProvider = {
	image: 'wikibase',
	additionalSourcePaths: [REGISTRY_PATH],
	describeChanges: (previous, next) => {
		const value = settings(next);
		const before = readVariable(previous, 'MEDIAWIKI.version');
		const after = readVariable(next, 'MEDIAWIKI.version');
		return before === after
			? []
			: [
					{
						variable: 'MEDIAWIKI.version',
						description: 'MediaWiki',
						previous: before,
						next: after,
						link: { label: 'Release notes', url: notesUrl(value, after) }
					}
				];
	},
	plan: async (contents, interaction) => {
		const value = settings(contents);
		const current = readVariable(contents, 'MEDIAWIKI.version');
		const selected = await selectMediaWikiUpdate(
			current,
			await discoverMediaWikiCandidates(current, value.source),
			interaction
		);
		if (!selected) return { contents, changes: [] };
		const next =
			selected === current
				? contents
				: replaceVariable(contents, 'MEDIAWIKI.version', selected);
		return {
			contents: next,
			changes:
				selected === current
					? []
					: [
							{
								variable: 'MEDIAWIKI.version',
								description: 'MediaWiki',
								previous: current,
								next: selected,
								link: { label: 'Release notes', url: notesUrl(value, selected) }
							}
						],
			refreshSources: true
		};
	},
	planWithAdditional: async (contents, additional, interaction) => {
		const base = await wikibaseSourceProvider.plan(contents, interaction);
		if (!base.refreshSources) {
			return { ...base, additionalContents: additional };
		}
		const value = registry(additional[REGISTRY_PATH]);
		const version = readVariable(base.contents, 'MEDIAWIKI.version');
		const changes = [...base.changes];
		for (const item of value.extensions) {
			if (!git(item.source)) continue;
			if (isWmfRef(item.source.ref)) item.source.ref = wmfRef(version);
			const source = gitSourcePin(item.source);
			const before = item.source.commit;
			const next = await source.resolve();
			if (before === next) continue;
			item.source.commit = next;
			changes.push({
				variable: `${item.name}.source.commit`,
				description: `${item.name} ${gitRefName(item.source.ref)}`,
				previous: before,
				next,
				link: pinLink(source, before, next)
			});
		}
		if (changes.length) interaction.note('Source update', changeLines(changes));
		else
			interaction.info(
				'Dependencies are current.'
			);
		return {
			contents: base.contents,
			changes,
			additionalContents: {
				[REGISTRY_PATH]: `${JSON.stringify(value, null, 2)}\n`
			}
		};
	},
	describeChangesWithAdditional: (
		previous,
		next,
		previousAdditional,
		nextAdditional
	) => [
		...wikibaseSourceProvider.describeChanges(previous, next),
		...registryChanges(
			previousAdditional[REGISTRY_PATH],
			nextAdditional[REGISTRY_PATH]
		)
	]
};
