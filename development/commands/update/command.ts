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
import { join, relative } from 'node:path';
import semver from 'semver';
import type { RepositoryContext } from '../../lib/context.js';
import { applyFileUpdates, type FileUpdate } from '../../lib/file-updates.js';
import { GitRepository } from '../../lib/git.js';
import {
	discoverReleaseProjects,
	projectVersion,
	resolveProjectSelections,
	type ReleaseProject
} from '../../lib/projects.js';
import { requestTargetNames } from '../../lib/selection.js';
import type { SourceChange } from '../../lib/source-changes.js';
import {
	findPreviousRelease,
	planVersionUpdate,
	type VersionPlan
} from '../../lib/versioning.js';
import { ClackInteraction, UpdateCancelled } from './interaction.js';
import { projectLabel, projectOptionLabel, strong } from './presentation.js';
import {
	planWbsToolsAdoption,
	type WbsToolsAdoption
} from './projects/wbs-tools.js';
import { planWbsUpdate } from './projects/wbs.js';
import type { SourceUpdateProvider } from './source-types.js';
import {
	planSourceFileUpdate,
	sourceUpdateProviderFor,
	type SourceFileUpdate
} from './sources.js';

interface ProjectSourceUpdate {
	fileUpdate: SourceFileUpdate;
	releaseChanges: SourceChange[];
	relativePaths: string[];
}

interface VersionChoice {
	includeChangelog: boolean;
	targetVersion: string;
}

export function imageRelativePath(
	context: Pick<RepositoryContext, 'imagesRoot'>,
	image: string,
	path: string
): string {
	return relative(join(context.imagesRoot, image), path);
}

function unwrapPrompt<T>(value: T | symbol): T {
	if (isCancel(value)) {
		throw new UpdateCancelled();
	}
	return value;
}

function describeSourceUpdate(
	context: RepositoryContext,
	git: GitRepository,
	project: ReleaseProject,
	provider: SourceUpdateProvider,
	fileUpdate: SourceFileUpdate
): ProjectSourceUpdate {
	const relativePath = relative(context.repositoryRoot, fileUpdate.path);
	const previousTag = findPreviousRelease(git, project).tag;
	const releasedContents = previousTag
		? git.run(['show', `${previousTag}:${relativePath}`], {
				allowFailure: true
			})
		: '';
	const baseline = releasedContents || readFileSync(fileUpdate.path, 'utf8');
	const previousAdditionalContents = Object.fromEntries(
		fileUpdate.additionalUpdates.map((update) => {
			const path = relative(context.repositoryRoot, update.path);
			const released = previousTag
				? git.run(['show', `${previousTag}:${path}`], { allowFailure: true })
				: '';
			return [
				imageRelativePath(context, provider.image, update.path),
				released || readFileSync(update.path, 'utf8')
			];
		})
	);
	const nextAdditionalContents = Object.fromEntries(
		fileUpdate.additionalUpdates.map((update) => [
			imageRelativePath(context, provider.image, update.path),
			update.contents
		])
	);
	return {
		fileUpdate,
		releaseChanges: provider.describeChangesWithAdditional
			? provider.describeChangesWithAdditional(
					baseline,
					fileUpdate.contents,
					previousAdditionalContents,
					nextAdditionalContents
				)
			: provider.describeChanges(baseline, fileUpdate.contents),
		relativePaths: [
			relativePath,
			...fileUpdate.additionalUpdates.map((update) =>
				relative(context.repositoryRoot, update.path)
			)
		]
	};
}

function versionValidation(
	minimum: string,
	allowedNoOpVersion?: string
): (value: string | undefined) => string | undefined {
	return (value) => {
		if (!value || !semver.valid(value) || !/^\d+\.\d+\.\d+$/u.test(value)) {
			return 'Enter a stable semantic version such as 8.1.0.';
		}
		if (value !== allowedNoOpVersion && semver.lt(value, minimum)) {
			return `The version must be at least ${minimum}.`;
		}
		return undefined;
	};
}

async function confirmVersion(plan: VersionPlan): Promise<VersionChoice> {
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
		'Changelog draft'
	);
	const includeChangelog = unwrapPrompt(
		await confirm({
			message: 'Use this changelog draft?',
			initialValue: true
		})
	);
	const allowedNoOpVersion =
		!includeChangelog && plan.changelogSections.dependencies.length === 0
			? plan.currentVersion
			: undefined;
	const targetVersion = unwrapPrompt(
		await text({
			message: `Release version (current: ${strong(plan.currentVersion)})`,
			initialValue: plan.targetVersion,
			validate: versionValidation(plan.minimumVersion, allowedNoOpVersion)
		})
	);
	return { includeChangelog, targetVersion };
}

export function isNoOpVersionChoice(
	plan: VersionPlan,
	choice: VersionChoice
): boolean {
	return (
		!choice.includeChangelog &&
		plan.changelogSections.dependencies.length === 0 &&
		choice.targetVersion === plan.currentVersion
	);
}

export function applyVersionChoice(
	plan: VersionPlan,
	choice: VersionChoice
): VersionPlan {
	return choice.includeChangelog
		? plan
		: {
				...plan,
				updates: plan.updates.filter(
					(update) => update.path !== plan.project.changelogPath
				)
			};
}

