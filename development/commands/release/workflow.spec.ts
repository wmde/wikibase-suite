import { afterEach, describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { readImageManifest } from '../../lib/bake.js';
import { createRepositoryContext } from '../../lib/context.js';
import { applyFileUpdates } from '../../lib/file-updates.js';
import { GitRepository } from '../../lib/git.js';
import {
	discoverReleaseProjects,
	resolveProjectSelections
} from '../../lib/projects.js';
import { planVersionUpdate, type VersionPlan } from '../../lib/versioning.js';
import { readWbsVersionManifest } from '../../lib/wbs-version.js';
import { planWbsToolsAdoption } from '../update/projects/wbs-tools.js';
import { planWbsUpdate } from '../update/projects/wbs.js';
import { readVariable } from '../update/source-utils.js';

const CLI = resolve('wbs-dev.ts');
const TSX = resolve('node_modules/.bin/tsx');
const fixtures: string[] = [];

interface Fixture {
	root: string;
	development: string;
	remote: string;
}

interface CliResult {
	status: number | null;
	stdout: string;
	stderr: string;
}

function run(command: string, args: string[], cwd: string): string {
	return execFileSync(command, args, { cwd, encoding: 'utf8' });
}

function git(fixture: Fixture, ...args: string[]): string {
	return run('git', args, fixture.root).trim();
}

function write(fixture: Fixture, relativePath: string, contents: string): void {
	const path = join(fixture.root, relativePath);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, contents);
}

function commitAll(fixture: Fixture, message: string): void {
	git(fixture, 'add', '.');
	git(fixture, 'commit', '-m', message);
}

function wikibaseManifest(version: string, commit = 'aaa'): string {
	return `variable "IMAGE_NAME" { default = "wikibase" }
variable "IMAGE_VERSION" { default = "${version}" }
variable "WIKIBASE" {
  default = {
    kind = "github"
    name = "Wikibase"
    repo = "https://github.com/example/wikibase.git"
    ref = "refs/heads/main"
    commit = "${commit}"
  }
}
`;
}

function imageVersion(fixture: Fixture): string {
	return readImageManifest(
		join(fixture.root, 'development/images/wikibase/docker-bake.hcl')
	).version;
}

function wbsVersion(fixture: Fixture): string {
	return readWbsVersionManifest(
		readFileSync(join(fixture.root, '.wbs/version'), 'utf8')
	).version;
}

function createFixture(): Fixture {
	const parent = mkdtempSync(join(tmpdir(), 'wbs-dev-release-'));
	fixtures.push(parent);
	const remote = join(parent, 'origin.git');
	const root = join(parent, 'checkout');
	run('git', ['init', '--bare', '--initial-branch=main', remote], parent);
	run('git', ['init', '--initial-branch=main', root], parent);
	const fixture = { root, development: join(root, 'development'), remote };
	git(fixture, 'config', 'user.name', 'Test Operator');
	git(fixture, 'config', 'user.email', 'test@example.test');
	git(fixture, 'remote', 'add', 'origin', remote);
	write(fixture, 'development/images/wikibase/Dockerfile', 'FROM scratch\n');
	write(
		fixture,
		'development/images/wikibase/docker-bake.hcl',
		wikibaseManifest('1.0.0')
	);
	write(
		fixture,
		'development/images/wikibase/CHANGELOG.md',
		'# 1.0.0 (2026-01-01)\n\n- Initial release.\n'
	);
	write(
		fixture,
		'.wbs/version',
		'WBS_VERSION=1.0.0\nWBS_TOOLS_IMAGE=wikibase/wbs-tools:1.0.0\n'
	);
	write(
		fixture,
		'install',
		'#!/usr/bin/env bash\nWBS_TOOLS_IMAGE="${WBS_TOOLS_IMAGE:-wikibase/wbs-tools:1.0.0}"\n'
	);
	write(
		fixture,
		'CHANGELOG.md',
		'# 1.0.0 (2026-01-01)\n\n- Initial release.\n'
	);
	write(
		fixture,
		'docker-compose.yml',
		'services:\n  wikibase:\n    env_file:\n      - .wbs/version\n'
	);
	commitAll(fixture, 'chore: initial release');
	git(fixture, 'tag', 'wikibase@1.0.0');
	git(fixture, 'tag', 'deploy@1.0.0');
	git(fixture, 'push', '-u', 'origin', 'main', '--tags');
	return fixture;
}

