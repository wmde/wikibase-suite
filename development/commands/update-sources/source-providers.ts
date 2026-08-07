import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RepositoryContext } from '../../lib/context.js';
import type { FileUpdate } from '../../lib/file-updates.js';
import { quickStatementsSourceProvider } from './providers/quickstatements.js';
import { wdqsFrontendSourceProvider } from './providers/wdqs-frontend.js';
import { wikibaseSourceProvider } from './providers/wikibase.js';
import { archiveSha256, readVariable, replaceVariable } from './shared.js';
import type { SourceUpdateProvider } from './types.js';

const providers = [
	quickStatementsSourceProvider,
	wdqsFrontendSourceProvider,
	wikibaseSourceProvider
];

const providersByImage = new Map<string, SourceUpdateProvider>(
	providers.map((provider) => [provider.image, provider])
);

export const sourceUpdateImages = providers
	.map((provider) => provider.image)
	.sort();

export async function planSourceUpdate(
	context: RepositoryContext,
	image: string
): Promise<FileUpdate> {
	const provider = providersByImage.get(image);
	if (!provider) {
		throw new Error(`No source update provider exists for ${image}.`);
	}
	const path = join(context.imagesRoot, image, 'build.env');
	const original = readFileSync(path, 'utf8');
	let contents = original;

	console.log(`Checking ${image} upstream sources:`);
	for (const pin of provider.sources(original)) {
		const previous = readVariable(contents, pin.variable);
		const commit = await pin.resolve();
		if (previous === commit) {
			console.log(`  ${pin.variable}: current (${commit})`);
			continue;
		}
		console.log(`  ${pin.variable}: ${previous} -> ${commit}`);
		console.log(`    ${pin.description}`);
		contents = replaceVariable(contents, pin.variable, commit);
		if (pin.archiveShaVariable && pin.archiveUrl) {
			const checksum = await archiveSha256(pin.archiveUrl(commit));
			contents = replaceVariable(contents, pin.archiveShaVariable, checksum);
		}
	}
	if (contents === original) {
		console.log(`  No ${image} source pin updates are available.`);
	}
	return { path, contents };
}
