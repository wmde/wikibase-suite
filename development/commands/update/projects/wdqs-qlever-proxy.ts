import type { SourceUpdateProvider } from '../source-types.js';
import {
	confirmPinPlan,
	describePinChanges,
	manifestPins,
	planPins
} from '../source-utils.js';

/** Tracks the selected upstream WDQS Proxy branch through its Bake pin. */
export const wdqsQleverProxySourceProvider: SourceUpdateProvider = {
	image: 'wdqs-qlever-proxy',
	describeChanges: ( previousContents, nextContents ) =>
		describePinChanges(
			previousContents,
			nextContents,
			manifestPins( nextContents )
		),
	plan: async ( contents, interaction ) =>
		await confirmPinPlan(
			'WDQS QLever Proxy',
			contents,
			await planPins( contents, manifestPins( contents ) ),
			interaction
		)
};
