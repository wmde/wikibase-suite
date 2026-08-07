import {
	cancel,
	confirm,
	intro,
	isCancel,
	log,
	note,
	outro,
	text
} from '@clack/prompts';
import type { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import semver from 'semver';
import type { RepositoryContext } from '../../lib/context.js';
import { applyFileUpdates, type FileUpdate } from '../../lib/file-updates.js';
import { GitRepository } from '../../lib/git.js';
import {
	discoverReleaseProjects,
	resolveProjectSelections,
	type ReleaseProject
} from '../../lib/projects.js';
import type { SourceChange } from '../../lib/source-changes.js';
import {
	findPreviousRelease,
	planVersionUpdate,
	type VersionPlan
} from '../../lib/versioning.js';
import { ClackInteraction, UpdateCancelled } from './interaction.js';
import {
	planSourceUpdate,
	sourceUpdateProviderFor,
	type PlannedSourceUpdate
} from './sources.js';
import { versionPolicyFor } from './versions.js';

interface ProjectSources {
	plan?: PlannedSourceUpdate;
	changes: SourceChange[];
	path?: string;
}

function unwrapPrompt<T>(value: T | symbol): T {
	if (isCancel(value)) {
		throw new UpdateCancelled();
	}
	return value;
}

function sourceState(
	context: RepositoryContext,
	git: GitRepository,
	project: ReleaseProject,
	plan: PlannedSourceUpdate
): ProjectSources {
	const provider = sourceUpdateProviderFor(project.name)!;
	const path = relative(context.repositoryRoot, plan.path);
	const previousTag = findPreviousRelease(git, project).tag;
	const releasedContents = previousTag
		? git.run(['show', `${previousTag}:${path}`], { allowFailure: true })
		: '';
	const baseline = releasedContents || readFileSync(plan.path, 'utf8');
	return {
		plan,
		changes: provider.describeChanges(baseline, plan.contents),
		path
	};
}

function versionValidation(
	minimum: string
): (value: string | undefined) => string | undefined {
	return (value) => {
		if (!value || !semver.valid(value) || !/^\d+\.\d+\.\d+$/u.test(value)) {
			return 'Enter a stable semantic version such as 8.1.0.';
		}
		if (semver.lt(value, minimum)) {
			return `The version must be at least ${minimum}.`;
		}
		return undefined;
	};
}

async function confirmVersion(
	project: ReleaseProject,
	plan: VersionPlan
): Promise<string> {
	note(
		[
			...(plan.changelogSections.changes.length > 0
				? [
						'Changes:',
						...plan.changelogSections.changes.map((entry) => `  - ${entry}`)
					]
				: []),
			...(plan.changelogSections.dependencies.length > 0
				? [
						'Dependency updates:',
						...plan.changelogSections.dependencies.map(
							(entry) => `  - ${entry}`
						)
					]
				: [])
		].join('\n') || 'No generated changelog entries.',
		`${project.name} changelog draft`
	);
	return unwrapPrompt(
		await text({
			message: `Version for ${project.name}`,
			initialValue: plan.targetVersion,
			validate: versionValidation(plan.minimumVersion)
		})
	);
}

async function update(
	requested: string[],
	context: RepositoryContext
): Promise<void> {
	const projects = resolveProjectSelections(
		requested,
		discoverReleaseProjects(context),
		'update',
		{ requireExplicit: true }
	);
	intro('Prepare Wikibase Suite updates');
	const interaction = new ClackInteraction();
	try {
		const git = new GitRepository(context);
		git.fetchRemoteTags();
		const sources = new Map<string, ProjectSources>();
		for (const project of projects) {
			if (!sourceUpdateProviderFor(project.name)) {
				sources.set(project.name, { changes: [] });
				continue;
			}
			const sourcePlan = await planSourceUpdate(
				context,
				project.name,
				interaction
			);
			sources.set(project.name, sourceState(context, git, project, sourcePlan));
		}

		const versionPlans: VersionPlan[] = [];
		for (const project of projects) {
			const source = sources.get(project.name)!;
			const proposedUpdates = source.plan?.changes.length ? [source.plan] : [];
			const options = {
				proposedUpdates,
				sourceChanges: source.changes,
				sourcePaths: source.path ? [source.path] : []
			};
			const proposal = planVersionUpdate(
				context,
				git,
				project,
				versionPolicyFor(project),
				options
			);
			if (!proposal) {
				log.info(`${project.name} has no releasable changes.`);
				continue;
			}
			if (proposal.replacesGeneratedChangelogSections) {
				log.warn(
					`${project.name}: this rerun will replace the generated changelog sections; manual prose outside them will be preserved.`
				);
			}
			const targetVersion = await confirmVersion(project, proposal);
			versionPlans.push(
				planVersionUpdate(context, git, project, versionPolicyFor(project), {
					...options,
					targetVersion
				})!
			);
		}

		if (versionPlans.length === 0) {
			outro('No updates were selected. No files were changed.');
			return;
		}
		const sourceUpdates = [...sources.values()]
			.map(({ plan }) => plan)
			.filter(
				(plan): plan is PlannedSourceUpdate =>
					plan !== undefined && plan.changes.length > 0
			);
		note(
			versionPlans
				.map(
					(plan) =>
						`${plan.project.name}: ${plan.targetVersion} (${plan.reason})`
				)
				.join('\n'),
			'Planned release drafts'
		);
		if (
			!unwrapPrompt(
				await confirm({
					message:
						'Write these source, version, and changelog updates as unstaged changes?',
					initialValue: true
				})
			)
		) {
			cancel('No files were changed.');
			return;
		}
		const updates: FileUpdate[] = [
			...sourceUpdates,
			...versionPlans.flatMap((plan) => plan.updates)
		];
		applyFileUpdates(updates);
		outro(
			'Prepared updates. Nothing was staged or committed. Review with git diff.'
		);
	} catch (error) {
		if (error instanceof UpdateCancelled) {
			cancel('No files were changed.');
			return;
		}
		throw error;
	}
}

export function registerUpdateCommand(
	program: Command,
	context: RepositoryContext
): void {
	const projectNames = discoverReleaseProjects(context).map(({ name }) => name);
	program
		.command('update')
		.description(
			'Interactively prepare upstream sources, versions, and changelogs atomically.'
		)
		.argument('<projects...>', 'PROJECT...|all')
		.addHelpText(
			'after',
			`\nProjects:\n  ${projectNames.join(', ')}\n  Select one or more projects, or "all" by itself.`
		)
		.action(async (selected: string[]) => await update(selected, context));
}