async function update(
	requested: string[],
	context: RepositoryContext
): Promise<void> {
	const releaseProjects = discoverReleaseProjects(context);
	const requestedProjects = await requestTargetNames(
		requested,
		releaseProjects.map((project) => project.name),
		{
			command: 'update',
			label: projectOptionLabel,
			message: 'Select projects to update',
			noun: 'project'
		}
	);
	if (!requestedProjects) {
		return;
	}
	const projects = resolveProjectSelections(
		requestedProjects,
		releaseProjects,
		'update'
	);
	intro('Prepare Wikibase Suite updates');
	const interaction = new ClackInteraction();
	try {
		const git = new GitRepository(context);
		git.fetchRemoteTags();
		const sourceUpdates: FileUpdate[] = [];
		const versionPlans: VersionPlan[] = [];
		const wbs = releaseProjects.find((project) => project.name === 'wbs')!;
		const selectedWbs = projects.find((project) => project.name === 'wbs');
		const selectedTools = projects.find(
			(project) => project.name === 'wbs-tools'
		);
		for (const project of projects.filter(
			(project) => project.name !== 'wbs'
		)) {
			log.step(strong(projectLabel(project.name)));
			let sourceUpdate: ProjectSourceUpdate | undefined;
			const provider = sourceUpdateProviderFor(project.name);
			if (provider) {
				const fileUpdate = await planSourceFileUpdate(
					context,
					provider,
					interaction
				);
				sourceUpdate = describeSourceUpdate(
					context,
					git,
					project,
					provider,
					fileUpdate
				);
			}
			if (sourceUpdate?.fileUpdate.changes.length) {
				sourceUpdates.push(sourceUpdate.fileUpdate);
				sourceUpdates.push(...sourceUpdate.fileUpdate.additionalUpdates);
			}
			const proposedUpdates = sourceUpdate?.fileUpdate.changes.length
				? [
						sourceUpdate.fileUpdate,
						...sourceUpdate.fileUpdate.additionalUpdates
					]
				: [];
			const options = {
				proposedUpdates,
				sourceChanges: sourceUpdate?.releaseChanges ?? [],
				sourcePaths: sourceUpdate?.relativePaths ?? []
			};
			const proposal = planVersionUpdate(context, git, project, options);
			if (!proposal) {
				log.info('No unreleased code was found.', {
					spacing: provider ? 0 : 1
				});
				continue;
			}
			if (proposal.replacesGeneratedChangelogSections) {
				log.warn(
					'This rerun will replace the generated changelog sections; manual prose outside them will be preserved.'
				);
			}
			const choice = await confirmVersion(proposal);
			if (isNoOpVersionChoice(proposal, choice)) {
				log.info('No release update selected.');
				continue;
			}
			versionPlans.push(
				applyVersionChoice(
					planVersionUpdate(context, git, project, {
						...options,
						targetVersion: choice.targetVersion
					})!,
					choice
				)
			);
		}

		let adoption: WbsToolsAdoption | undefined;
		if (selectedTools) {
			const toolsPlan = versionPlans.find(
				(plan) => plan.project.name === 'wbs-tools'
			);
			adoption = planWbsToolsAdoption(
				wbs,
				selectedTools,
				toolsPlan?.targetVersion ?? projectVersion(selectedTools)
			);
			if (
				adoption &&
				!(await interaction.confirm(
					`Adopt ${strong(adoption.change.next)} in the current ${strong('WBS')} release?`
				))
			) {
				adoption = undefined;
			}
		}

		if (selectedWbs || adoption) {
			log.step(strong(projectLabel('wbs')));
			const wbsOptions = {
				toolsAdoption: adoption
			};
			const proposal = planWbsUpdate(context, git, wbs, wbsOptions);
			if (proposal) {
				const choice = await confirmVersion(proposal);
				if (isNoOpVersionChoice(proposal, choice)) {
					log.info('No release update selected.');
				} else {
					versionPlans.push(
						applyVersionChoice(
							planWbsUpdate(context, git, wbs, {
								...wbsOptions,
								targetVersion: choice.targetVersion
							})!,
							choice
						)
					);
				}
			} else if (adoption) {
				throw new Error(
					'WBS Tools adoption did not produce a WBS release plan.'
				);
			} else {
				log.info('No unreleased code was found.');
			}
		}

		if (versionPlans.length === 0) {
			outro('No updates were selected. No files were changed.');
			return;
		}
		note(
			versionPlans
				.map(
					(plan) =>
						`${strong(projectLabel(plan.project.name))}: ${strong(plan.targetVersion)} (${plan.reason})`
				)
				.join('\n'),
			'Planned release drafts'
		);
		if (
			!unwrapPrompt(
				await confirm({
					message: 'Write these selected release updates as unstaged changes?',
					initialValue: true
				})
			)
		) {
			cancel('No files were changed.');
			return;
		}
		const proposedWrites: FileUpdate[] = [
			...sourceUpdates,
			...versionPlans.flatMap((plan) => plan.updates)
		];
		const updates = [
			...new Map(proposedWrites.map((update) => [update.path, update])).values()
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
		.argument('[projects...]', 'PROJECT...|all')
		.addHelpText(
			'after',
			`\nProjects:\n  ${projectNames.join(', ')}\n  With no project in a terminal, choose interactively. Use "all" to update every project.`
		)
		.action(async (selected: string[]) => await update(selected, context));
}
