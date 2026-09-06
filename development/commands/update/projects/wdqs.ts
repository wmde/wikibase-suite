import semver from 'semver';
import { bakeObject, resolveBakeVariables } from '../../../lib/bake.js';
import { strong } from '../presentation.js';
import type { SourceUpdateProvider } from '../source-types.js';
import {
	changeLines,
	githubJson,
	readVariable,
	replaceVariable,
	request
} from '../source-utils.js';

interface GitHubTag {
	name: string;
}

export async function discoverWdqsCandidates(
	currentVersion: string,
	repository = 'wikimedia/wikidata-query-rdf',
	tagPrefix = 'query-service-parent-'
): Promise<string[]> {
	const tags = await githubJson<GitHubTag[]>(
		`/repos/${repository}/tags?per_page=100`
	);
	return tags
		.map(({ name }) =>
			name.startsWith(tagPrefix) ? name.slice(tagPrefix.length) : ''
		)
		.filter(
			(version) => semver.valid(version) && semver.gt(version, currentVersion)
		)
		.sort(semver.rcompare);
}

async function validateDistribution(
	version: string,
	template: string
): Promise<void> {
	const base = template.replaceAll('{version}', version);
	await request(base, {}, 'HEAD');
	const checksum = await (await request(`${base}.md5`)).text();
	if (!/^[a-f\d]{32}(?:\s|$)/iu.test(checksum.trim())) {
		throw new Error(`WDQS ${version} has no valid distribution checksum.`);
	}
}

function manifestSettings(contents: string): {
	repository: string;
	tagPrefix: string;
	distribution: string;
} {
	const source = bakeObject(
		resolveBakeVariables(contents, process.cwd()),
		'WDQS'
	);
	const repo = String(source.repo);
	return {
		repository: repo
			.replace(/^https:\/\/github\.com\//u, '')
			.replace(/\.git$/u, ''),
		tagPrefix: String(source.tag_prefix),
		distribution: String(source.distribution)
	};
}

export const wdqsSourceProvider: SourceUpdateProvider = {
	image: 'wdqs',
	describeChanges: (previousContents, nextContents) => {
		const previous = readVariable(previousContents, 'WDQS.version');
		const next = readVariable(nextContents, 'WDQS.version');
		const settings = manifestSettings(nextContents);
		return previous === next
			? []
			: [
					{
						variable: 'WDQS.version',
						description: 'Query Service',
						previous,
						next,
						link: {
							label: 'Diff',
							url:
								`https://github.com/${settings.repository}/compare/` +
								`${settings.tagPrefix}${previous}...${settings.tagPrefix}${next}`
						}
					}
				];
	},
	plan: async (contents, interaction) => {
		const currentVersion = readVariable(contents, 'WDQS.version');
		const settings = manifestSettings(contents);
		const candidates = await discoverWdqsCandidates(
			currentVersion,
			settings.repository,
			settings.tagPrefix
		);
		if (candidates.length === 0) {
			interaction.info('Dependencies are current.');
			return { contents, changes: [] };
		}
		const candidate = candidates[0];
		await validateDistribution(candidate, settings.distribution);
		const previousTag = `${settings.tagPrefix}${currentVersion}`;
		const nextTag = `${settings.tagPrefix}${candidate}`;
		const changes = [
			{
				variable: 'WDQS.version',
				description: 'Query Service',
				previous: currentVersion,
				next: candidate,
				link: {
					label: 'Diff',
					url:
						`https://github.com/${settings.repository}/compare/` +
						`${previousTag}...${nextTag}`
				}
			}
		];
		interaction.note('Source candidate', [
			...changeLines(changes),
			'  Distribution and checksum: available'
		]);
		if (!(await interaction.confirm(`Update to ${strong(candidate)}?`))) {
			return { contents, changes: [] };
		}
		return {
			contents: replaceVariable(contents, 'WDQS.version', candidate),
			changes
		};
	}
};
