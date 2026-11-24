import type { Command } from 'commander';
import { randomUUID } from 'node:crypto';
import type { RepositoryContext } from '../../lib/context.js';
import { GitRepository } from '../../lib/git.js';
import {
	discoverImageNames,
	discoverReleaseProjects,
	resolveProjectSelections
} from '../../lib/projects.js';
import { buildImages } from '../build/images.js';
import { discoverSuiteNames } from '../test/suites.js';
import { publishImages, requireImages, run } from './images.js';
import { preflightRelease, publishGitTags } from './publication.js';

interface ReleaseOptions {
	preflight?: boolean;
	publish?: boolean;
	registry: string;
	stagingRegistry?: string;
	imageTag?: string;
	platform: string;
}

export async function release(
	requested: string[],
	options: ReleaseOptions,
	bakeArgs: string[],
	context: RepositoryContext
): Promise<void> {
	if (options.preflight && options.publish) {
		throw new Error('Choose either --preflight or --publish.');
	}
	if (bakeArgs.includes('--publish')) {
		throw new Error(
			'Do not pass build --publish: release publishes only after tests pass.'
		);
	}
	if (bakeArgs.length && (options.preflight || options.publish)) {
		throw new Error('Bake options apply only to a full release.');
	}
	if (options.imageTag && !options.publish) {
		throw new Error('--image-tag is only for publishing an existing build.');
	}
	if (options.publish && (!options.stagingRegistry || !options.imageTag)) {
		throw new Error(
			'--publish requires --staging-registry and --image-tag from the passing build.'
		);
	}
	const platforms = [...new Set(options.platform.split(','))];
	if (
		platforms.some(
			(platform) => !['linux/amd64', 'linux/arm64'].includes(platform)
		)
	) {
		throw new Error('--platform supports linux/amd64 and linux/arm64.');
	}
	const projects = discoverReleaseProjects(context);
	const selected = resolveProjectSelections(requested, projects, 'release');
	const git = new GitRepository(context);
	const targets = preflightRelease(git, selected);
	const commit = git.run(['rev-parse', 'HEAD']);
	for (const target of targets) {
		console.log(
			`${target.tag}: ${target.existingCommit ? 'already released; skipping' : 'ready'}`
		);
	}
	if (options.preflight) return;
	const pending = targets.filter((target) => !target.existingCommit);
	if (!pending.length) return;
	const destination = options.registry.replace(/\/+$/u, '');
	const staging = (options.stagingRegistry ?? destination).replace(/\/+$/u, '');
	const imageTag = options.imageTag ?? `release-${randomUUID()}`;
	if (!/^[\w][\w.-]{0,127}$/u.test(imageTag)) {
		throw new Error('Invalid staging image tag.');
	}
	if (!options.publish) {
		console.log(`Building the test stack at ${staging}/<image>:${imageTag}`);
		// Every suite needs its supporting images, even when releasing one image.
		for (const image of discoverImageNames(context)) {
			await buildImages(
				[image],
				[
					...bakeArgs,
					'--push',
					'--provenance=false',
					`--platform=${platforms.join(',')}`,
					'--set',
					`${image}.tags=${staging}/${image}:${imageTag}`
				],
				context
			);
		}
		for (const [index, platform] of platforms.entries()) {
			const suites = index === 0 ? ['all'] : discoverSuiteNames(context);
			run(
				'pnpm',
				['exec', 'tsx', 'wbs-dev.ts', 'test', ...suites, '--skip-build'],
				context.developmentRoot,
				{
					...process.env,
					DOCKER_DEFAULT_PLATFORM: platform,
					WBS_TEST_IMAGE_REGISTRY: staging,
					WBS_TEST_IMAGE_TAG: imageTag,
					WBS_TEST_IMAGE_PULL_POLICY: 'always'
				}
			);
		}
		console.log(
			`Tests passed. Publication can be retried with:\n  wbs-dev release ${selected.map((project) => project.name).join(' ')} --publish --staging-registry ${staging} --image-tag ${imageTag} --registry ${destination}`
		);
	}
	if (
		git.run(['rev-parse', 'HEAD']) !== commit ||
		git.run(['status', '--porcelain'])
	) {
		throw new Error(
			'Release source changed during build/test; start again from a clean commit.'
		);
	}
	// --publish is the CI handoff: its caller must have passed the test gate.
	publishImages(
		pending.filter((target) => target.project.isImage),
		staging,
		imageTag,
		destination,
		context
	);
	if (pending.some((target) => !target.project.isImage)) {
		requireImages(
			projects.filter((project) => project.isImage),
			destination,
			context
		);
	}
	// A failed image publication prevents all new Git tags for this attempt.
	publishGitTags(git, [
		...pending.filter((target) => target.project.isImage),
		...pending.filter((target) => !target.project.isImage)
	]);
}

export function registerReleaseCommand(
	program: Command,
	context: RepositoryContext
): void {
	program
		.command('release')
		.description(
			'Preflight, build, test, publish images, then push Git release tags.'
		)
		.argument('[targets...]', 'Image names, wbs, or all (default).')
		.option(
			'--preflight',
			'Check release readiness without building or publishing.'
		)
		.option(
			'--publish',
			'Publish an existing build after the caller has passed all tests.'
		)
		.option(
			'--registry <namespace>',
			'Destination registry namespace.',
			'wikibase'
		)
		.option(
			'--staging-registry <namespace>',
			'Build storage; defaults to the destination namespace.'
		)
		.option(
			'--image-tag <tag>',
			'Existing tested build tag; required with --publish.'
		)
		.option(
			'--platform <platforms>',
			'Comma-separated platforms to build and test locally.',
			'linux/amd64'
		)
		.addHelpText(
			'after',
			'\nExamples:\n  wbs-dev release wikibase quickstatements --preflight\n  wbs-dev release all --staging-registry ghcr.io/wmde/wikibase\n  wbs-dev release wikibase -- --no-cache --pull\n\nOptions after -- are forwarded to the existing wbs-dev build / Docker Bake wrapper.\nThe release controls build output, image tags, and platforms.\nAll supporting images are built for testing; only selected targets are released.'
		)
		.action(async (args: string[], options: ReleaseOptions) => {
			// Commander includes arguments after -- in the variadic positional list.
			const raw = process.argv;
			const boundary = raw.indexOf('--');
			const forwarded = boundary < 0 ? [] : raw.slice(boundary + 1);
			await release(
				forwarded.length ? args.slice(0, -forwarded.length) : args,
				options,
				forwarded,
				context
			);
		});
}
