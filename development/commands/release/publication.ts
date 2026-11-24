import { readFileSync } from 'node:fs';
import { GitRepository } from '../../lib/git.js';
import { projectVersion, type ReleaseProject } from '../../lib/projects.js';
import {
	assertStableVersion,
	hasChangelogVersion
} from '../../lib/versioning.js';

export interface ReleaseTarget {
	project: ReleaseProject;
	tag: string;
	existingCommit?: string;
}

function readTarget(
	git: GitRepository,
	project: ReleaseProject
): ReleaseTarget {
	const version = projectVersion(project);
	assertStableVersion(version, `${project.name} project`);
	if (
		!hasChangelogVersion(readFileSync(project.changelogPath, 'utf8'), version)
	) {
		throw new Error(
			`${project.name} changelog has no entry for version ${version}.`
		);
	}
	const tag = `${project.name}@${version}`;
	return {
		project,
		tag,
		existingCommit: git.remoteTagCommit(tag)
	};
}

export function preflightRelease(
	git: GitRepository,
	projects: ReleaseProject[]
): ReleaseTarget[] {
	if (git.run(['status', '--porcelain'])) {
		throw new Error('Release requires a clean working tree.');
	}
	git.fetchRemoteTags();
	if (
		!git.run(['branch', '-r', '--contains', 'HEAD'], { allowFailure: true })
	) {
		throw new Error('Release requires HEAD to exist on a remote branch.');
	}
	return projects.map((project) => readTarget(git, project));
}

export function publishGitTags(
	git: GitRepository,
	targets: ReleaseTarget[]
): void {
	const head = git.run(['rev-parse', 'HEAD']);
	for (const target of targets) {
		if (target.existingCommit) {
			console.log(
				`Already published: ${target.tag} (${target.existingCommit.slice(0, 12)})`
			);
			continue;
		}
		const localCommit = git.run(
			['rev-parse', '--verify', `refs/tags/${target.tag}^{commit}`],
			{ allowFailure: true }
		);
		if (localCommit && localCommit !== head) {
			git.run(['tag', '--delete', target.tag]);
		}
		if (localCommit !== head) {
			git.run(['tag', target.tag, 'HEAD']);
		}
		try {
			// Tags record completed publication; image builds are never triggered by tags.
			git.run([
				'push',
				'origin',
				`refs/tags/${target.tag}:refs/tags/${target.tag}`
			]);
		} catch (error) {
			throw new Error(
				`Created local tag ${target.tag}, but could not push it: ${String(error)}`,
				{ cause: error }
			);
		}
		console.log(`Published Git tag ${target.tag}.`);
	}
}
