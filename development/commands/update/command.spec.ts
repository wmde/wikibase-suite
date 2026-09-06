import { describe, it } from 'mocha';
import assert from 'node:assert/strict';
import type { VersionPlan } from '../../lib/versioning.js';
import {
	applyVersionChoice,
	imageRelativePath,
	isNoOpVersionChoice
} from './command.js';

describe('update project choices', () => {
	it('keeps additional source paths relative to their image', () => {
		assert.equal(
			imageRelativePath(
				{ imagesRoot: '/repo/development/images' },
				'wikibase',
				'/repo/development/images/wikibase/build/extensions.json'
			),
			'build/extensions.json'
		);
	});

	it('keeps the version update when the generated changelog is rejected', () => {
		const plan = {
			project: {
				name: 'wikibase',
				versionPath: '/repo/docker-bake.hcl',
				changelogPath: '/repo/CHANGELOG.md'
			},
			updates: [
				{ path: '/repo/docker-bake.hcl', contents: 'version = "2.0.0"' },
				{ path: '/repo/CHANGELOG.md', contents: '# 2.0.0' }
			]
		} as VersionPlan;

		const selected = applyVersionChoice(plan, {
			includeChangelog: false,
			targetVersion: '2.0.0'
		});

		assert.deepEqual(
			selected.updates.map((update) => update.path),
			['/repo/docker-bake.hcl']
		);
	});

	it('recognizes retaining the current version without other accepted updates as a no-op', () => {
		const plan = {
			currentVersion: '2.1.1',
			changelogSections: { changes: ['feat: tooling'], dependencies: [] }
		} as VersionPlan;

		assert.equal(
			isNoOpVersionChoice(plan, {
				includeChangelog: false,
				targetVersion: '2.1.1'
			}),
			true
		);
		assert.equal(
			isNoOpVersionChoice(
				{
					...plan,
					changelogSections: {
						changes: [],
						dependencies: ['Query Service: 1.0.0 → 1.0.1']
					}
				},
				{ includeChangelog: false, targetVersion: '2.1.1' }
			),
			false
		);
	});
});
