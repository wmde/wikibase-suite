import { createHash } from 'node:crypto';

function githubHeaders(): Record<string, string> {
	const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
	return {
		Accept: 'application/vnd.github+json',
		...(token ? { Authorization: `Bearer ${token}` } : {}),
		'X-GitHub-Api-Version': '2022-11-28'
	};
}

async function request(
	url: string,
	headers: Record<string, string> = {}
): Promise<Response> {
	const response = await fetch(url, {
		headers,
		signal: AbortSignal.timeout(30000)
	});
	if (!response.ok) {
		throw new Error(`${url} returned HTTP ${response.status}.`);
	}
	return response;
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

export function readVariable(contents: string, variable: string): string {
	const match = new RegExp(`^${escapeRegExp(variable)}=(.+)$`, 'mu').exec(
		contents
	);
	if (!match) {
		throw new Error(`Could not find ${variable} in build.env.`);
	}
	return match[1];
}

export function replaceVariable(
	contents: string,
	variable: string,
	value: string
): string {
	const pattern = new RegExp(`^${escapeRegExp(variable)}=[^\n]+$`, 'mu');
	if (!pattern.test(contents)) {
		throw new Error(`Could not find ${variable} in build.env.`);
	}
	return contents.replace(pattern, `${variable}=${value}`);
}
