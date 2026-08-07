import assert from 'node:assert/strict';
import { createAccessAttemptTracker } from '../../images/wbs-tools/web/installer-access.js';

describe( 'Installer access control', () => {
	it( 'locks after five incorrect submissions', () => {
		const attempts = createAccessAttemptTracker( '482193' );
		assert.equal( attempts.attempt( '482193' ), 'granted' );

		for ( let attempt = 1; attempt < 5; attempt++ ) {
			assert.equal( attempts.attempt( '000000' ), 'invalid' );
			assert.equal( attempts.attemptsRemaining(), 5 - attempt );
		}

		assert.equal( attempts.attempt( '000000' ), 'locked' );
		assert.equal( attempts.attemptsRemaining(), 0 );
		assert.equal( attempts.attempt( '482193' ), 'locked' );
	} );
} );
