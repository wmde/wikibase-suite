import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'mocha';
import type { RepositoryContext } from './context.js';
import { discoverImageNames } from './projects.js';

const temporaryRoots: string[] = [];

function fixtureContext(): RepositoryContext {
	const root = mkdtempSync(join(tmpdir(), 'wbs-projects-'));
	temporaryRoots.push(root);
	const imagesRoot = join(root, 'images');
	mkdirSync(imagesRoot);
	return {
		developmentRoot: root,
		repositoryRoot: root,
		hostRepositoryRoot: root,
		imagesRoot,
		testRoot: join(root, 'tests')
	};
}

afterEach(() => {
	while (temporaryRoots.length > 0) {
		rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
	}
});

describe('image project discovery', () => {
	it('returns only image directories with a Bake manifest', () => {
		const context = fixtureContext();
		mkdirSync(join(context.imagesRoot, 'wikibase'));
		writeFileSync(join(context.imagesRoot, 'wikibase', 'docker-bake.hcl'), '');
		mkdirSync(join(context.imagesRoot, 'leftover-directory'));
		mkdirSync(join(context.imagesRoot, 'node_modules'));

		assert.deepEqual(discoverImageNames(context), ['wikibase']);
	});
});
