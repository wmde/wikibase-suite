import { describe, it } from 'mocha';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
	chmodSync,
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PROMOTE_LATEST = resolve('../.github/scripts/promote-wikibase-latest.sh');

function runPromotion(
	candidateVersion: string,
	currentVersion: string,
	publishedVersion = candidateVersion,
	options: { candidateIndex?: boolean; currentIndex?: boolean } = {}
): { status: number | null; output: string; calls: string[] } {
	const mockDirectory = mkdtempSync(join(tmpdir(), 'wbs-latest-promotion-'));
	const callsPath = join(mockDirectory, 'docker-calls');
	const dockerPath = join(mockDirectory, 'docker');
	writeFileSync(
		dockerPath,
		`#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$MOCK_DOCKER_CALLS"
if [[ "$1 $2 $3" == 'buildx imagetools inspect' ]]; then
  if [[ "$4" == 'wikibase/wikibase:latest' ]]; then
    [[ "$MOCK_CURRENT_VERSION" != UNREADABLE ]] || exit 1
    if [[ "$MOCK_CURRENT_INDEX" == true ]]; then
      printf '{"image":{"linux/amd64":{"config":{"Labels":{"org.opencontainers.image.version":"%s"}}}}}\\n' "$MOCK_CURRENT_VERSION"
    else
      printf '{"image":{"config":{"Labels":{"org.opencontainers.image.version":"%s"}}}}\\n' "$MOCK_CURRENT_VERSION"
    fi
  else
    if [[ "$MOCK_CANDIDATE_INDEX" == true ]]; then
      printf '{"manifest":{"digest":"sha256:%s"},"image":{"linux/amd64":{"config":{"Labels":{"org.opencontainers.image.version":"%s"}}}}}\\n' '${'a'.repeat(64)}' "$MOCK_PUBLISHED_VERSION"
    else
      printf '{"manifest":{"digest":"sha256:%s"},"image":{"config":{"Labels":{"org.opencontainers.image.version":"%s"}}}}\\n' '${'a'.repeat(64)}' "$MOCK_PUBLISHED_VERSION"
    fi
  fi
elif [[ "$1 $2 $3" != 'buildx imagetools create' ]]; then
  exit 2
fi
`
	);
	chmodSync(dockerPath, 0o755);
	try {
		const result = spawnSync(PROMOTE_LATEST, [candidateVersion], {
			encoding: 'utf8',
			env: {
				...process.env,
				PATH: `${mockDirectory}:${process.env.PATH}`,
				MOCK_DOCKER_CALLS: callsPath,
				MOCK_CURRENT_VERSION: currentVersion,
				MOCK_PUBLISHED_VERSION: publishedVersion,
				MOCK_CANDIDATE_INDEX: String(options.candidateIndex ?? false),
				MOCK_CURRENT_INDEX: String(options.currentIndex ?? false)
			}
		});
		const calls = existsSync(callsPath)
			? readFileSync(callsPath, 'utf8').trim().split('\n')
			: [];
		return {
			status: result.status,
			output: result.stdout + result.stderr,
			calls
		};
	} finally {
		rmSync(mockDirectory, { recursive: true, force: true });
	}
}

describe('Wikibase latest promotion', () => {
	it('promotes a newer patch within the current major', () => {
		const result = runPromotion('8.2.10', '8.2.9');
		assert.equal(result.status, 0, result.output);
		assert.match(
			result.calls.at(-1)!,
			/^buildx imagetools create --tag wikibase\/wikibase:latest wikibase\/wikibase@sha256:a{64}$/u
		);
	});

	it('promotes a new major version', () => {
		const result = runPromotion('9.0.0', '8.99.99');
		assert.equal(result.status, 0, result.output);
		assert.match(result.calls.at(-1)!, /imagetools create/u);
	});

	it('reads the AMD64 version from multi-platform image indexes', () => {
		const result = runPromotion('9.0.1', '9.0.0', '9.0.1', {
			candidateIndex: true,
			currentIndex: true
		});
		assert.equal(result.status, 0, result.output);
		assert.match(result.calls.at(-1)!, /imagetools create/u);
	});

	it('does not move latest back to an older release line', () => {
		const result = runPromotion('8.2.11', '9.0.0');
		assert.equal(result.status, 0, result.output);
		assert.ok(
			result.calls.every((call) => !call.includes('imagetools create'))
		);
	});

	it('leaves an equal version alone', () => {
		const result = runPromotion('9.0.0', '9.0.0');
		assert.equal(result.status, 0, result.output);
		assert.ok(
			result.calls.every((call) => !call.includes('imagetools create'))
		);
	});

	it('rejects a mismatched published image version', () => {
		const result = runPromotion('9.0.0', '8.2.1', '8.2.1');
		assert.notEqual(result.status, 0);
		assert.ok(
			result.calls.every((call) => !call.includes('imagetools create'))
		);
	});

	it('fails closed when current latest cannot be inspected', () => {
		const result = runPromotion('9.0.0', 'UNREADABLE');
		assert.notEqual(result.status, 0);
		assert.ok(
			result.calls.every((call) => !call.includes('imagetools create'))
		);
	});
});
