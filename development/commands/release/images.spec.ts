import { afterEach, describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CLI = resolve('wbs-dev.ts');
const TSX = resolve('node_modules/.bin/tsx');
const fixtures: string[] = [];
const sourceDigest = `sha256:${'a'.repeat(64)}`;

// Real CLI and Git repositories; only Docker, builds and test execution are faked.
function fixture() {
	const root = mkdtempSync(join(tmpdir(), 'wbs-release-pipeline-'));
	fixtures.push(root);
	const checkout = join(root, 'checkout');
	const remote = join(root, 'origin.git');
	const development = join(checkout, 'development');
	const git = (...args: string[]) =>
		execFileSync('git', args, {
			cwd: checkout,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe']
		}).trim();
	execFileSync('git', ['init', '--bare', '--initial-branch=main', remote], {
		stdio: 'ignore'
	});
	mkdirSync(development, { recursive: true });
	git('init', '--initial-branch=main');
	git('config', 'user.name', 'Release test');
	git('config', 'user.email', 'test@example.test');
	git('remote', 'add', 'origin', remote);
	mkdirSync(join(checkout, '.wbs'));
	writeFileSync(
		join(checkout, '.wbs/version'),
		'WBS_VERSION=1.0.0\nWBS_TOOLS_IMAGE=wikibase/wbs-tools:1.0.0\n'
	);
	writeFileSync(join(checkout, 'CHANGELOG.md'), '# 1.0.0\n\n- Release.\n');
	for (const name of ['wikibase', 'quickstatements']) {
		const image = join(development, 'images', name);
		mkdirSync(image, { recursive: true });
		writeFileSync(
			join(image, 'docker-bake.hcl'),
			`variable "IMAGE_VERSION" { default = "1.0.0" }\n`
		);
		writeFileSync(join(image, 'CHANGELOG.md'), '# 1.0.0\n\n- Release.\n');
		const suite = join(development, 'tests', name);
		mkdirSync(suite, { recursive: true });
		writeFileSync(join(suite, `${name}.conf.ts`), '');
	}
	const bin = join(root, 'bin');
	mkdirSync(bin);
	const statePath = join(root, 'state.json');
	writeFileSync(statePath, JSON.stringify({ events: [], published: {} }));
	const fake = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const file = process.env.RELEASE_TEST_STATE;
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
const args = process.argv.slice(2);
const tool = path.basename(process.argv[1]);
state.events.push({ tool, args, platform: process.env.DOCKER_DEFAULT_PLATFORM, registry: process.env.WBS_TEST_IMAGE_REGISTRY, tag: process.env.WBS_TEST_IMAGE_TAG, pull: process.env.WBS_TEST_IMAGE_PULL_POLICY });
const save = () => fs.writeFileSync(file, JSON.stringify(state));
const fail = message => { save(); console.error(message); process.exit(1); };
const digest = '${sourceDigest}';
if (tool === 'image.sh' || tool === 'pnpm') {
  if (process.env.FAIL_STAGE === (tool === 'pnpm' ? 'test' : 'build')) fail('intentional failure');
} else if (args[1] === 'bake') {
  if (!args.includes('--print')) fail('publication must not build');
  const target = args.at(-1);
  const repo = process.env.IMAGE_REPOSITORY;
  console.log(JSON.stringify({ target: { [target]: { tags: [repo + ':1.0.0', repo + ':1'] } } }));
} else if (args[2] === 'inspect') {
  const ref = args[3];
  if (ref.includes(':release-') || ref.endsWith(':tested')) {
    if (process.env.FAIL_STAGE === 'missing-source') fail('manifest unknown');
    console.log(JSON.stringify({ digest }));
  } else {
    if (process.env.FAIL_STAGE === 'auth') fail('unauthorized');
    const existing = state.published[ref];
    if (!existing) fail('manifest unknown');
    console.log(JSON.stringify({ digest: existing }));
  }
} else if (args[2] === 'create') {
  if (process.env.FAIL_STAGE === 'publish') fail('publication failed');
  if (args.at(-1).split('@')[1] !== digest) fail('source must be pinned');
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tag') state.published[args[++i]] = process.env.FAIL_STAGE === 'digest' ? 'sha256:' + 'b'.repeat(64) : digest;
  }
} else fail('unexpected command: ' + args.join(' '));
save();
`;
	for (const name of ['docker', 'pnpm']) {
		writeFileSync(join(bin, name), fake);
		chmodSync(join(bin, name), 0o755);
	}
	mkdirSync(join(development, 'commands/build'), { recursive: true });
	const build = join(development, 'commands/build/image.sh');
	writeFileSync(build, fake);
	chmodSync(build, 0o755);
	git('add', '.');
	git('commit', '-m', 'Prepare release');
	git('push', '-u', 'origin', 'main');
	const cli = (args: string[], failure = '') =>
		spawnSync(TSX, [CLI, 'release', ...args], {
			cwd: development,
			encoding: 'utf8',
			env: {
				...process.env,
				PATH: `${bin}:${process.env.PATH}`,
				RELEASE_TEST_STATE: statePath,
				FAIL_STAGE: failure
			}
		});
	const state = () =>
		JSON.parse(readFileSync(statePath, 'utf8')) as {
			events: {
				tool: string;
				args: string[];
				platform?: string;
				registry?: string;
				tag?: string;
				pull?: string;
			}[];
			published: Record<string, string>;
		};
	return { cli, git, state, statePath };
}

const publishArgs = [
	'wikibase',
	'--publish',
	'--staging-registry',
	'staging.example/wbs',
	'--image-tag',
	'tested'
];

afterEach(() => {
	for (const root of fixtures.splice(0))
		rmSync(root, { recursive: true, force: true });
});

describe('release pipeline', function () {
	this.timeout(10000);
	it('defaults preflight to all targets and performs no builds, publication or tagging', () => {
		const f = fixture();
		const result = f.cli(['--preflight']);
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /wikibase@1.0.0: ready/u);
		assert.match(result.stdout, /quickstatements@1.0.0: ready/u);
		assert.match(result.stdout, /wbs@1.0.0: ready/u);
		assert.deepEqual(f.state().events, []);
		assert.equal(f.git('ls-remote', '--tags', 'origin'), '');
	});

	it('releases all projects when no targets are specified, including WBS after its images exist', () => {
		const f = fixture();
		const result = f.cli([]);
		assert.equal(result.status, 0, result.stderr);
		const tags = f.git('ls-remote', '--tags', 'origin');
		assert.match(tags, /wbs@1.0.0/u);
		assert.match(tags, /wikibase@1.0.0/u);
		assert.match(tags, /quickstatements@1.0.0/u);
	});

	it('builds the stack once, forwards Bake options, tests once, then publishes selected images and tags', () => {
		const f = fixture();
		const result = f.cli([
			'wikibase',
			'quickstatements',
			'--',
			'--no-cache',
			'--builder',
			'custom'
		]);
		assert.equal(result.status, 0, result.stderr);
		const events = f.state().events;
		const builds = events.filter((e) => e.tool === 'image.sh');
		assert.equal(builds.length, 2);
		for (const build of builds)
			assert.deepEqual(build.args.slice(1, 4), [
				'--no-cache',
				'--builder',
				'custom'
			]);
		const tests = events.filter((e) => e.tool === 'pnpm');
		assert.equal(tests.length, 1);
		assert.deepEqual(tests[0].args.slice(-3), ['test', 'all', '--skip-build']);
		assert.equal(tests[0].pull, 'always');
		assert.ok(
			events.findIndex((e) => e.args[2] === 'create') > events.indexOf(tests[0])
		);
		assert.match(f.git('ls-remote', '--tags', 'origin'), /wikibase@1.0.0/u);
		assert.match(
			f.git('ls-remote', '--tags', 'origin'),
			/quickstatements@1.0.0/u
		);
	});

	it('tests each requested architecture, publishes only selected images, and uses custom registry namespaces', () => {
		const f = fixture();
		const result = f.cli([
			'wikibase',
			'--registry',
			'registry.example/releases',
			'--staging-registry',
			'registry.example/builds',
			'--platform',
			'linux/amd64,linux/arm64'
		]);
		assert.equal(result.status, 0, result.stderr);
		const tests = f.state().events.filter((e) => e.tool === 'pnpm');
		assert.deepEqual(
			tests.map((e) => e.platform),
			['linux/amd64', 'linux/arm64']
		);
		assert.equal(tests[1].args.includes('all'), false);
		assert.equal(tests[0].registry, 'registry.example/builds');
		assert.deepEqual(Object.keys(f.state().published).sort(), [
			'registry.example/releases/wikibase:1',
			'registry.example/releases/wikibase:1.0.0'
		]);
	});

	for (const failure of ['build', 'test', 'publish', 'digest']) {
		it(`does not tag a release after ${failure} failure`, () => {
			const f = fixture();
			assert.notEqual(f.cli(['wikibase'], failure).status, 0);
			assert.equal(f.git('ls-remote', '--tags', 'origin'), '');
			if (failure === 'build' || failure === 'test')
				assert.deepEqual(f.state().published, {});
			if (failure === 'build')
				assert.equal(
					f.state().events.some((e) => e.tool === 'pnpm'),
					false
				);
		});
	}

	it('shares publication with CI, pins source digests and skips rebuilding/retesting', () => {
		const f = fixture();
		const result = f.cli(publishArgs);
		assert.equal(result.status, 0, result.stderr);
		assert.ok(f.state().events.every((e) => e.tool === 'docker'));
		const copies = f.state().events.filter((e) => e.args[2] === 'create');
		assert.ok(
			copies.every(
				(e) => e.args.at(-1) === `staging.example/wbs/wikibase@${sourceDigest}`
			)
		);
		assert.ok(copies.every((e) => e.args.includes('--prefer-index=false')));
		assert.equal(copies.length, 2);
		assert.ok(copies[0].args.includes('wikibase/wikibase:1'));
		assert.ok(copies[1].args.includes('wikibase/wikibase:1.0.0'));
	});

	it('resumes after image publication without moving aliases, then pushes the missing Git tag', () => {
		const f = fixture();
		writeFileSync(
			f.statePath,
			JSON.stringify({
				events: [],
				published: { 'wikibase/wikibase:1.0.0': sourceDigest }
			})
		);
		assert.equal(f.cli(publishArgs).status, 0);
		assert.equal(
			f.state().events.some((e) => e.args[2] === 'create'),
			false
		);
		assert.match(f.git('ls-remote', '--tags', 'origin'), /wikibase@1.0.0/u);
	});

	for (const failure of ['auth', 'missing-source', 'conflict']) {
		it(`fails closed on ${failure} before publication`, () => {
			const f = fixture();
			if (failure === 'conflict')
				writeFileSync(
					f.statePath,
					JSON.stringify({
						events: [],
						published: { 'wikibase/wikibase:1.0.0': `sha256:${'b'.repeat(64)}` }
					})
				);
			assert.notEqual(f.cli(publishArgs, failure).status, 0);
			assert.equal(
				f.state().events.some((e) => e.args[2] === 'create'),
				false
			);
			assert.equal(f.git('ls-remote', '--tags', 'origin'), '');
		});
	}

	it('rejects missing publication inputs and bypassing the test gate through Bake arguments', () => {
		const f = fixture();
		for (const args of [
			['wikibase', '--publish'],
			['wikibase', '--', '--publish'],
			['wikibase', '--preflight', '--', '--pull']
		]) {
			assert.notEqual(f.cli(args).status, 0);
		}
		assert.deepEqual(f.state().events, []);
	});
});
