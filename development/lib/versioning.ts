import { CommitParser } from 'conventional-commits-parser';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import semver from 'semver';
import type { RepositoryContext } from './context.js';
import type { FileUpdate } from './file-updates.js';
import { GitRepository } from './git.js';
import {
	projectVersion,
	projectWithVersion,
	type ReleaseProject
} from './projects.js';
import type { SourceChange } from './source-changes.js';

type Bump = 'major' | 'minor' | 'patch';

interface CommitRecord {
	subject: string;
	bump?: Bump;
	includeInChangelog: boolean;
}

const STABLE_VERSION = /^\d+\.\d+\.\d+$/u;

export function assertStableVersion(version: string, context: string): void {
	if (!STABLE_VERSION.test(version) || !semver.valid(version)) {
		throw new Error(
			`${context} must use a stable MAJOR.MINOR.PATCH version; received "${version}".`
		);
	}
}

export interface VersionPlan {
	project: ReleaseProject;
	currentVersion: string;
	targetVersion: string;
	updates: FileUpdate[];
	reason: string;
	minimumVersion: string;
	changelogSections: {
		changes: string[];
		dependencies: string[];
	};
	replacesGeneratedChangelogSections: boolean;
}

export interface VersionPlanOptions {
	date?: string;
	proposedUpdates?: FileUpdate[];
	sourceChanges?: SourceChange[];
	sourcePaths?: string[];
	targetVersion?: string;
}

interface ChangelogHeading {
	start: number;
	end: number;
	version: string;
	prefix: string;
	suffix: string;
}

const parser = new CommitParser();
function bumpRank(bump: Bump): number {
	return { patch: 1, minor: 2, major: 3 }[bump];
}

function classifyCommit(message: string): Bump | undefined {
	const parsed = parser.parse(message);
	if (
		parsed.notes.some((note) => note.title.toLowerCase().includes('breaking'))
	) {
		return 'major';
	}
	if (parsed.header && /^[^:(!]+(?:\([^)]*\))?!:/u.test(parsed.header)) {
		return 'major';
	}
	if (parsed.type === 'feat') {
		return 'minor';
	}
	if (parsed.type === 'fix' || parsed.type === 'perf') {
		return 'patch';
	}
	return undefined;
}

function readCommits(
	git: GitRepository,
	project: ReleaseProject,
	previousTag: string | undefined,
	generatedPaths: Set<string>,
	sourcePaths: Set<string>
): CommitRecord[] {
	const range = previousTag ? `${previousTag}..HEAD` : 'HEAD';
	const output = git.run([
		'log',
		'--format=%H%x1f%B%x1e',
		range,
		'--',
		...project.pathspecs
	]);
	return output
		.split('\x1e')
		.map((record) => record.trim())
		.filter(Boolean)
		.map((record): CommitRecord | undefined => {
			const [commit, ...messageParts] = record.split('\x1f');
			const message = messageParts.join('\x1f').trim();
			const paths = git
				.run([
					'diff-tree',
					'--root',
					'--no-commit-id',
					'--name-only',
					'-r',
					commit,
					'--',
					...project.pathspecs
				])
				.split('\n')
				.filter(Boolean)
				.filter((path) => !generatedPaths.has(path));
			if (paths.length === 0) {
				return undefined;
			}
			return {
				subject: message.split('\n')[0],
				bump: classifyCommit(message),
				includeInChangelog: !paths.every((path) => sourcePaths.has(path))
			};
		})
		.filter((record): record is CommitRecord => record !== undefined);
}

export function findPreviousRelease(
	git: GitRepository,
	project: ReleaseProject
): {
	tag?: string;
	version?: string;
} {
	const tagNames = [project.name, ...project.legacyTagNames];
	const candidates = [...git.remoteTags().keys()]
		.filter((tag) => tagNames.some((name) => tag.startsWith(`${name}@`)))
		.map((tag) => ({
			tag,
			version: tag.slice(tag.lastIndexOf('@') + 1)
		}))
		.filter((candidate) => semver.valid(candidate.version))
		.sort((left, right) => semver.rcompare(left.version, right.version));
	return candidates[0] ?? {};
}

