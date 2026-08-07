import type { SourcePin, SourceUpdateProvider } from '../source-types.js';
import {
	confirmPinPlan,
	describePinChanges,
	gerritCommit,
	gerritCommitUrl,
	gerritCompareUrl,
	planPins
} from '../source-utils.js';

function wdqsFrontendPins(): SourcePin[] {
	return [
		{
			variable: 'WDQSQUERYGUI_COMMIT',
			description: 'Wikidata Query GUI master',
			resolve: async () => await gerritCommit('wikidata/query/gui', 'master'),
			compareUrl: (previous: string, next: string) =>
				gerritCompareUrl('wikidata/query/gui', previous, next),
			commitUrl: (commit: string) =>
				gerritCommitUrl('wikidata/query/gui', commit)
		}
	];
}

export const wdqsFrontendSourceProvider: SourceUpdateProvider = {
	image: 'wdqs-frontend',
	describeChanges: (previousContents, nextContents) =>
		describePinChanges(previousContents, nextContents, wdqsFrontendPins()),
	plan: async (contents, interaction) =>
		await confirmPinPlan(
			'Query Service frontend',
			contents,
			await planPins(contents, wdqsFrontendPins()),
			interaction
		)
};
