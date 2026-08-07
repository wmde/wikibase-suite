import semver from 'semver';
import type {
	SourceChange,
	SourcePin,
	SourceUpdateProvider
} from '../source-types.js';
import {
	changeLines,
	describePinChanges,
	gerritCommit,
	gerritCommitUrl,
	gerritCompareUrl,
	githubCommit,
	githubCommitUrl,
	githubCompareUrl,
	planPins,
	readVariable,
	replaceVariable,
	request
} from '../source-utils.js';

export const wikimediaExtensions = [
	['WIKIBASE_COMMIT', 'Wikibase'],
	['BABEL_COMMIT', 'Babel'],
	['CLDR_COMMIT', 'cldr'],
	['CIRRUSSEARCH_COMMIT', 'CirrusSearch'],
	['ELASTICA_COMMIT', 'Elastica'],
	['ECHO_COMMIT', 'Echo'],
	['ENTITYSCHEMA_COMMIT', 'EntitySchema'],
	['OAUTH_COMMIT', 'OAuth'],
	['PLUGGABLEAUTH_COMMIT', 'PluggableAuth'],
	['UNIVERSALLANGUAGESELECTOR_COMMIT', 'UniversalLanguageSelector'],
	['WIKIBASECIRRUSSEARCH_COMMIT', 'WikibaseCirrusSearch'],
	['WIKIBASEMANIFEST_COMMIT', 'WikibaseManifest'],
	['WSOAUTH_COMMIT', 'WSOAuth']
] as const;

export function wikibasePins(contents: string): SourcePin[] {
	const mediaWikiVersion = readVariable(contents, 'MEDIAWIKI_VERSION');
	const match = /^(\d+)\.(\d+)/u.exec(mediaWikiVersion);
	if (!match) {
		throw new Error(`Invalid MEDIAWIKI_VERSION "${mediaWikiVersion}".`);
	}
	const branch = `REL${match[1]}_${match[2]}`;
	return [
		...wikimediaExtensions.map(([variable, extension]) => ({
			variable,
			description: `${extension} ${branch}`,
			resolve: async () =>
				await gerritCommit(`mediawiki/extensions/${extension}`, branch),
			compareUrl: (previous: string, next: string) =>
				gerritCompareUrl(`mediawiki/extensions/${extension}`, previous, next),
			commitUrl: (commit: string) =>
				gerritCommitUrl(`mediawiki/extensions/${extension}`, commit)
		})),
		{
			variable: 'WIKIBASELOCALMEDIA_COMMIT',
			description: 'WikibaseLocalMedia master',
			resolve: async () =>
				await githubCommit('ProfessionalWiki/WikibaseLocalMedia', 'master'),
			compareUrl: (previous, next) =>
				githubCompareUrl('ProfessionalWiki/WikibaseLocalMedia', previous, next),
			commitUrl: (commit) =>
				githubCommitUrl('ProfessionalWiki/WikibaseLocalMedia', commit)
		},
		{
			variable: 'WIKIBASEEDTF_COMMIT',
			description: 'WikibaseEdtf master',
			resolve: async () =>
				await githubCommit('ProfessionalWiki/WikibaseEdtf', 'master'),
			compareUrl: (previous, next) =>
				githubCompareUrl('ProfessionalWiki/WikibaseEdtf', previous, next),
			commitUrl: (commit) =>
				githubCommitUrl('ProfessionalWiki/WikibaseEdtf', commit)
		},
		{
			variable: 'WIKIBASEINWIKITEXT_COMMIT',
			description: 'WikibaseInWikitext main',
			resolve: async () =>
				await githubCommit(
					'wbstack/mediawiki-extensions-WikibaseInWikitext',
					'main'
				),
			compareUrl: (previous, next) =>
				githubCompareUrl(
					'wbstack/mediawiki-extensions-WikibaseInWikitext',
					previous,
					next
				),
			commitUrl: (commit) =>
				githubCommitUrl(
					'wbstack/mediawiki-extensions-WikibaseInWikitext',
					commit
				)
		}
	];
}

async function mediaWikiVersionsInLine(line: string): Promise<string[]> {
	const response = await request(
		`https://releases.wikimedia.org/mediawiki/${line}/`
	);
	const page = await response.text();
	return [
		...new Set(
			[...page.matchAll(/mediawiki-(\d+\.\d+\.\d+)\.tar\.gz/gmu)].map(
				(match) => match[1]
			)
		)
	].sort(semver.rcompare);
}

