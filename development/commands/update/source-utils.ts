import { createHash } from 'node:crypto';
import {
	bakeObject,
	readBakeValue,
	replaceBakeValue,
	resolveBakeVariables,
	type BakeVariable
} from '../../lib/bake.js';
import { strong } from './presentation.js';
import type {
	SourceChange,
	SourcePin,
	SourceUpdateInteraction,
	SourceUpdatePlan
} from './source-types.js';

function githubHeaders(): Record<string, string> {
	const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
	return {
		Accept: 'application/vnd.github+json',
		...(token ? { Authorization: `Bearer ${token}` } : {}),
		'X-GitHub-Api-Version': '2022-11-28'
	};
}

export async function request(
	url: string,
	headers: Record<string, string> = {},
	method = 'GET'
): Promise<Response> {
	const response = await fetch(url, {
		headers,
		method,
		signal: AbortSignal.timeout(30000)
	});
	if (!response.ok) {
		throw new Error(`${url} returned HTTP ${response.status}.`);
	}
	return response;
}

export async function githubJson<T>(path: string): Promise<T> {
	const response = await request(
		`https://api.github.com${path}`,
		githubHeaders()
	);
	return (await response.json()) as T;
}

async function githubCommit(
	repository: string,
	branch: string
): Promise<string> {
	const response = await request(
		`https://api.github.com/repos/${repository}/commits/${branch}`,
		githubHeaders()
	);
	return ((await response.json()) as { sha: string }).sha;
}

async function gerritCommit(
	repository: string,
	branch: string
): Promise<string> {
	const url = `https://gerrit.wikimedia.org/r/plugins/gitiles/${repository}/+/refs/heads/${branch}?format=JSON`;
	const response = await request(url);
	const body = (await response.text()).replace(/^\)\]\}'\n/u, '');
	return (JSON.parse(body) as { commit: string }).commit;
}

async function codebergCommit(
	repository: string,
	branch: string
): Promise<string> {
	const response = await request(
		`https://codeberg.org/api/v1/repos/${repository}/branches/${branch}`
	);
	return ((await response.json()) as { commit: { id: string } }).commit.id;
}

async function gitlabCommit(
	repository: string,
	branch: string
): Promise<string> {
	const project = encodeURIComponent(repository);
	const ref = encodeURIComponent(branch);
	const response = await request(
		`https://gitlab.wikimedia.org/api/v4/projects/${project}/repository/branches/${ref}`
	);
	return ((await response.json()) as { commit: { id: string } }).commit.id;
}

export interface GitSource {
	repo: string;
	ref: string;
}

