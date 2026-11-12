import { describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { createRepositoryContext } from './context.js';
import { discoverReleaseProjects, projectVersion } from './projects.js';
import { assertSafeReleaseTags, imageReleaseTags } from './release-tags.js';
import { isReleaseVersion } from './versioning.js';

describe('image release tag policy', () => {
	it('accepts stable and numbered prerelease versions only', () => {
		assert.equal(isReleaseVersion('8.1.0'), true);
		assert.equal(isReleaseVersion('8.1.0-rc.1'), true);
		assert.equal(isReleaseVersion('8.1.0-rc'), false);
		assert.equal(isReleaseVersion('8.1.0-rc.beta'), false);
		assert.equal(isReleaseVersion('8.1.0-rc.01'), false);
	});

	const projects = discoverReleaseProjects(createRepositoryContext(process.cwd()))
		.filter((project) => project.isImage);

	for (const project of projects) {
		it(`keeps ${project.name} stable aliases off prereleases`, () => {
			const stableVersion = projectVersion(project);
			const stableTags = imageReleaseTags(project);
			const [major, minor] = stableVersion.split('.');
			assert.ok(
				stableTags.includes(`wikibase/${project.name}:${stableVersion}`)
			);
			assert.ok(stableTags.includes(`wikibase/${project.name}:${major}`));
			assert.ok(stableTags.includes(`wikibase/${project.name}:${major}.${minor}`));
			assert.equal(
				stableTags.length,
				['wbs-tools', 'wdqs-frontend'].includes(project.name) ? 3 : 4
			);

			const prereleaseVersion = '9.9.9-rc.1';
			assert.deepEqual(imageReleaseTags(project, prereleaseVersion), [
				`wikibase/${project.name}:${prereleaseVersion}`
			]);
			assert.doesNotThrow(() =>
				assertSafeReleaseTags(project, prereleaseVersion)
			);
		});
	}
});