function cli(fixture: Fixture, ...args: string[]): CliResult {
	const result = spawnSync(TSX, [CLI, ...args], {
		cwd: fixture.development,
		encoding: 'utf8'
	});
	return {
		status: result.status,
		stdout: result.stdout,
		stderr: result.stderr
	};
}

function versions(fixture: Fixture, ...projects: string[]): CliResult {
	const output: string[] = [];
	const originalLog = console.log;
	console.log = (...values: unknown[]) => output.push(values.join(' '));
	try {
		const context = createRepositoryContext(fixture.development);
		const gitRepository = new GitRepository(context);
		gitRepository.fetchRemoteTags();
		const plans = resolveProjectSelections(
			projects,
			discoverReleaseProjects(context),
			'update',
			{ requireExplicit: true }
		)
			.map((project) =>
				planVersionUpdate(context, gitRepository, project)
			)
			.filter((plan): plan is VersionPlan => plan !== undefined);
		if (plans.length === 0) {
			console.log('No selected projects have releasable changes.');
		} else {
			for (const plan of plans) {
				console.log(
					`Preparing ${plan.project.name} ${plan.targetVersion} (${plan.reason}).`
				);
			}
			applyFileUpdates(plans.flatMap((plan) => plan.updates));
			console.log(
				'Updated local files. Nothing was staged, committed, tagged, or pushed. Review with git diff.'
			);
		}
		return { status: 0, stdout: `${output.join('\n')}\n`, stderr: '' };
	} catch (error) {
		return {
			status: 1,
			stdout: `${output.join('\n')}\n`,
			stderr: error instanceof Error ? error.message : String(error)
		};
	} finally {
		console.log = originalLog;
	}
}

