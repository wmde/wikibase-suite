import { gerritCommit, githubCommit, readVariable } from '../shared.js';
import type { SourceUpdateProvider } from '../types.js';

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

export const wikibaseSourceProvider: SourceUpdateProvider = {
	image: 'wikibase',
	sources: (contents) => {
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
					await gerritCommit(`mediawiki/extensions/${extension}`, branch)
			})),
			{
				variable: 'WIKIBASELOCALMEDIA_COMMIT',
				description: 'ProfessionalWiki/WikibaseLocalMedia master',
				resolve: async () =>
					await githubCommit('ProfessionalWiki/WikibaseLocalMedia', 'master')
			},
			{
				variable: 'WIKIBASEEDTF_COMMIT',
				description: 'ProfessionalWiki/WikibaseEdtf master',
				resolve: async () =>
					await githubCommit('ProfessionalWiki/WikibaseEdtf', 'master')
			},
			{
				variable: 'WIKIBASEINWIKITEXT_COMMIT',
				description: 'wbstack/mediawiki-extensions-WikibaseInWikitext main',
				resolve: async () =>
					await githubCommit(
						'wbstack/mediawiki-extensions-WikibaseInWikitext',
						'main'
					)
			}
		];
	}
};
