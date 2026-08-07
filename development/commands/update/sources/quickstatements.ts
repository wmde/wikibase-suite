import type { SourcePin, SourceUpdateProvider } from '../source-types.js';
import {
	addArchiveChecksums,
	codebergCommit,
	codebergCommitUrl,
	confirmPinPlan,
	describePinChanges,
	githubCommit,
	githubCommitUrl,
	githubCompareUrl,
	planPins
} from '../source-utils.js';

function quickStatementsPins(): SourcePin[] {
	return [
		{
			variable: 'QUICKSTATEMENTS_COMMIT',
			description: 'QuickStatements master',
			resolve: async () =>
				await githubCommit('magnusmanske/quickstatements', 'master'),
			compareUrl: (previous: string, next: string) =>
				githubCompareUrl('magnusmanske/quickstatements', previous, next),
			commitUrl: (commit: string) =>
				githubCommitUrl('magnusmanske/quickstatements', commit)
		},
		{
			variable: 'MAGNUSTOOLS_COMMIT',
			description: 'MagnusTools master',
			resolve: async () =>
				await codebergCommit('magnusmanske/magnustools', 'master'),
			compareUrl: (previous: string, next: string) =>
				`https://codeberg.org/magnusmanske/magnustools/compare/${previous}...${next}`,
			commitUrl: (commit: string) =>
				codebergCommitUrl('magnusmanske/magnustools', commit),
			archiveShaVariable: 'MAGNUSTOOLS_ARCHIVE_SHA',
			archiveUrl: (commit: string) =>
				`https://codeberg.org/magnusmanske/magnustools/archive/${commit}.tar.gz`
		}
	];
}

export const quickStatementsSourceProvider: SourceUpdateProvider = {
	image: 'quickstatements',
	describeChanges: (previousContents, nextContents) =>
		describePinChanges(previousContents, nextContents, quickStatementsPins()),
	plan: async (contents, interaction) => {
		const pins = quickStatementsPins();
		const confirmed = await confirmPinPlan(
			'QuickStatements',
			contents,
			await planPins(contents, pins),
			interaction
		);
		return confirmed.changes.length > 0
			? await addArchiveChecksums(confirmed, pins)
			: confirmed;
	}
};
