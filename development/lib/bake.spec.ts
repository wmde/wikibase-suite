import { describe, it } from 'mocha';
import assert from 'node:assert/strict';
import {
	readBakeScalar,
	readBakeValue,
	replaceBakeValue,
	resolveBakeVariables
} from './bake.js';

const manifest = `# ünicode keeps source offsets honest
variable "IMAGE_VERSION" { default = "8.0.0" } # retained

variable "SOURCE" {
  default = {
    commit     = "old"
    commit_url = "https://example.test/old" # retained too
  }
}
`;

describe('Bake manifest editing', () => {
	it('reads scalar and object string literals from HCL', () => {
		assert.equal(readBakeScalar(manifest, 'IMAGE_VERSION'), '8.0.0');
		assert.equal(readBakeValue(manifest, 'SOURCE', 'commit'), 'old');
	});

	it('replaces only the exact literal while preserving formatting and comments', () => {
		const expected = manifest.replace(
			'commit     = "old"',
			'commit     = "new\\nvalue"'
		);
		assert.equal(
			replaceBakeValue(manifest, 'SOURCE', 'commit', 'new\nvalue'),
			expected
		);
	});

	it('does not mistake similar variable or attribute names for the target', () => {
		const updated = replaceBakeValue(
			manifest,
			'SOURCE',
			'commit_url',
			'https://new.example/'
		);
		assert.equal(readBakeValue(updated, 'SOURCE', 'commit'), 'old');
		assert.equal(
			readBakeValue(updated, 'SOURCE', 'commit_url'),
			'https://new.example/'
		);
	});

	it('rejects malformed HCL and computed values', () => {
		assert.throws(
			() => readBakeScalar('variable "X" { default = "broken"', 'X'),
			/Could not parse/u
		);
		assert.throws(
			() => readBakeScalar('variable "X" { default = "${OTHER}" }', 'X'),
			/no string default attribute/u
		);
	});

	it('resolves checked-in defaults independently of the shell environment', () => {
		const previous = process.env.IMAGE_VERSION;
		process.env.IMAGE_VERSION = '99.0.0';
		try {
			assert.equal(
				resolveBakeVariables(manifest, process.cwd()).get('IMAGE_VERSION'),
				'8.0.0'
			);
		} finally {
			if (previous === undefined) {
				delete process.env.IMAGE_VERSION;
			} else {
				process.env.IMAGE_VERSION = previous;
			}
		}
	});
});
