import semver from 'semver';
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

const TAG_PREFIX = 'query-service-parent-';

export async function discoverWdqsCandidates(
	currentVersion: string
): Promise<string[]> {
	const tags = await githubJson<GitHubTag[]>(
		'/repos/wikimedia/wikidata-query-rdf/tags?per_page=100'
	);
	return tags
		.map(({ name }) =>
			name.startsWith(TAG_PREFIX) ? name.slice(TAG_PREFIX.length) : ''
		)
		.filter(
			(version) => semver.valid(version) && semver.gt(version, currentVersion)
		)
		.sort(semver.rcompare);
}

async function validateDistribution(version: string): Promise<void> {
	const base =
		`https://gitlab.wikimedia.org/api/v4/projects/2745/packages/maven/` +
		`org/wikidata/query/rdf/service/${version}/service-${version}-dist.tar.gz`;
	await request(base, {}, 'HEAD');
	const checksum = await (await request(`${base}.md5`)).text();
	if (!/^[a-f\d]{32}(?:\s|$)/iu.test(checksum.trim())) {
		throw new Error(`WDQS ${version} has no valid distribution checksum.`);
	}
}

export const wdqsSourceProvider: SourceUpdateProvider = {
	image: 'wdqs',
	describeChanges: (previousContents, nextContents) => {
		const previous = readVariable(previousContents, 'WDQS_VERSION');
		const next = readVariable(nextContents, 'WDQS_VERSION');
		return previous === next
			? []
			: [
					{
						variable: 'WDQS_VERSION',
						description: 'Query Service',
						previous,
						next,
						link: {
							label: 'Diff',
							url:
								`https://github.com/wikimedia/wikidata-query-rdf/compare/` +
								`${TAG_PREFIX}${previous}...${TAG_PREFIX}${next}`
						}
					}
				];
	},
	plan: async (contents, interaction) => {
		const currentVersion = readVariable(contents, 'WDQS_VERSION');
		const candidates = await discoverWdqsCandidates(currentVersion);
		if (candidates.length === 0) {
			interaction.info(`Query Service ${currentVersion} is already current.`);
			return { contents, changes: [] };
		}
		const candidate = candidates[0];
		interaction.info(
			`Validating the Query Service ${candidate} distribution and checksum.`
		);
		await validateDistribution(candidate);
		const previousTag = `${TAG_PREFIX}${currentVersion}`;
		const nextTag = `${TAG_PREFIX}${candidate}`;
		const changes = [
			{
				variable: 'WDQS_VERSION',
				description: 'Query Service',
				previous: currentVersion,
				next: candidate,
				link: {
					label: 'Diff',
					url:
						`https://github.com/wikimedia/wikidata-query-rdf/compare/` +
						`${previousTag}...${nextTag}`
				}
			}
		];
		interaction.note('Query Service candidate', [
			...changeLines(changes),
			'  Distribution and checksum: available'
		]);
		if (!(await interaction.confirm(`Update Query Service to ${candidate}?`))) {
			return { contents, changes: [] };
		}
		return {
			contents: replaceVariable(contents, 'WDQS_VERSION', candidate),
			changes
		};
	}
};
