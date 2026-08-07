import { describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	wikibaseSourceProvider,
	wikimediaExtensions
} from './providers/wikibase.js';

const WIKIBASE_IMAGE = resolve('images/wikibase');

function sorted(values: Iterable<string>): string[] {
	return [...values].sort();
}

describe('Wikibase source update provider', () => {
	it('covers every automatically updated source in build.env', () => {
		const buildEnvironment = readFileSync(
			resolve(WIKIBASE_IMAGE, 'build.env'),
			'utf8'
		);
		const managedSection = buildEnvironment.split(
			'Versions below are automatically updated by wbs-dev update-sources'
		)[1];
		assert.ok(managedSection, 'build.env must identify its managed sources');

		const managedVariables = [
			...managedSection.matchAll(/^([A-Z0-9_]+_(?:COMMIT|ARCHIVE_SHA))=/gmu)
		].map((match) => match[1]);
		const providerVariables = wikibaseSourceProvider
			.sources(buildEnvironment)
			.flatMap((pin) =>
				pin.archiveShaVariable
					? [pin.variable, pin.archiveShaVariable]
					: [pin.variable]
			);

		assert.deepEqual(sorted(providerVariables), sorted(managedVariables));
		assert.equal(
			new Set(providerVariables).size,
			providerVariables.length,
			'each managed variable must belong to the provider exactly once'
		);
	});

	it('keeps the Wikimedia extension policy aligned with the Dockerfile', () => {
		const dockerfile = readFileSync(
			resolve(WIKIBASE_IMAGE, 'Dockerfile'),
			'utf8'
		);
		const match = /^ARG WMF_EXTENSIONS="([^"]+)"$/mu.exec(dockerfile);
		assert.ok(match, 'Dockerfile must declare WMF_EXTENSIONS');

		assert.deepEqual(
			match[1].split(','),
			wikimediaExtensions.map(([, extension]) => extension)
		);
		for (const [variable] of wikimediaExtensions) {
			assert.match(dockerfile, new RegExp(`^ARG ${variable}$`, 'mu'));
		}
	});
});
