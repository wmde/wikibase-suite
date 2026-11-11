import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import semver from 'semver';
import { GitRepository } from '../../lib/git.js';
import { projectVersion, type ReleaseProject } from '../../lib/projects.js';
import { assertSafeReleaseTags } from '../../lib/release-tags.js';
import {
	assertReleaseVersion,
	findPreviousRelease,
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
	assertReleaseVersion(version, `${project.name} project`);
	if (semver.prerelease(version)) {
		const latestStable = findPreviousRelease(git, project, '0.0.0').version;
		if (latestStable && semver.lt(version, latestStable)) {
			throw new Error(
				`${project.name} prerelease ${version} must use a base version above stable ${latestStable}.`
			);
		}
	}
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
	return projects.map((project) => {
		const target = readTarget(git, project);
		assertSafeReleaseTags(project);
		return target;
	});
}

export function publishGitTags(
	git: GitRepository,
	targets: ReleaseTarget[],
	dryRun: boolean
): void {
	const head = git.run(['rev-parse', 'HEAD']);
	for (const target of targets) {
		if (target.existingCommit) {
			console.log(
				`Already published: ${target.tag} (${target.existingCommit.slice(0, 12)})`
			);
			continue;
		}
		if (dryRun) {
			console.log(
				`Would create and push ${target.tag} at ${head.slice(0, 12)}.`
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
			// Push separately so GitHub emits a release event for each image tag.
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

export async function dockerHubImageExists(
	image: string,
	version: string
): Promise<boolean> {
	const tokenResponse = await fetch(
		`https://auth.docker.io/token?service=registry.docker.io&scope=repository:wikibase/${encodeURIComponent(image)}:pull`
	);
	if (!tokenResponse.ok) {
		throw new Error(
			`Docker Hub token request failed with HTTP ${tokenResponse.status}.`
		);
	}
	const { token } = (await tokenResponse.json()) as { token: string };
	const response = await fetch(
		`https://registry-1.docker.io/v2/wikibase/${encodeURIComponent(image)}/manifests/${encodeURIComponent(version)}`,
		{
			method: 'HEAD',
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: [
					'application/vnd.oci.image.index.v1+json',
					'application/vnd.docker.distribution.manifest.list.v2+json',
					'application/vnd.docker.distribution.manifest.v2+json'
				].join(', ')
			}
		}
	);
	if (response.status === 404) {
		return false;
	}
	if (!response.ok) {
		throw new Error(
			`Docker Hub manifest check failed with HTTP ${response.status}.`
		);
	}
	return true;
}

export async function requireDockerHubImages(
	projects: ReleaseProject[],
	options: { wait: boolean }
): Promise<void> {
	const timeoutMs = Number.parseInt(
		process.env.WBS_RELEASE_WAIT_TIMEOUT_MS ?? '5400000',
		10
	);
	const intervalMs = Number.parseInt(
		process.env.WBS_RELEASE_WAIT_INTERVAL_MS ?? '15000',
		10
	);
	const deadline = Date.now() + timeoutMs;
	const pending = new Map(
		projects.map((project) => {
			const version = projectVersion(project);
			assertReleaseVersion(version, `${project.name} project`);
			return [project.name, version];
		})
	);
	while (pending.size > 0) {
		for (const [image, version] of pending) {
			if (await dockerHubImageExists(image, version)) {
				console.log(
					`Docker Hub image is available: wikibase/${image}:${version}`
				);
				pending.delete(image);
			}
		}
		if (pending.size === 0) {
			return;
		}
		if (!options.wait || Date.now() >= deadline) {
			throw new Error(
				`Required Docker Hub image${pending.size === 1 ? ' is' : 's are'} unavailable: ` +
					[...pending]
						.map(([image, version]) => `wikibase/${image}:${version}`)
						.join(', ')
			);
		}
		console.log(
			`Waiting for ${pending.size} image release workflow${pending.size === 1 ? '' : 's'}…`
		);
		await delay(intervalMs);
	}
}
