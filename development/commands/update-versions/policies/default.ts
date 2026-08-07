import type { VersionPolicy } from '../../../lib/versioning.js';

export const defaultVersionPolicy: VersionPolicy = {
	isRelevantWorkingChange: () => true,
	additionalUpdates: () => []
};