export async function discoverMediaWikiCandidates(
	currentVersion: string
): Promise<{ maintenance?: string; newerLine?: string }> {
	const current = semver.parse(currentVersion);
	if (!current) {
		throw new Error(`Invalid MEDIAWIKI_VERSION "${currentVersion}".`);
	}
	const response = await request('https://releases.wikimedia.org/mediawiki/');
	const page = await response.text();
	const lines = [
		...new Set(
			[...page.matchAll(/href="(\d+\.\d+)\//gmu)].map((match) => match[1])
		)
	]
		.filter((line) => {
			const parsed = semver.parse(`${line}.0`);
			return (
				parsed && semver.gte(parsed, `${current.major}.${current.minor}.0`)
			);
		})
		.sort((left, right) => semver.rcompare(`${left}.0`, `${right}.0`));
	const versionsByLine = await Promise.all(
		lines.map(async (line) => ({
			line,
			versions: await mediaWikiVersionsInLine(line)
		}))
	);
	const currentLine = `${current.major}.${current.minor}`;
	const maintenance = versionsByLine.find(({ line }) => line === currentLine)
		?.versions[0];
	const newerLine = versionsByLine.find(
		({ line, versions }) => line !== currentLine && versions.length > 0
	)?.versions[0];
	return {
		maintenance:
			maintenance && semver.gt(maintenance, currentVersion)
				? maintenance
				: undefined,
		newerLine
	};
}

export const wikibaseSourceProvider: SourceUpdateProvider = {
	image: 'wikibase',
	describeChanges: (previousContents, nextContents) => {
		const previousVersion = readVariable(previousContents, 'MEDIAWIKI_VERSION');
		const nextVersion = readVariable(nextContents, 'MEDIAWIKI_VERSION');
		const mediaWikiChange: SourceChange[] =
			previousVersion === nextVersion
				? []
				: [
						{
							variable: 'MEDIAWIKI_VERSION',
							description: 'MediaWiki',
							previous: previousVersion,
							next: nextVersion,
							link: {
								label: 'Release notes',
								url: `https://www.mediawiki.org/wiki/Release_notes/${nextVersion.replace(/\.\d+$/u, '')}`
							}
						}
					];
		return [
			...mediaWikiChange,
			...describePinChanges(
				previousContents,
				nextContents,
				wikibasePins(nextContents)
			)
		];
	},
	plan: async (contents, interaction) => {
		const currentVersion = readVariable(contents, 'MEDIAWIKI_VERSION');
		const candidates = await discoverMediaWikiCandidates(currentVersion);
		const options = [
			...(candidates.maintenance
				? [
						{
							value: candidates.maintenance,
							label: `Update within the current release line to ${candidates.maintenance}`
						}
					]
				: []),
			...(candidates.newerLine
				? [
						{
							value: candidates.newerLine,
							label: `Move to the newer stable release line ${candidates.newerLine}`,
							hint: 'requires major-version compatibility review'
						}
					]
				: []),
			{
				value: 'refresh',
				label: `Keep MediaWiki ${currentVersion} and refresh extensions`
			},
			{ value: 'skip', label: 'Skip Wikibase' }
		];
		interaction.info(
			'Bundled extensions will be updated automatically to the latest commits on the selected MediaWiki release branch; community extensions will use their configured branches.'
		);
		const selection = await interaction.select(
			`Wikibase currently uses MediaWiki ${currentVersion}. What should be updated?`,
			options
		);
		if (selection === 'skip') {
			return { contents, changes: [] };
		}
		const selectedVersion =
			selection === 'refresh' ? currentVersion : selection;
		let plannedContents = contents;
		const changes: SourceChange[] = [];
		if (selectedVersion !== currentVersion) {
			plannedContents = replaceVariable(
				plannedContents,
				'MEDIAWIKI_VERSION',
				selectedVersion
			);
			changes.push({
				variable: 'MEDIAWIKI_VERSION',
				description: 'MediaWiki',
				previous: currentVersion,
				next: selectedVersion,
				link: {
					label: 'Release notes',
					url: `https://www.mediawiki.org/wiki/Release_notes/${selectedVersion.replace(/\.\d+$/u, '')}`
				}
			});
		}
		const pins = await planPins(plannedContents, wikibasePins(plannedContents));
		changes.push(...pins.changes);
		if (changes.length === 0) {
			interaction.info(
				'Wikibase and its configured extensions are already current.'
			);
			return { contents, changes: [] };
		}
		interaction.note('Wikibase update', changeLines(changes));
		return { contents: pins.contents, changes };
	}
};
