import { gerritCommit } from '../shared.js';
import type { SourceUpdateProvider } from '../types.js';

export const wdqsFrontendSourceProvider: SourceUpdateProvider = {
	image: 'wdqs-frontend',
	sources: () => [
		{
			variable: 'WDQSQUERYGUI_COMMIT',
			description: 'wikidata/query/gui master',
			resolve: async () => await gerritCommit('wikidata/query/gui', 'master')
		}
	]
};
