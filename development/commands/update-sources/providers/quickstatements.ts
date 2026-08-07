import { codebergCommit, githubCommit } from '../shared.js';
import type { SourceUpdateProvider } from '../types.js';

export const quickStatementsSourceProvider: SourceUpdateProvider = {
	image: 'quickstatements',
	sources: () => [
		{
			variable: 'QUICKSTATEMENTS_COMMIT',
			description: 'magnusmanske/quickstatements master',
			resolve: async () =>
				await githubCommit('magnusmanske/quickstatements', 'master')
		},
		{
			variable: 'MAGNUSTOOLS_COMMIT',
			description: 'magnusmanske/magnustools master',
			resolve: async () =>
				await codebergCommit('magnusmanske/magnustools', 'master'),
			archiveShaVariable: 'MAGNUSTOOLS_ARCHIVE_SHA',
			archiveUrl: (commit) =>
				`https://codeberg.org/magnusmanske/magnustools/archive/${commit}.tar.gz`
		}
	]
};
