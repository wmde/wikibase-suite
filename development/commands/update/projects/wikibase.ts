import semver from 'semver';
import { bakeObject, resolveBakeVariables } from '../../../lib/bake.js';
import type {
	SourceChange,
	SourcePin,
	SourceUpdateProvider
} from '../source-types.js';
import {
	changeLines,
	describePinChanges,
	gitRefName,
	gitSourcePin,
	pinLink,
	planPins,
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
		notes: String(value.release_notes)
	};
}
function mediaWikiLine(version: string) {
	const parsed = semver.parse(version);
	if (!parsed) throw new Error(`Invalid MediaWiki version "${version}".`);
	return `${parsed.major}.${parsed.minor}`;
}
function mediaWikiBranchName(version: string) {
	return `REL${mediaWikiLine(version).replace('.', '_')}`;
}
function notesUrl(settingsValue: ReturnType<typeof settings>, version: string) {
	return settingsValue.notes
		.replace('{line}', mediaWikiLine(version))
		.replace('{branch}', mediaWikiBranchName(version));
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
function isMediaWikiBranchRef(ref: string) {
	return /^refs\/heads\/REL\d+_\d+$/u.test(ref);
}

function mediaWikiPin(contents: string): SourcePin {
	const value = bakeObject(
		resolveBakeVariables(contents, process.cwd()),
		'MEDIAWIKI'
	);
	const ref = String(value.ref);
	return {
		variable: 'MEDIAWIKI.commit',
		description: `MediaWiki ${gitRefName(ref)}`,
		...gitSourcePin({ repo: String(value.repo), ref })
	};
}

export async function mediaWikiVersionAtCommit(repo: string, commit: string) {
	const match = /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/u.exec(
		repo
	);
	if (!match)
		throw new Error(
			`MediaWiki source version lookup requires a GitHub repository: ${repo}.`
		);
	const url = `https://raw.githubusercontent.com/${match[1]}/${commit}/includes/Defines.php`;
	const source = await (await request(url)).text();
	const version = /^define\(\s*'MW_VERSION'\s*,\s*'([^']+)'\s*\);$/mu.exec(
		source
	)?.[1];
	if (!version || !semver.valid(version))
		throw new Error(`Could not read a valid MW_VERSION from ${url}.`);
	return version;
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
		return [
			...(before === after
				? []
				: [
						{
							variable: 'MEDIAWIKI.version',
							description: 'MediaWiki',
							previous: before,
							next: after,
							link: { label: 'Release notes', url: notesUrl(value, after) }
						}
					]),
			...describePinChanges(previous, next, [mediaWikiPin(next)])
		];
	},
	plan: async (contents, interaction) => {
		const value = settings(contents);
		const ref = readVariable(contents, 'MEDIAWIKI.ref');
		if (
			!(await interaction.confirm(
				`Refresh MediaWiki ${gitRefName(ref)} and extensions?`
			))
		)
			return { contents, changes: [] };
		const current = readVariable(contents, 'MEDIAWIKI.version');
		const pinPlan = await planPins(contents, [mediaWikiPin(contents)]);
		const commit = readVariable(pinPlan.contents, 'MEDIAWIKI.commit');
		const selected = await mediaWikiVersionAtCommit(
			readVariable(contents, 'MEDIAWIKI.repo'),
			commit
		);
		if (
			isMediaWikiBranchRef(ref) &&
			ref !== `refs/heads/${mediaWikiBranchName(selected)}`
		)
			throw new Error(
				`${ref} reports MW_VERSION ${selected}; check the configured MediaWiki ref.`
			);
		const next =
			current === selected
				? pinPlan.contents
				: replaceVariable(pinPlan.contents, 'MEDIAWIKI.version', selected);
		return {
			contents: next,
			changes: [
				...(selected === current
					? []
					: [
							{
								variable: 'MEDIAWIKI.version',
								description: 'MediaWiki',
								previous: current,
								next: selected,
								link: { label: 'Release notes', url: notesUrl(value, selected) }
							}
						]),
				...pinPlan.changes
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
		const ref = readVariable(base.contents, 'MEDIAWIKI.ref');
		const changes = [...base.changes];
		for (const item of value.extensions) {
			if (!git(item.source)) continue;
			if (isMediaWikiBranchRef(item.source.ref)) item.source.ref = ref;
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
		else interaction.info('Dependencies are current.');
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