describe('wbs-dev preparation and release workflow', () => {
	afterEach(() => {
		for (const fixture of fixtures) {
			rmSync(fixture, { recursive: true, force: true });
		}
		fixtures.length = 0;
	});

	describe('release preparation', () => {
		it('infers a minor version and generates a structured changelog entry', () => {
			const fixture = createFixture();
			write(
				fixture,
				'development/images/wikibase/feature.txt',
				'new behavior\n'
			);
			commitAll(fixture, 'feat(wikibase): add useful behavior');
			git(fixture, 'tag', '--force', 'wikibase@1.0.0', 'HEAD');
			git(fixture, 'tag', 'wikibase@99.0.0');
			const result = versions(fixture, 'wikibase');
			assert.equal(result.status, 0, result.stderr);
			assert.equal(imageVersion(fixture), '1.1.0');
			assert.match(
				readFileSync(
					join(fixture.root, 'development/images/wikibase/CHANGELOG.md'),
					'utf8'
				),
				/^# 1\.1\.0 \(\d{4}-\d{2}-\d{2}\)\n\n## Changes\n\n- feat\(wikibase\): add useful behavior/u
			);
			assert.equal(git(fixture, 'diff', '--cached', '--name-only'), '');
			const rerun = versions(fixture, 'wikibase');
			assert.equal(rerun.status, 0, rerun.stderr);
			assert.equal(imageVersion(fixture), '1.1.0');
			assert.match(
				rerun.stdout,
				/No selected projects have releasable changes\./u
			);
		});

		it('preserves a manually written untagged draft and its higher version floor', () => {
			const fixture = createFixture();
			write(
				fixture,
				'development/images/wikibase/feature.txt',
				'new behavior\n'
			);
			write(
				fixture,
				'development/images/wikibase/docker-bake.hcl',
				wikibaseManifest('1.2.0')
			);
			write(
				fixture,
				'development/images/wikibase/CHANGELOG.md',
				'# Unreleased\n\nA carefully edited explanation.\n\n# 1.0.0 (2026-01-01)\n\n- Initial release.\n'
			);
			commitAll(fixture, 'feat(wikibase): draft a larger release');
			const result = versions(fixture, 'wikibase');
			assert.equal(result.status, 0, result.stderr);
			const changelog = readFileSync(
				join(fixture.root, 'development/images/wikibase/CHANGELOG.md'),
				'utf8'
			);
			assert.match(changelog, /^# 1\.2\.0 \(\d{4}-\d{2}-\d{2}\)/u);
			assert.match(changelog, /A carefully edited explanation\./u);
		});

		it('regenerates managed changelog sections while preserving manual prose', () => {
			const fixture = createFixture();
			write(
				fixture,
				'development/images/wikibase/CHANGELOG.md',
				'# Unreleased\n\nCompatibility notes written by the operator.\n\n# 1.0.0 (2026-01-01)\n\n- Initial release.\n'
			);
			write(
				fixture,
				'development/images/wikibase/docker-bake.hcl',
				wikibaseManifest('1.0.0', 'bbb')
			);
			const context = createRepositoryContext(fixture.development);
			const gitRepository = new GitRepository(context);
			const project = discoverReleaseProjects(context).find(
				(candidate) => candidate.name === 'wikibase'
			)!;
			const sourceChanges = [
				{
					variable: 'MEDIAWIKI_VERSION',
					description: 'MediaWiki',
					previous: '1.45.4',
					next: '1.46.0'
				},
				{
					variable: 'WIKIBASE_COMMIT',
					description: 'Wikibase',
					previous: 'aaa',
					next: 'bbb',
					link: {
						label: 'Diff',
						url: 'https://example.test/compare/aaa...bbb'
					}
				},
				{
					variable: 'UNLINKED_COMMIT',
					description: 'Unlinked dependency',
					previous: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
					next: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
				},
				{
					variable: 'NEW_COMMIT',
					description: 'Example extension REL1_46',
					next: 'cccccccccccccccccccccccccccccccccccccccc',
					link: {
						label: 'Commit',
						url: 'https://example.test/commit/cccccccccccccccccccccccccccccccccccccccc'
					}
				},
				{
					variable: 'SOURCE.commit',
					description: 'Manifest source main',
					previous: 'dddddddddddddddddddddddddddddddddddddddd',
					next: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
					link: {
						label: 'Diff',
						url: 'https://example.test/compare/dddd...eeee'
					}
				}
			];
			gitRepository.fetchRemoteTags();
			const first = planVersionUpdate(
				context,
				gitRepository,
				project,
				{
					date: '2026-08-07',
					sourceChanges,
					sourcePaths: ['development/images/wikibase/docker-bake.hcl']
				}
			)!;
			applyFileUpdates(first.updates);
			write(
				fixture,
				'development/images/wikibase/feature.txt',
				'new behavior\n'
			);
			commitAll(fixture, 'feat(wikibase): add behavior after the first draft');

			const rerun = planVersionUpdate(
				context,
				gitRepository,
				project,
				{
					date: '2026-08-08',
					sourceChanges,
					sourcePaths: ['development/images/wikibase/docker-bake.hcl']
				}
			)!;
			assert.equal(rerun.replacesGeneratedChangelogSections, true);
			const changelog = rerun.updates.find(
				(update) => update.path === project.changelogPath
			)!.contents;
			assert.match(changelog, /Compatibility notes written by the operator\./u);
			assert.equal(
				(changelog.match(/^## Dependency updates$/gmu) ?? []).length,
				1
			);
			assert.match(changelog, /MediaWiki from 1\.45\.4 to 1\.46\.0\./u);
			assert.doesNotMatch(changelog, /MediaWiki from `1\.45\.4`/u);
			assert.match(
				changelog,
				/Wikibase \(\[Diff\]\(https:\/\/example\.test\/compare\/aaa\.\.\.bbb\)\)\./u
			);
			assert.match(
				changelog,
				/Unlinked dependency from `aaaaaaaaaaaa` to `bbbbbbbbbbbb`\./u
			);
			assert.match(
				changelog,
				/Added Example extension REL1_46 at \[Commit\]\(https:\/\/example\.test\/commit\/cccccccccccccccccccccccccccccccccccccccc\)\./u
			);
			assert.match(
				changelog,
				/Manifest source main \(\[Diff\]\(https:\/\/example\.test\/compare\/dddd\.\.\.eeee\)\)\./u
			);
			assert.doesNotMatch(changelog, /Manifest source main from/u);
			assert.match(
				changelog,
				/## Changes\n\n- feat\(wikibase\): add behavior after the first draft/u
			);
			assert.ok(
				changelog.indexOf('## Changes') <
					changelog.indexOf('## Dependency updates')
			);
		});

		it('rejects duplicate generated sections instead of guessing', () => {
			const fixture = createFixture();
			write(
				fixture,
				'development/images/wikibase/CHANGELOG.md',
				'# Unreleased\n\n## Changes\n\n- First.\n\n## Changes\n\n- Second.\n\n# 1.0.0 (2026-01-01)\n\n- Initial release.\n'
			);
			write(fixture, 'development/images/wikibase/fix.txt', 'fixed\n');
			const context = createRepositoryContext(fixture.development);
			const gitRepository = new GitRepository(context);
			gitRepository.fetchRemoteTags();
			const project = discoverReleaseProjects(context).find(
				(candidate) => candidate.name === 'wikibase'
			)!;
			assert.throws(
				() =>
					planVersionUpdate(context, gitRepository, project),
				/multiple "Changes" sections/u
			);
		});

		it('treats uncommitted source updates as a local patch release', () => {
			const fixture = createFixture();
			write(
				fixture,
				'development/images/wikibase/docker-bake.hcl',
				wikibaseManifest('1.0.0', 'bbb')
			);
			const result = versions(fixture, 'wikibase');
			assert.equal(result.status, 0, result.stderr);
			assert.match(
				result.stdout,
				/Preparing wikibase 1\.0\.1 \(patch release\)/u
			);
			assert.equal(imageVersion(fixture), '1.0.1');
			assert.match(
				result.stdout,
				/Nothing was staged, committed, tagged, or pushed/u
			);
			assert.equal(git(fixture, 'diff', '--cached', '--name-only'), '');
		});

		it('merges a proposed source pin and image version in one manifest update', () => {
			const fixture = createFixture();
			const context = createRepositoryContext(fixture.development);
			const gitRepository = new GitRepository(context);
			gitRepository.fetchRemoteTags();
			const project = discoverReleaseProjects(context).find(
				(candidate) => candidate.name === 'wikibase'
			)!;
			const proposedManifest = wikibaseManifest('1.0.0', 'bbb');
			const plan = planVersionUpdate(
				context,
				gitRepository,
				project,
				{
					proposedUpdates: [
						{ path: project.versionPath, contents: proposedManifest }
					],
					sourceChanges: [
						{
							variable: 'WIKIBASE.commit',
							description: 'Wikibase main',
							previous: 'aaa',
							next: 'bbb'
						}
					],
					sourcePaths: ['development/images/wikibase/docker-bake.hcl']
				}
			)!;
			const manifestUpdate = plan.updates.find(
				(update) => update.path === project.versionPath
			)!.contents;
			assert.equal(plan.currentVersion, '1.0.0');
			assert.equal(plan.targetVersion, '1.0.1');
			assert.equal(readVariable(manifestUpdate, 'WIKIBASE.commit'), 'bbb');
			assert.equal(readImageManifest(project.versionPath).version, '1.0.0');
			assert.equal(readVariable(manifestUpdate, 'IMAGE_VERSION'), '1.0.1');
		});

		it('reserves dry runs for release commands', () => {
			const fixture = createFixture();
			const update = cli(fixture, 'update', 'wikibase', '--dry-run');
			assert.notEqual(update.status, 0);
			assert.match(update.stderr, /unknown option '--dry-run'/u);
		});

		it('uses legacy deploy tags for WBS', () => {
			const fixture = createFixture();
			write(fixture, 'install', '#!/usr/bin/env bash\necho changed\n');
			commitAll(fixture, 'feat!: replace the WBS installation contract');
			const result = versions(fixture, 'wbs');
			assert.equal(result.status, 0, result.stderr);
			assert.equal(wbsVersion(fixture), '2.0.0');
		});

		it('prepares an accepted WBS Tools adoption as a WBS patch', () => {
			const fixture = createFixture();
			write(
				fixture,
				'development/images/wbs-tools/docker-bake.hcl',
				'variable "IMAGE_REPOSITORY" { default = "wikibase/wbs-tools" }\nvariable "IMAGE_VERSION" { default = "1.1.0" }\n'
			);
			write(
				fixture,
				'development/images/wbs-tools/CHANGELOG.md',
				'# 1.1.0 (2026-01-01)\n\n- Tools update.\n'
			);
			const context = createRepositoryContext(fixture.development);
			const gitRepository = new GitRepository(context);
			gitRepository.fetchRemoteTags();
			const projects = discoverReleaseProjects(context);
			const wbs = projects.find((project) => project.name === 'wbs')!;
			const tools = projects.find((project) => project.name === 'wbs-tools')!;
			const adoption = planWbsToolsAdoption(wbs, tools, '1.1.0')!;
			const plan = planWbsUpdate(context, gitRepository, wbs, {
				toolsAdoption: adoption
			})!;

			assert.equal(plan.targetVersion, '1.0.1');
			const versionUpdate = plan.updates.find(
				(update) => update.path === wbs.versionPath
			)!.contents;
			assert.deepEqual(readWbsVersionManifest(versionUpdate), {
				version: '1.0.1',
				toolsImage: 'wikibase/wbs-tools:1.1.0'
			});
			assert.match(
				plan.updates.find((update) => update.path.endsWith('/install'))!
					.contents,
				/WBS_TOOLS_IMAGE="\$\{WBS_TOOLS_IMAGE:-wikibase\/wbs-tools:1\.1\.0\}"/u
			);
			assert.match(
				plan.updates.find((update) => update.path.endsWith('CHANGELOG.md'))!
					.contents,
				/WBS Tools image from wikibase\/wbs-tools:1\.0\.0 to wikibase\/wbs-tools:1\.1\.0\./u
			);
		});

		it('does not add a committed generated release draft to its own changelog', () => {
			const fixture = createFixture();
			write(fixture, 'development/images/wikibase/fix.txt', 'fixed\n');
			commitAll(fixture, 'fix(wikibase): original fix');
			const first = versions(fixture, 'wikibase');
			assert.equal(first.status, 0, first.stderr);
			commitAll(fixture, 'chore(wikibase): prepare release draft');
			const result = versions(fixture, 'wikibase');
			assert.equal(result.status, 0, result.stderr);
			const changelog = readFileSync(
				join(fixture.root, 'development/images/wikibase/CHANGELOG.md'),
				'utf8'
			);
			assert.doesNotMatch(changelog, /prepare release draft/u);
			assert.match(changelog, /fix\(wikibase\): original fix/u);
		});

		it('rejects ambiguous drafts before writing any release files', () => {
			const fixture = createFixture();
			write(
				fixture,
				'development/images/wikibase/CHANGELOG.md',
				'# 1.2.0\n\n- First draft.\n\n# 1.1.0\n\n- Second draft.\n\n# 1.0.0\n\n- Initial.\n'
			);
			commitAll(fixture, 'feat(wikibase): ambiguous release notes');
			const manifestBefore = readFileSync(
				join(fixture.root, 'development/images/wikibase/docker-bake.hcl'),
				'utf8'
			);
			const changelogBefore = readFileSync(
				join(fixture.root, 'development/images/wikibase/CHANGELOG.md'),
				'utf8'
			);
			const result = versions(fixture, 'wikibase');
			assert.notEqual(result.status, 0);
			assert.match(result.stderr, /multiple untagged release entries/u);
			assert.equal(
				readFileSync(
					join(fixture.root, 'development/images/wikibase/docker-bake.hcl'),
					'utf8'
				),
				manifestBefore
			);
			assert.equal(
				readFileSync(
					join(fixture.root, 'development/images/wikibase/CHANGELOG.md'),
					'utf8'
				),
				changelogBefore
			);
		});

		it('plans every selected project before writing any of them', () => {
			const fixture = createFixture();
			write(
				fixture,
				'development/images/wikibase/feature.txt',
				'new behavior\n'
			);
			write(
				fixture,
				'CHANGELOG.md',
				'# 1.2.0\n\n- First draft.\n\n# 1.1.0\n\n- Second draft.\n\n# 1.0.0\n\n- Initial.\n'
			);
			commitAll(fixture, 'feat(wikibase): prepare an atomic release');
			const manifestPath = join(
				fixture.root,
				'development/images/wikibase/docker-bake.hcl'
			);
			const before = readFileSync(manifestPath, 'utf8');
			const result = versions(fixture, 'wikibase', 'wbs');
			assert.notEqual(result.status, 0);
			assert.equal(readFileSync(manifestPath, 'utf8'), before);
		});
	});

	describe('release publication', () => {
		it('creates and pushes a missing image tag, and is rerunnable', () => {
			const fixture = createFixture();
			write(
				fixture,
				'development/images/wikibase/docker-bake.hcl',
				wikibaseManifest('1.0.1')
			);
			write(
				fixture,
				'development/images/wikibase/CHANGELOG.md',
				'# 1.0.1 (2026-01-02)\n\n- Fix.\n\n# 1.0.0 (2026-01-01)\n\n- Initial.\n'
			);
			commitAll(fixture, 'fix(wikibase): correct behavior');
			git(fixture, 'push', 'origin', 'main');
			git(fixture, 'tag', 'wikibase@1.0.1', 'wikibase@1.0.0');
			const first = cli(fixture, 'release', 'images', 'wikibase');
			assert.equal(first.status, 0, first.stderr);
			assert.match(
				run(
					'git',
					['--git-dir', fixture.remote, 'tag', '--list'],
					fixture.root
				),
				/wikibase@1\.0\.1/u
			);
			assert.equal(
				run(
					'git',
					[
						'--git-dir',
						fixture.remote,
						'rev-parse',
						'refs/tags/wikibase@1.0.1'
					],
					fixture.root
				).trim(),
				git(fixture, 'rev-parse', 'HEAD')
			);
			const second = cli(fixture, 'release', 'images', 'wikibase');
			assert.equal(second.status, 0, second.stderr);
			assert.match(second.stdout, /Already published: wikibase@1\.0\.1/u);
		});

		it('blocks publication from a dirty working tree', () => {
			const fixture = createFixture();
			write(fixture, 'development/images/wikibase/dirty.txt', 'dirty=true\n');
			const result = cli(fixture, 'release', 'images', 'wikibase', '--dry-run');
			assert.notEqual(result.status, 0);
			assert.match(result.stderr, /clean working tree/u);
		});

		it('rejects prerelease versions until a publication policy exists', () => {
			const fixture = createFixture();
			write(
				fixture,
				'development/images/wikibase/docker-bake.hcl',
				wikibaseManifest('1.1.0-rc.1')
			);
			write(
				fixture,
				'development/images/wikibase/CHANGELOG.md',
				'# 1.1.0-rc.1 (2026-01-02)\n\n- Candidate.\n'
			);
			commitAll(fixture, 'feat(wikibase): prepare a candidate');
			git(fixture, 'push', 'origin', 'main');
			const result = cli(fixture, 'release', 'images', 'wikibase', '--dry-run');
			assert.notEqual(result.status, 0);
			assert.match(result.stderr, /stable MAJOR\.MINOR\.PATCH/u);
		});
	});
});