function hasRelevantWorkingChanges(
	git: GitRepository,
	context: RepositoryContext,
	project: ReleaseProject,
	proposedUpdates: FileUpdate[]
): boolean {
	const proposedByPath = new Map(
		proposedUpdates.map((update) => [
			relative(context.repositoryRoot, update.path),
			update.contents
		])
	);
	const changed = new Set([
		...git
			.run(['diff', '--name-only', 'HEAD', '--', ...project.pathspecs])
			.split('\n')
			.filter(Boolean),
		...proposedByPath.keys()
	]);
	const generated = new Set(
		[project.changelogPath].map((path) =>
			relative(context.repositoryRoot, path)
		)
	);
	return [...changed].some((path) => {
		if (generated.has(path)) {
			return false;
		}
		if (path === relative(context.repositoryRoot, project.versionPath)) {
			const committed = git.run(['show', `HEAD:${path}`], {
				allowFailure: true
			});
			if (!committed) {
				return true;
			}
			const candidate =
				proposedByPath.get(path) ?? readFileSync(project.versionPath, 'utf8');
			const committedVersion = projectVersion(project, committed);
			return (
				projectWithVersion(project, candidate, committedVersion).trimEnd() !==
				committed.trimEnd()
			);
		}
		return true;
	});
}

function parseHeadings(changelog: string): ChangelogHeading[] {
	const pattern =
		/^(#{1,6}[ \t]+)(?:\*\*)?(?:[^\s@]+@)?(Unreleased|\d+\.\d+\.\d+)(?:\*\*)?([ \t]*(?:\([^\n)]*\))?[^\n]*)$/gimu;
	const headings: ChangelogHeading[] = [];
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(changelog)) !== null) {
		headings.push({
			start: match.index,
			end: match.index + match[0].length,
			prefix: match[1],
			version: match[2],
			suffix: match[3]
		});
	}
	return headings;
}

export function hasChangelogVersion(
	changelog: string,
	version: string
): boolean {
	return parseHeadings(changelog).some(
		(heading) => heading.version === version
	);
}

function findDraftHeadings(
	headings: ChangelogHeading[],
	publishedVersions: Set<string>
): ChangelogHeading[] {
	const firstPublishedIndex = headings.findIndex(
		(heading) =>
			heading.version !== 'Unreleased' && publishedVersions.has(heading.version)
	);
	return headings
		.slice(
			0,
			firstPublishedIndex === -1 ? headings.length : firstPublishedIndex
		)
		.filter(
			(heading) =>
				heading.version === 'Unreleased' ||
				!publishedVersions.has(heading.version)
		);
}

function isCommitPin(change: SourceChange): boolean {
	return change.variable.endsWith('_COMMIT') ||
		change.variable.endsWith('.commit');
}

function visibleSourceRange(
	change: SourceChange
): { previous: string; next: string } | undefined {
	if (!change.previous) {
		return undefined;
	}
	if (!isCommitPin(change)) {
		return { previous: change.previous, next: change.next };
	}
	if (change.link) {
		return undefined;
	}
	return {
		previous: change.previous.slice(0, 12),
		next: change.next.slice(0, 12)
	};
}

function dependencyChangelogEntry(change: SourceChange): string {
	if (!change.previous) {
		const source = change.link
			? `[${change.link.label}](${change.link.url})`
			: isCommitPin(change)
				? `commit \`${change.next.slice(0, 12)}\``
				: change.next;
		return `Added ${change.description} at ${source}.`;
	}
	const range = visibleSourceRange(change);
	const values = range
		? isCommitPin(change)
			? ` from \`${range.previous}\` to \`${range.next}\``
			: ` from ${range.previous} to ${range.next}`
		: '';
	const link = change.link
		? ` ([${change.link.label}](${change.link.url}))`
		: '';
	return `${change.description}${values}${link}.`;
}

