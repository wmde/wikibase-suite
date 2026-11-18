import { describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
	chmodSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readWbsVersionManifest } from '../../lib/wbs-version.js';

describe('WBS installation image selection', () => {
	it('does not announce Docker when it is already installed', () => {
		const fixture = mkdtempSync(join(tmpdir(), 'wbs-docker-preflight-'));
		const fakeDocker = join(fixture, 'docker');
		writeFileSync(
			fakeDocker,
			`#!/bin/sh
case "$*" in
  "--version") echo "Docker version 28.0.0" ;;
  "compose version") echo "Docker Compose version v2.30.0" ;;
esac
exit 0
`
		);
		chmodSync(fakeDocker, 0o755);

		try {
			const result = spawnSync(
				'bash',
				[
					'-c',
					'source "$1"; SCRIPTS_DIR="$(dirname "$1")"; ' +
						'WBS_SKIP_DEPENDENCY_INSTALLS=false; ' +
						'DEBUG=false; prepare_install_runtime',
					'bash',
					resolve('../scripts/run-wbs-tools.sh')
				],
				{
					encoding: 'utf8',
					env: {
						...process.env,
						PATH: `${fixture}:${process.env.PATH}`,
						WBS_LOG_PATH: join(fixture, 'wbs.log')
					}
				}
			);
			assert.equal(result.status, 0, result.stderr);
			assert.doesNotMatch(result.stdout, /Docker installed/u);
		} finally {
			rmSync(fixture, { recursive: true, force: true });
		}
	});

	it('keeps the WBS release and bootstrap on its exact tools image', () => {
		const expectedImage = readWbsVersionManifest(
			readFileSync(resolve('../.wbs/version'), 'utf8')
		).toolsImage;
		assert.match(expectedImage, /:\d+\.\d+\.\d+$/u);
		const versionsScript = resolve('../scripts/_versions.sh');
		const selectedImage = execFileSync(
			'bash',
			[
				'-c',
				'source "$1"; printf "%s" "$WBS_TOOLS_IMAGE"',
				'bash',
				versionsScript
			],
			{
				encoding: 'utf8',
				env: {
					...process.env,
					WBS_DIR: resolve('..'),
					WBS_TOOLS_IMAGE: ''
				}
			}
		);

		assert.equal(selectedImage, expectedImage);
		assert.ok(
			readFileSync(resolve('../install'), 'utf8').includes(
				`WBS_TOOLS_IMAGE="\${WBS_TOOLS_IMAGE:-${expectedImage}}"`
			)
		);
	});

	it('runs development lifecycle commands with the local tools image', () => {
		const fixture = mkdtempSync(join(tmpdir(), 'wbs-development-launcher-'));
		const dockerLog = join(fixture, 'docker.log');
		const fakeDocker = join(fixture, 'docker');
		writeFileSync(
			fakeDocker,
			`#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_DOCKER_LOG"
exit 0
`
		);
		chmodSync(fakeDocker, 0o755);

		try {
			const result = spawnSync(resolve('wbs'), ['status'], {
				encoding: 'utf8',
				env: {
					...process.env,
					FAKE_DOCKER_LOG: dockerLog,
					PATH: `${fixture}:${process.env.PATH}`,
					WBS_DIR: fixture,
					WBS_TOOLS_IMAGE: '',
					WBS_TOOLS_SKIP_PULL: ''
				}
			});
			assert.equal(result.status, 0, result.stderr);
			assert.doesNotMatch(result.stdout, /Docker installed/u);
			const commands = readFileSync(dockerLog, 'utf8');
			assert.match(commands, /image inspect wikibase\/wbs-tools:latest/u);
			assert.match(commands, /node \/app\/dist\/wbs\.js status/u);
			assert.doesNotMatch(
				commands,
				/^(?:info|pull|--version|compose version)/mu
			);
		} finally {
			rmSync(fixture, { recursive: true, force: true });
		}
	});

	it('pulls a missing tools image once before running a lifecycle command', () => {
		const fixture = mkdtempSync(join(tmpdir(), 'wbs-tools-runtime-'));
		const dockerLog = join(fixture, 'docker.log');
		const imageReady = join(fixture, 'image-ready');
		const fakeDocker = join(fixture, 'docker');
		writeFileSync(
			fakeDocker,
			`#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_DOCKER_LOG"
if [ "$1 $2" = "image inspect" ]; then
  test -f "$FAKE_IMAGE_READY"
elif [ "$1" = "pull" ]; then
  touch "$FAKE_IMAGE_READY"
fi
`
		);
		chmodSync(fakeDocker, 0o755);

		try {
			const result = spawnSync(
				resolve('../scripts/run-wbs-tools.sh'),
				['status'],
				{
					encoding: 'utf8',
					env: {
						...process.env,
						FAKE_DOCKER_LOG: dockerLog,
						FAKE_IMAGE_READY: imageReady,
						PATH: `${fixture}:${process.env.PATH}`,
						WBS_DIR: fixture,
						WBS_LOG_PATH: join(fixture, 'wbs.log'),
						WBS_TOOLS_IMAGE: 'example/wbs-tools:9'
					}
				}
			);
			assert.equal(result.status, 0, result.stderr);
			const commands = readFileSync(dockerLog, 'utf8');
			assert.match(commands, /^image inspect example\/wbs-tools:9$/mu);
			assert.match(commands, /^pull example\/wbs-tools:9$/mu);
			assert.match(
				commands,
				/^run .*example\/wbs-tools:9 node \/app\/dist\/wbs\.js status$/mu
			);
		} finally {
			rmSync(fixture, { recursive: true, force: true });
		}
	});

	it('fails clearly when a missing tools image cannot be pulled', () => {
		const fixture = mkdtempSync(join(tmpdir(), 'wbs-tools-runtime-failure-'));
		const fakeDocker = join(fixture, 'docker');
		writeFileSync(
			fakeDocker,
			`#!/bin/sh
if [ "$1 $2" = "image inspect" ] || [ "$1" = "pull" ]; then
  exit 1
fi
`
		);
		chmodSync(fakeDocker, 0o755);

		try {
			const logPath = join(fixture, 'wbs.log');
			const result = spawnSync(
				resolve('../scripts/run-wbs-tools.sh'),
				['status'],
				{
					encoding: 'utf8',
					env: {
						...process.env,
						PATH: `${fixture}:${process.env.PATH}`,
						WBS_DIR: fixture,
						WBS_LOG_PATH: logPath,
						WBS_TOOLS_IMAGE: 'example/wbs-tools:missing'
					}
				}
			);
			assert.notEqual(result.status, 0);
			assert.match(
				readFileSync(logPath, 'utf8'),
				/Could not pull example\/wbs-tools:missing\. For an unpublished source checkout, rerun wbs install with --from-source\./u
			);
		} finally {
			rmSync(fixture, { recursive: true, force: true });
		}
	});
});

