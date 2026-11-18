import { spawnSync } from 'node:child_process';
import type { RepositoryContext } from '../../lib/context.js';
import { projectVersion, type ReleaseProject } from '../../lib/projects.js';
import type { ReleaseTarget } from './publication.js';

export function run(
	command: string,
	args: string[],
	cwd: string,
	env = process.env
): void {
	const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(`${command} failed (${result.signal ?? result.status}).`);
}

function docker(
	args: string[],
	context: RepositoryContext,
	env = process.env
): string {
	const result = spawnSync('docker', args, {
		cwd: context.repositoryRoot,
		env,
		encoding: 'utf8'
	});
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(result.stderr || `docker ${args.join(' ')} failed.`);
	return result.stdout.trim();
}

function digest(
	reference: string,
	context: RepositoryContext,
	optional = false
): string | undefined {
	let output: string;
	try {
		output = docker(
			[
				'buildx',
				'imagetools',
				'inspect',
				reference,
				'--format',
				'{{json .Manifest}}'
			],
			context
		);
	} catch (error) {
		if (
			optional &&
			/manifest unknown|not found|no such manifest/iu.test(String(error))
		)
			return undefined;
		throw error;
	}
	const value = (JSON.parse(output) as { digest: string }).digest;
	if (!/^sha256:[a-f0-9]{64}$/u.test(value))
		throw new Error(`Invalid image digest for ${reference}.`);
	return value;
}

export function publishImages(
	targets: ReleaseTarget[],
	staging: string,
	imageTag: string,
	destination: string,
	context: RepositoryContext
): void {
	// Resolve every source and check every destination before writing any release tags.
	const images = targets.map(({ project }) => {
		const name = project.name;
		const repository = `${destination}/${name}`;
		const version = projectVersion(project);
		const full = `${repository}:${version}`;
		const definition = JSON.parse(
			docker(
				[
					'buildx',
					'bake',
					'--file',
					project.versionPath,
					'--print',
					`${name}-release`
				],
				context,
				{ ...process.env, IMAGE_REPOSITORY: repository }
			)
		) as {
			target: Record<string, { tags: string[] }>;
		};
		const tags = definition.target[`${name}-release`].tags;
		if (!tags.includes(full))
			throw new Error(`Bake release tags must include ${full}.`);
		const sourceDigest = digest(`${staging}/${name}:${imageTag}`, context)!;
		const existing = digest(full, context, true);
		if (existing && existing !== sourceDigest)
			throw new Error(`Refusing to replace ${full} with different contents.`);
		return {
			full,
			tags,
			sourceDigest,
			source: `${staging}/${name}@${sourceDigest}`,
			existing
		};
	});
	for (const image of images) {
		if (image.existing) {
			console.log(
				`${image.full} is already published; leaving its aliases unchanged.`
			);
			continue;
		}
		// Write the full version last: its presence means all aliases were published.
		const aliases = image.tags.filter((tag) => tag !== image.full);
		for (const tags of [aliases, [image.full]]) {
			if (!tags.length) continue;
			run(
				'docker',
				[
					'buildx',
					'imagetools',
					'create',
					'--prefer-index=false',
					...tags.flatMap((tag) => ['--tag', tag]),
					image.source
				],
				context.repositoryRoot
			);
		}
		if (digest(image.full, context) !== image.sourceDigest) {
			throw new Error(
				`Published digest does not match the tested image: ${image.full}.`
			);
		}
	}
}

export function requireImages(
	projects: ReleaseProject[],
	registry: string,
	context: RepositoryContext
): void {
	for (const project of projects) {
		digest(`${registry}/${project.name}:${projectVersion(project)}`, context);
	}
}
