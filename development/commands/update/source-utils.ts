import { createHash } from 'node:crypto';
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

export async function githubCommit(
	repository: string,
	branch: string
): Promise<string> {
	const response = await request(
		`https://api.github.com/repos/${repository}/commits/${branch}`,
		githubHeaders()
	);
	return ((await response.json()) as { sha: string }).sha;
}

export async function gerritCommit(
	repository: string,
	branch: string
): Promise<string> {
	const url = `https://gerrit.wikimedia.org/r/plugins/gitiles/${repository}/+/refs/heads/${branch}?format=JSON`;
	const response = await request(url);
	const body = (await response.text()).replace(/^\)\]\}'\n/u, '');
	return (JSON.parse(body) as { commit: string }).commit;
}

export async function codebergCommit(
	repository: string,
	branch: string
): Promise<string> {
	const response = await request(
		`https://codeberg.org/api/v1/repos/${repository}/branches/${branch}`
	);
	return ((await response.json()) as { commit: { id: string } }).commit.id;
}

export async function archiveSha256(url: string): Promise<string> {
	const response = await request(url);
	return createHash('sha256')
		.update(Buffer.from(await response.arrayBuffer()))
		.digest('hex');
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function findVariable(contents: string, variable: string): string | undefined {
	const match = new RegExp(`^${escapeRegExp(variable)}=(.*)$`, 'mu').exec(
		contents
	);
	return match?.[1];
}

export function readVariable(contents: string, variable: string): string {
	const value = findVariable(contents, variable);
	if (value === undefined) {
		throw new Error(`Could not find ${variable} in build.env.`);
	}
	return value;
}

function readPreviousVariable(
	contents: string,
	variable: string
): string | undefined {
	return findVariable(contents, variable);
}

function pinLink(
	pin: SourcePin,
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
	const pattern = new RegExp(`^${escapeRegExp(variable)}=[^\n]*$`, 'mu');
	if (!pattern.test(contents)) {
		throw new Error(`Could not find ${variable} in build.env.`);
	}
	return contents.replace(pattern, `${variable}=${value}`);
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
		const previous = readPreviousVariable(previousContents, pin.variable);
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
			? `${change.description}: ${shortReference(change.previous)} → ${shortReference(change.next)}`
			: `${change.description}: add ${shortReference(change.next)}`;
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
		interaction.info(`${imageLabel} is already current.`);
		return plan;
	}
	interaction.note(`${imageLabel} candidate`, changeLines(plan.changes));
	if (!(await interaction.confirm(`Update ${imageLabel}?`))) {
		return { contents: originalContents, changes: [] };
	}
	return plan;
}

export function githubCompareUrl(
	repository: string,
	previous: string,
	next: string
): string {
	return `https://github.com/${repository}/compare/${previous}...${next}`;
}

export function githubCommitUrl(repository: string, commit: string): string {
	return `https://github.com/${repository}/commit/${commit}`;
}

export function gerritCompareUrl(
	repository: string,
	previous: string,
	next: string
): string {
	return `https://gerrit.wikimedia.org/r/plugins/gitiles/${repository}/+log/${previous}..${next}`;
}

export function gerritCommitUrl(repository: string, commit: string): string {
	return `https://gerrit.wikimedia.org/r/plugins/gitiles/${repository}/+/${commit}`;
}

export function codebergCommitUrl(repository: string, commit: string): string {
	return `https://codeberg.org/${repository}/commit/${commit}`;
}
