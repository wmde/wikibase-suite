import { promises as dns } from 'dns';
import express, { type Router } from 'express';
import { validateConfigurationPassword } from '../../lib/password-policy.js';
import {
	canSkipDnsValidation,
	isValidHostname
} from '../../lib/validation.js';
import { isLocalMode } from '../../lib/configuration.js';

export function createValidationRouter( serverIp: string ): Router {
	const router = express.Router();

	router.post( '/password', async ( req, res ): Promise<void> => {
		try {
			const password = typeof req.body?.password === 'string' ? req.body.password : '';
			const validation = validateConfigurationPassword( password );
			res.status( 200 ).json( validation );
		} catch ( err ) {
			console.error( 'Failed to validate password:', err );
			res.status( 500 ).json( { valid: false, reason: 'validation-error' } );
		}
	} );

	router.post( '/hostname', async ( req, res ): Promise<void> => {
		const hostname = typeof req.body?.hostname === 'string' ? req.body.hostname.trim() : '';
		const localMode = isLocalMode();

		if ( !hostname ) {
			res.status( 200 ).json( { valid: false, reason: 'empty-hostname' } );
			return;
		}

		if ( !isValidHostname( hostname, localMode ) ) {
			res.status( 200 ).json( { valid: false, reason: 'invalid-hostname' } );
			return;
		}

		if ( canSkipDnsValidation( hostname, localMode ) ) {
			res.status( 200 ).json( { valid: true, addresses: [ hostname ], expected: hostname } );
			return;
		}

		if ( !serverIp ) {
			res.status( 200 ).json( { valid: false, reason: 'missing-server-ip' } );
			return;
		}

		try {
			const addresses = await dns.resolve4( hostname );
			res.status( 200 ).json( {
				valid: addresses.includes( serverIp ),
				addresses,
				expected: serverIp,
				reason: addresses.includes( serverIp ) ? undefined : 'address-mismatch'
			} );
		} catch ( error ) {
			console.error( `Failed to resolve hostname ${ hostname }:`, error );
			res.status( 200 ).json( {
				valid: false,
				addresses: [],
				expected: serverIp,
				reason: 'dns-lookup-failed'
			} );
		}
	} );

	return router;
}
