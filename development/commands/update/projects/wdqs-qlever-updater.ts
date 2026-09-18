import type { SourceUpdateProvider } from '../source-types.js';
import {
	confirmPinPlan,
	describePinChanges,
	manifestPins,
	planPins
} from '../source-utils.js';

/** Tracks the Foundation Munger revision used by the Java updater. */
export const wdqsQleverUpdaterSourceProvider: SourceUpdateProvider = {
	image: 'wdqs-qlever-updater',
	describeChanges: ( previousContents, nextContents ) =>
		describePinChanges(
			previousContents,
			nextContents,
			manifestPins( nextContents )
		),
	plan: async ( contents, interaction ) =>
		await confirmPinPlan(
			'WDQS QLever Updater Munger',
			contents,
			await planPins( contents, manifestPins( contents ) ),
			interaction
		)
};
