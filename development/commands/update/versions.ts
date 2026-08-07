import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReleaseProject } from '../../lib/projects.js';
import type { VersionPolicy } from '../../lib/versioning.js';

function deployComposeWithVersion(contents: string, version: string): string {
	const updated = contents.replace(
		/(\bDEPLOY_VERSION:\s*["']?)[^\s"']+(["']?)/u,
		`$1${version}$2`
	);
	if (
		updated === contents &&
		!contents.includes(`DEPLOY_VERSION: "${version}"`)
	) {
		throw new Error('Could not find DEPLOY_VERSION in docker-compose.yml.');
	}
	return updated;
}

export const defaultVersionPolicy: VersionPolicy = {
	isRelevantWorkingChange: () => true,
	additionalUpdates: () => []
};

const wbsVersionPolicy: VersionPolicy = {
	generatedPaths: ({ context }) => [
		join(context.repositoryRoot, 'docker-compose.yml')
	],
	isRelevantWorkingChange: ({ git, path }) => {
		if (path !== 'docker-compose.yml') {
			return true;
		}
		return git
			.run(['diff', '--unified=0', 'HEAD', '--', path])
			.split('\n')
			.filter((line) => /^[+-]/u.test(line))
			.filter((line) => !line.startsWith('+++') && !line.startsWith('---'))
			.some((line) => !line.includes('DEPLOY_VERSION'));
	},
	additionalUpdates: ({ context, targetVersion }) => {
		const path = join(context.repositoryRoot, 'docker-compose.yml');
		return [
			{
				path,
				contents: deployComposeWithVersion(
					readFileSync(path, 'utf8'),
					targetVersion
				)
			}
		];
	}
};

export function versionPolicyFor(project: ReleaseProject): VersionPolicy {
	return project.name === 'wbs' ? wbsVersionPolicy : defaultVersionPolicy;
}