export function gitRefName(ref: string): string {
	return ref.replace(/^refs\/heads\//u, '');
}

function isSupportedGitRepository(repo: string): boolean {
	return [
		'https://github.com/',
		'https://codeberg.org/',
		'https://gitlab.wikimedia.org/',
		'https://gerrit.wikimedia.org/r/'
	].some((prefix) => repo.startsWith(prefix));
}

function repositorySlug(url: string, host: string): string {
	const prefix = `https://${host}/`;
	if (!url.startsWith(prefix)) {
		throw new Error(`Expected a ${host} repository URL; received ${url}.`);
	}
	return url.slice(prefix.length).replace(/\.git$/u, '');
}

function sourceString(
	source: Record<string, BakeVariable>,
	key: string,
	variable: string
): string {
	const value = source[key];
	if (typeof value !== 'string' || value === '') {
		throw new Error(`Bake source ${variable} has no string ${key}.`);
	}
	return value;
}

export function gitSourcePin(
	source: GitSource
): Pick<SourcePin, 'resolve' | 'compareUrl' | 'commitUrl'> {
	const ref = gitRefName(source.ref);
	if (source.repo.startsWith('https://github.com/')) {
		const repository = repositorySlug(source.repo, 'github.com');
		return {
			resolve: async () => await githubCommit(repository, ref),
			compareUrl: (previous, next) =>
				githubCompareUrl(repository, previous, next),
			commitUrl: (commit) => githubCommitUrl(repository, commit)
		};
	}
	if (source.repo.startsWith('https://codeberg.org/')) {
		const repository = repositorySlug(source.repo, 'codeberg.org');
		return {
			resolve: async () => await codebergCommit(repository, ref),
			compareUrl: (previous, next) =>
				`https://codeberg.org/${repository}/compare/${previous}...${next}`,
			commitUrl: (commit) => codebergCommitUrl(repository, commit)
		};
	}
	if (source.repo.startsWith('https://gitlab.wikimedia.org/')) {
		const repository = repositorySlug(source.repo, 'gitlab.wikimedia.org');
		return {
			resolve: async () => await gitlabCommit(repository, ref),
			compareUrl: (previous, next) =>
				`https://gitlab.wikimedia.org/${repository}/-/compare/${previous}...${next}`,
			commitUrl: (commit) =>
				`https://gitlab.wikimedia.org/${repository}/-/commit/${commit}`
		};
	}
	if (source.repo.startsWith('https://gerrit.wikimedia.org/r/')) {
		const repository = repositorySlug(
			source.repo,
			'gerrit.wikimedia.org'
		).replace(/^r\//u, '');
		return {
			resolve: async () => await gerritCommit(repository, ref),
			compareUrl: (previous, next) =>
				gerritCompareUrl(repository, previous, next),
			commitUrl: (commit) => gerritCommitUrl(repository, commit)
		};
	}
	throw new Error(`Unsupported source repository: ${source.repo}.`);
}

export function manifestPins(contents: string): SourcePin[] {
	const variables = resolveBakeVariables(contents, process.cwd());
	return [...variables.keys()].flatMap((variable) => {
		const value = variables.get(variable);
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			return [];
		}
		const source = bakeObject(variables, variable);
		if (
			typeof source.repo !== 'string' ||
			typeof source.ref !== 'string' ||
			typeof source.commit !== 'string' ||
			!isSupportedGitRepository(source.repo)
		) {
			return [];
		}
		const repo = sourceString(source, 'repo', variable);
		const ref = sourceString(source, 'ref', variable);
		const description = `${
			typeof source.name === 'string' ? source.name : variable
		} ${gitRefName(ref)}`;
		const archive =
			typeof source.archive === 'string' ? source.archive : undefined;
		return [
			{
				variable: `${variable}.commit`,
				description,
				...gitSourcePin({ repo, ref }),
				...(archive
					? {
							archiveShaVariable: `${variable}.archive_sha256`,
							archiveUrl: (commit: string) =>
								archive.replace('{commit}', commit)
						}
					: {})
			}
		];
	});
}

async function archiveSha256(url: string): Promise<string> {
	const response = await request(url);
	return createHash('sha256')
		.update(Buffer.from(await response.arrayBuffer()))
		.digest('hex');
}

function findVariable(contents: string, variable: string): string | undefined {
	const [name, attribute] = variable.split('.', 2);
	try {
		return readBakeValue(contents, name, attribute);
	} catch (error) {
		if (
			error instanceof Error &&
			/(?:Could not find Bake variable|has no (?:default|string))/u.test(
				error.message
			)
		) {
			return undefined;
		}
		throw error;
	}
}

function findPreviousPinValue(
	contents: string,
	variable: string
): string | undefined {
	const value = findVariable(contents, variable);
	if (value !== undefined || !variable.endsWith('.commit')) {
		return value;
	}
	// Release tags before the pin-schema rename use `.revision`. Remove this
	// fallback once the latest prior release has `.commit` pins.
	const legacyVariable = variable.replace(/\.commit$/u, '.revision');
	return findVariable(contents, legacyVariable);
}

export function readVariable(contents: string, variable: string): string {
	const value = findVariable(contents, variable);
	if (value === undefined) {
		throw new Error(`Could not find ${variable} in the Bake manifest.`);
	}
	return value;
}

export function pinLink(
	pin: Pick<SourcePin, 'compareUrl' | 'commitUrl'>,
	previous: string | undefined,
	next: string
): SourceChange['link'] {
	if (!previous) {
		return pin.commitUrl
			? { label: 'Commit', url: pin.commitUrl(next) }
			: undefined;
	}
	return pin.compareUrl
		? { label: 'Diff', url: pin.compareUrl(previous, next) }
		: undefined;
}

export function replaceVariable(
	contents: string,
	variable: string,
	value: string
): string {
	const [name, attribute] = variable.split('.', 2);
	return replaceBakeValue(contents, name, attribute, value);
}

export async function planPins(
	contents: string,
	pins: SourcePin[]
): Promise<SourceUpdatePlan> {
	let planned = contents;
	const changes: SourceChange[] = [];
	for (const pin of pins) {
		const previous = readVariable(planned, pin.variable);
		const next = await pin.resolve();
		if (previous === next) {
			continue;
		}
		planned = replaceVariable(planned, pin.variable, next);
		changes.push({
			variable: pin.variable,
			description: pin.description,
			previous,
			next,
			link: pinLink(pin, previous, next)
		});
	}
	return { contents: planned, changes };
}

export function describePinChanges(
	previousContents: string,
	nextContents: string,
	pins: SourcePin[]
): SourceChange[] {
	return pins.flatMap((pin) => {
		const previous = findPreviousPinValue(previousContents, pin.variable);
		const next = readVariable(nextContents, pin.variable);
		if (previous === next) {
			return [];
		}
		return [
			{
				variable: pin.variable,
				description: pin.description,
				...(previous === undefined ? {} : { previous }),
				next,
				link: pinLink(pin, previous, next)
			}
		];
	});
}

export async function addArchiveChecksums(
	plan: SourceUpdatePlan,
	pins: SourcePin[]
): Promise<SourceUpdatePlan> {
	let contents = plan.contents;
	for (const pin of pins) {
		if (!pin.archiveShaVariable || !pin.archiveUrl) {
			continue;
		}
		const change = plan.changes.find(
			({ variable }) => variable === pin.variable
		);
		if (!change) {
			continue;
		}
		contents = replaceVariable(
			contents,
			pin.archiveShaVariable,
			await archiveSha256(pin.archiveUrl(change.next))
		);
	}
	return { ...plan, contents };
}

function shortReference(reference: string): string {
	return reference.length > 12 ? reference.slice(0, 12) : reference;
}

export function changeLines(changes: SourceChange[]): string[] {
	return changes.flatMap((change) => {
		const summary = change.previous
			? `${strong(change.description)}: ${strong(shortReference(change.previous))} → ${strong(shortReference(change.next))}`
			: `${strong(change.description)}: add ${strong(shortReference(change.next))}`;
		return [
			summary,
			...(change.link ? [`  ${change.link.label}: ${change.link.url}`] : [])
		];
	});
}

export async function confirmPinPlan(
	imageLabel: string,
	originalContents: string,
	plan: SourceUpdatePlan,
	interaction: SourceUpdateInteraction
): Promise<SourceUpdatePlan> {
	if (plan.changes.length === 0) {
		interaction.info('Dependencies are current.');
		return plan;
	}
	interaction.note('Source candidate', changeLines(plan.changes));
	if (!(await interaction.confirm(`Update ${imageLabel}?`))) {
		return { contents: originalContents, changes: [] };
	}
	return plan;
}

function githubCompareUrl(
	repository: string,
	previous: string,
	next: string
): string {
	return `https://github.com/${repository}/compare/${previous}...${next}`;
}

function githubCommitUrl(repository: string, commit: string): string {
	return `https://github.com/${repository}/commit/${commit}`;
}

function gerritCompareUrl(
	repository: string,
	previous: string,
	next: string
): string {
	return `https://gerrit.wikimedia.org/r/plugins/gitiles/${repository}/+log/${previous}..${next}`;
}

function gerritCommitUrl(repository: string, commit: string): string {
	return `https://gerrit.wikimedia.org/r/plugins/gitiles/${repository}/+/${commit}`;
}

function codebergCommitUrl(repository: string, commit: string): string {
	return `https://codeberg.org/${repository}/commit/${commit}`;
}