describe('WBS lifecycle command contracts', () => {
	function runLifecycle(
		command: string,
		failure = false
	): {
		status: number | null;
		output: string;
		calls: string;
	} {
		const root = mkdtempSync(join(tmpdir(), 'wbs-lifecycle-'));
		try {
			writeFileSync(
				join(root, '.env'),
				[
					'WIKIBASE_PUBLIC_HOST=wikibase.test',
					'WDQS_PUBLIC_HOST=query.wikibase.test',
					'MW_ADMIN_NAME=Admin',
					'MW_ADMIN_EMAIL=admin@example.test',
					'MW_ADMIN_PASS=test-admin-password',
					'DB_PASS=test-db-password',
					'DB_NAME=my_wiki',
					'DB_USER=sqluser'
				].join('\n')
			);
			writeFileSync(join(root, 'docker-compose.yml'), 'services: {}\n');
			writeFileSync(
				join(root, 'docker'),
				`#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_DOCKER_LOG"
if [ "$FAKE_DOCKER_FAILURE" = true ]; then
  echo 'Cannot connect to Docker daemon' >&2
  exit 1
fi
case "$*" in
  *'ps --services --status running') echo mysql ;;
  *'ps --all') echo 'wikibase exited'; echo 'mysql running' ;;
esac
`,
				{ mode: 0o755 }
			);
			const log = join(root, 'docker.log');
			const result = spawnSync(
				process.execPath,
				['--import=tsx', resolve('images/wbs-tools/wbs.ts'), command],
				{
					encoding: 'utf8',
					env: {
						...process.env,
						PATH: `${root}:${process.env.PATH}`,
						WBS_DIR: root,
						ENV_FILE_PATH: join(root, '.env'),
						WBS_LOG_PATH: join(root, 'wbs.log'),
						FAKE_DOCKER_LOG: log,
						FAKE_DOCKER_FAILURE: String(failure)
					}
				}
			);
			return {
				status: result.status,
				output: result.stdout + result.stderr,
				calls: readFileSync(log, 'utf8')
			};
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	}

	it('reconciles a partially running stack instead of returning early', () => {
		const result = runLifecycle('up');
		assert.equal(result.status, 0, result.output);
		assert.match(result.calls, /up --detach --wait/u);
		assert.doesNotMatch(result.output, /already running/u);
	});

	it('removes stopped containers through Compose down', () => {
		const result = runLifecycle('down');
		assert.equal(result.status, 0, result.output);
		assert.match(result.calls, / down$/mu);
	});

	it('shows stopped services alongside running services', () => {
		const result = runLifecycle('status');
		assert.equal(result.status, 0, result.output);
		assert.match(result.output, /wikibase exited/u);
		assert.match(result.output, /mysql running/u);
	});

	for (const command of ['up', 'down', 'status']) {
		it(`fails visibly when Docker fails during ${command}`, () => {
			const result = runLifecycle(command, true);
			assert.notEqual(result.status, 0);
			assert.match(result.output, /Cannot connect to Docker daemon/u);
			assert.doesNotMatch(result.output, /not currently running/u);
		});
	}
});
