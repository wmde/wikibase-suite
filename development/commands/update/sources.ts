import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RepositoryContext } from '../../lib/context.js';
import type { FileUpdate } from '../../lib/file-updates.js';
import type {
	SourceChange,
	SourceUpdateInteraction,
	SourceUpdateProvider
} from './source-types.js';
import { quickStatementsSourceProvider } from './sources/quickstatements.js';
import { wdqsFrontendSourceProvider } from './sources/wdqs-frontend.js';
import { wdqsSourceProvider } from './sources/wdqs.js';
import { wikibaseSourceProvider } from './sources/wikibase.js';

const providers = [
	wikibaseSourceProvider,
	wdqsSourceProvider,
	wdqsFrontendSourceProvider,
	quickStatementsSourceProvider
];

const providersByImage = new Map<string, SourceUpdateProvider>(
	providers.map((provider) => [provider.image, provider])
);

export const sourceUpdateImages = providers.map((provider) => provider.image);

export function sourceUpdateProviderFor(
	image: string
): SourceUpdateProvider | undefined {
	return providersByImage.get(image);
}

export interface PlannedSourceUpdate extends FileUpdate {
	image: string;
	changes: SourceChange[];
}

export async function planSourceUpdate(
	context: RepositoryContext,
	image: string,
	interaction: SourceUpdateInteraction
): Promise<PlannedSourceUpdate> {
	const provider = sourceUpdateProviderFor(image);
	if (!provider) {
		throw new Error(`No source update provider exists for ${image}.`);
	}
	const path = join(context.imagesRoot, image, 'build.env');
	const original = readFileSync(path, 'utf8');
	const plan = await provider.plan(original, interaction);
	return { path, image, contents: plan.contents, changes: plan.changes };
}