function dependencyPreviewEntry(change: SourceChange): string {
	if (!change.previous) {
		const link = change.link
			? ` (${change.link.label}: ${change.link.url})`
			: '';
		return `Added ${change.description}${link}`;
	}
	const range = visibleSourceRange(change);
	const values = range ? `: ${range.previous} → ${range.next}` : '';
	const link = change.link ? ` (${change.link.label}: ${change.link.url})` : '';
	return `${change.description}${values}${link}`;
}

function updateChangelog(
	project: ReleaseProject,
	changelog: string,
	targetVersion: string,
	publishedVersions: Set<string>,
	commits: CommitRecord[],
	sourceChanges: SourceChange[],
	date: string
): string {
	const headings = parseHeadings(changelog);
	const draftHeadings = findDraftHeadings(headings, publishedVersions);
	if (draftHeadings.length > 1) {
		throw new Error(
			`${project.name} changelog contains multiple untagged release entries.`
		);
	}
	const dependencies = sourceChanges.map(dependencyChangelogEntry);
	const changes = commits
		.filter((commit) => commit.bump && commit.includeInChangelog)
		.map((commit) => commit.subject);
	const generatedSections = [
		...(changes.length > 0
			? [`## Changes\n\n${changes.map((entry) => `- ${entry}`).join('\n')}`]
			: []),
		...(dependencies.length > 0
			? [
					`## Dependency updates\n\n${dependencies.map((entry) => `- ${entry}`).join('\n')}`
				]
			: [])
	];
	const updateGeneratedSections = (body: string): string => {
		const names = ['Changes', 'Dependency updates'];
		const headings = [...body.matchAll(/^(#{1,2})[ \t]+(.+?)[ \t]*$/gmu)].map(
			(match) => ({
				start: match.index,
				level: match[1].length,
				name: match[2]
			})
		);
		const ranges: { start: number; end: number }[] = [];
		for (const name of names) {
			const matches = headings.filter(
				(heading) => heading.level === 2 && heading.name === name
			);
			if (matches.length > 1) {
				throw new Error(
					`${project.name} changelog contains multiple "${name}" sections in its draft.`
				);
			}
			if (matches.length === 1) {
				const heading = matches[0];
				const next = headings.find(
					(candidate) => candidate.start > heading.start
				);
				ranges.push({ start: heading.start, end: next?.start ?? body.length });
			}
		}
		let preserved = body;
		for (const range of ranges.sort(
			(left, right) => right.start - left.start
		)) {
			preserved = preserved.slice(0, range.start) + preserved.slice(range.end);
		}
		const pieces = [preserved.trim(), ...generatedSections].filter(Boolean);
		return pieces.length > 0
			? `\n\n${pieces.join('\n\n')}\n\n`
			: '\n\n- Release changes to be documented.\n\n';
	};
	if (draftHeadings.length === 0) {
		const newEntryHeading = `# ${targetVersion} (${date})`;
		const firstContent = changelog.search(/\S/u);
		const normalizedChangelog =
			firstContent === -1 ? '' : changelog.slice(firstContent);
		return `${newEntryHeading}${updateGeneratedSections('')}${normalizedChangelog}`;
	}
	const draft = draftHeadings[0];
	const nextHeading = headings.find((heading) => heading.start > draft.start);
	const bodyEnd = nextHeading ? nextHeading.start : changelog.length;
	const body = changelog.slice(draft.end, bodyEnd);
	const draftHeading =
		draft.version === targetVersion
			? changelog.slice(draft.start, draft.end)
			: `# ${targetVersion} (${date})`;
	return (
		changelog.slice(0, draft.start) +
		draftHeading +
		updateGeneratedSections(body) +
		changelog.slice(bodyEnd)
	);
}

export function planVersionUpdate(
	context: RepositoryContext,
	git: GitRepository,
	project: ReleaseProject,
	options: VersionPlanOptions = {}
): VersionPlan | undefined {
	const date = options.date ?? new Date().toISOString().slice(0, 10);
	const proposedUpdates = options.proposedUpdates ?? [];
	const sourcePaths = new Set(options.sourcePaths ?? []);
	const generatedPaths = new Set(
		[project.versionPath, project.changelogPath].map((path) =>
			relative(context.repositoryRoot, path)
		)
	);
	const versionContents =
		proposedUpdates.find((update) => update.path === project.versionPath)
			?.contents ?? readFileSync(project.versionPath, 'utf8');
	const currentVersion = projectVersion(project, versionContents);
	assertStableVersion(currentVersion, `${project.name} project`);
	const previous = findPreviousRelease(git, project);
	const commits = readCommits(
		git,
		project,
		previous.tag,
		generatedPaths,
		sourcePaths
	);
	const bumps = commits.map((commit) => commit.bump).filter(Boolean) as Bump[];
	if ((options.sourceChanges?.length ?? 0) > 0) {
		bumps.push('patch');
	}
	if (hasRelevantWorkingChanges(git, context, project, proposedUpdates)) {
		bumps.push('patch');
	}
	const bump = bumps.sort((left, right) => bumpRank(right) - bumpRank(left))[0];
	let inferred = previous.version;
	if (bump && previous.version) {
		inferred = semver.inc(previous.version, bump) ?? undefined;
	}
	const changelog = readFileSync(project.changelogPath, 'utf8');
	const publishedVersions = new Set(
		[...git.remoteTags().keys()]
			.filter((tag) =>
				[project.name, ...project.legacyTagNames].some((name) =>
					tag.startsWith(`${name}@`)
				)
			)
			.map((tag) => tag.slice(tag.lastIndexOf('@') + 1))
	);
	const changelogHeadings = parseHeadings(changelog);
	const draftHeadings = findDraftHeadings(changelogHeadings, publishedVersions);
	const draftBody =
		draftHeadings.length === 1
			? changelog.slice(
					draftHeadings[0].end,
					changelogHeadings.find(
						(heading) => heading.start > draftHeadings[0].start
					)?.start ?? changelog.length
				)
			: '';
	const replacesGeneratedChangelogSections =
		/^##[ \t]+(?:Changes|Dependency updates)[ \t]*$/mu.test(draftBody);
	const minimumVersion = [currentVersion, inferred]
		.filter(Boolean)
		.sort((left, right) => semver.rcompare(left!, right!))[0]!;
	const targetVersion = options.targetVersion ?? minimumVersion;
	assertStableVersion(targetVersion, `${project.name} release`);
	if (semver.lt(targetVersion, minimumVersion)) {
		throw new Error(
			`${project.name} release must be at least ${minimumVersion}; received ${targetVersion}.`
		);
	}
	const updates: FileUpdate[] = [
		...proposedUpdates.filter(
			(update) =>
				update.path !== project.versionPath &&
				update.path !== project.changelogPath
		),
		{
			path: project.versionPath,
			contents: projectWithVersion(project, versionContents, targetVersion)
		},
		{
			path: project.changelogPath,
			contents: updateChangelog(
				project,
				changelog,
				targetVersion,
				publishedVersions,
				commits,
				options.sourceChanges ?? [],
				date
			)
		}
	];
	if (
		!bump ||
		updates.every(
			(update) => readFileSync(update.path, 'utf8') === update.contents
		)
	) {
		return undefined;
	}
	return {
		project,
		currentVersion,
		targetVersion,
		updates,
		reason: bump ? `${bump} release` : 'existing untagged release draft',
		minimumVersion,
		changelogSections: {
			changes: commits
				.filter((commit) => commit.bump && commit.includeInChangelog)
				.map((commit) => commit.subject),
			dependencies: (options.sourceChanges ?? []).map(dependencyPreviewEntry)
		},
		replacesGeneratedChangelogSections
	};
}
