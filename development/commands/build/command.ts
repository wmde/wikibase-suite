import { Option, type Command } from 'commander';
import { join } from 'node:path';
import { BAKE_MANIFEST, readImageManifest } from '../../lib/bake.js';
import type { RepositoryContext } from '../../lib/context.js';
import { discoverImageNames, discoverReleaseProjects } from '../../lib/projects.js';
import { assertSafeReleaseTags } from '../../lib/release-tags.js';
import { requestTargetNames, resolveNames } from '../../lib/selection.js';
import { assertReleaseVersion } from '../../lib/versioning.js';
import { DEFAULT_BUILD_PARALLELISM, buildImages } from './images.js';

interface ParsedBuildArguments {
	images: string[];
	forwarded: string[];
	parallel: number;
}

function positiveInteger(value: string): number {
	const parsed = Number.parseInt(value, 10);
	if (!/^\d+$/u.test(value) || parsed < 1) {
		throw new Error(
			`--parallel requires a positive integer, received "${value}".`
		);
	}
	return parsed;
}

export function parseBuildArguments(args: string[]): ParsedBuildArguments {
	const images: string[] = [];
	const forwarded: string[] = [];
	let parallel = DEFAULT_BUILD_PARALLELISM;
	let forwarding = false;
	let explicitForwarding = false;

	for (let index = 0; index < args.length; index++) {
		const argument = args[index];
		if (!explicitForwarding && argument === '--parallel') {
			const value = args[++index];
			if (value === undefined) {
				throw new Error('--parallel requires a positive integer.');
			}
			parallel = positiveInteger(value);
			continue;
		}
		if (!explicitForwarding && argument.startsWith('--parallel=')) {
			parallel = positiveInteger(argument.slice('--parallel='.length));
			continue;
		}
		if (argument === '--') {
			forwarding = true;
			explicitForwarding = true;
			continue;
		}
		if (!forwarding && argument.startsWith('-')) {
			forwarding = true;
		}
		if (forwarding) {
			forwarded.push(argument);
		} else {
			images.push(argument);
		}
	}

	return { images, forwarded, parallel };
}

async function runBuild(
	args: string[],
	context: RepositoryContext
): Promise<void> {
	const parsed = parseBuildArguments(args);
	const available = discoverImageNames(context);
	const requested = await requestTargetNames(parsed.images, available, {
		command: 'build',
		message: 'Select images to build',
		noun: 'image'
	});
	if (!requested) {
		return;
	}
	const selected = resolveNames(requested, available, {
		command: 'build',
		noun: 'image'
	});
	if (parsed.forwarded.includes('--publish')) {
		if (requested.length !== 1 || selected.length !== 1) {
			throw new Error(
				'build --publish requires exactly one explicit image project.'
			);
		}
		const manifest = readImageManifest(
			join(context.imagesRoot, selected[0], BAKE_MANIFEST)
		);
		assertReleaseVersion(manifest.version, `${selected[0]} image`);
		const project = discoverReleaseProjects(context).find(
			(candidate) => candidate.name === selected[0]
		)!;
		assertSafeReleaseTags(project);
	}

	await buildImages(selected, parsed.forwarded, context, parsed.parallel);
}

export function registerBuildCommand(
	program: Command,
	context: RepositoryContext
): void {
	const images = discoverImageNames(context);
	program
		.command('build')
		.description('Build all or selected images.')
		.argument('[arguments...]', '[IMAGE...] [docker buildx options...]')
		.allowUnknownOption()
		.allowExcessArguments()
		.passThroughOptions()
		.addOption(
			new Option(
				'--list [format]',
				'List available image targets as text or JSON.'
			).choices(['text', 'json'])
		)
		.addHelpText(
			'after',
			[
				'',
				'Targets:',
				`  ${images.join(', ')}`,
				'  With no target in a terminal, choose interactively. Use "all" to build every image.',
				'',
				'wbs-dev build option:',
				`  --parallel=N  maximum concurrent image builds (default: ${DEFAULT_BUILD_PARALLELISM})`,
				'  Other options after the image list are forwarded to Docker Buildx.',
				'',
				'Examples:',
				'  wbs-dev build --list=json',
				'  wbs-dev build',
				'  wbs-dev build wikibase wdqs --no-cache --pull',
				'  wbs-dev build wikibase wdqs --parallel=2 --dry-run',
				'  wbs-dev build wikibase --publish --dry-run'
			].join('\n')
		)
		.action(
			async (args: string[], options: { list?: true | 'text' | 'json' }) => {
				if (options.list) {
					console.log(
						options.list === 'json' ? JSON.stringify(images) : images.join('\n')
					);
					return;
				}
				await runBuild(args, context);
			}
		);
}
