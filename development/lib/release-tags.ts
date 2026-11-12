import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import semver from 'semver';
import { projectVersion, type ReleaseProject } from './projects.js';

export function imageReleaseTags(
	project: ReleaseProject,
	version = projectVersion(project)
): string[] {
	if (!project.isImage) {
		throw new Error(`${project.name} is not an image project.`);
	}
	const repository = `wikibase/${project.name}`;
	const target = `${project.name}-release`;
	const bake = JSON.parse(
		execFileSync(
			'docker',
			['buildx', 'bake', '--file', project.versionPath, '--print', target],
			{
				cwd: dirname(project.versionPath),
				encoding: 'utf8',
				env: {
					...process.env,
					IMAGE_VERSION: version,
					IMAGE_REPOSITORY: repository
				}
			}
		)
	) as { target?: Record<string, { tags?: string[] }> };
	const tags = bake.target?.[target]?.tags;
	if (!Array.isArray(tags)) {
		throw new Error(`${target} has no release tags.`);
	}
	return tags;
}

export function assertSafeReleaseTags(
	project: ReleaseProject,
	version = projectVersion(project)
): void {
	if (!project.isImage) {
		return;
	}
	const tags = imageReleaseTags(project, version);
	const repository = `wikibase/${project.name}`;
	const target = `${project.name}-release`;
	const exact = `${repository}:${version}`;
	if (!tags.includes(exact)) {
		throw new Error(`${target} must publish its full version tag ${exact}.`);
	}
	const channel = semver.prerelease(version)?.[0];
	if (!channel) {
		return;
	}
	const allowed = new Set([
		exact,
		`${repository}:${semver.major(version)}-${channel}`,
		`${repository}:${semver.major(version)}.${semver.minor(version)}-${channel}`
	]);
	const unsafe = tags.filter((tag) => !allowed.has(tag));
	if (unsafe.length > 0) {
		throw new Error(
			`${target} prerelease would move tags outside its channel: ${unsafe.join(', ')}.`
		);
	}
}
