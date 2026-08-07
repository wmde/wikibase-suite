import crypto from 'crypto';
import express, {
	type NextFunction,
	type Request,
	type RequestHandler,
	type Response,
	type Router
} from 'express';

const INSTALLER_ACCESS_COOKIE = 'wbs_installer_access';
const MAX_ACCESS_FAILURES = 5;

export type AccessAttemptResult = 'granted' | 'invalid' | 'locked';

export interface AccessAttemptTracker {
	attempt( candidate: string ): AccessAttemptResult;
	attemptsRemaining(): number;
	isLocked(): boolean;
	matches( candidate: string ): boolean;
}

export interface InstallerAccess {
	publicRoutes: Router;
	requireAccess: RequestHandler;
}

export function createAccessAttemptTracker( accessCode: string ): AccessAttemptTracker {
	if ( !/^\d{6}$/.test( accessCode ) ) {
		throw new Error( 'INSTALLER_ACCESS_CODE must contain exactly six digits.' );
	}

	let failedAttempts = 0;

	function matches( candidate: string ): boolean {
		const expected = Buffer.from( accessCode );
		const received = Buffer.from( candidate );
		return expected.length === received.length && crypto.timingSafeEqual( expected, received );
	}

	return {
		attempt( candidate: string ): AccessAttemptResult {
			if ( failedAttempts >= MAX_ACCESS_FAILURES ) {
				return 'locked';
			}
			if ( matches( candidate ) ) {
				return 'granted';
			}

			failedAttempts++;
			return failedAttempts >= MAX_ACCESS_FAILURES ? 'locked' : 'invalid';
		},
		attemptsRemaining: () => Math.max( 0, MAX_ACCESS_FAILURES - failedAttempts ),
		isLocked: () => failedAttempts >= MAX_ACCESS_FAILURES,
		matches
	};
}

export function createInstallerAccess( accessCode: string ): InstallerAccess {
	const attempts = createAccessAttemptTracker( accessCode );

	function cookieValue( request: Request ): string {
		for ( const entry of ( request.headers.cookie || '' ).split( ';' ) ) {
			const separator = entry.indexOf( '=' );
			if ( separator === -1 ||
				entry.slice( 0, separator ).trim() !== INSTALLER_ACCESS_COOKIE
			) {
				continue;
			}
			try {
				return decodeURIComponent( entry.slice( separator + 1 ).trim() );
			} catch {
				return '';
			}
		}
		return '';
	}

	function hasAccess( req: Request ): boolean {
		return attempts.matches( cookieValue( req ) );
	}

	function grantAccess( res: Response ): void {
		res.cookie( INSTALLER_ACCESS_COOKIE, accessCode, {
			httpOnly: true,
			secure: true,
			sameSite: 'strict',
			path: '/'
		} );
	}

	// Safari has been observed returning to / instead of preserving /access/:code
	// after a user accepts a self-signed certificate. We have not tested whether
	// other browsers behave the same way, but manual code entry covers all such
	// cases as a fallback; reopening the URL then works normally.
	function renderAccessCodePage(
		result?: Exclude<AccessAttemptResult, 'granted'>
	): string {
		const attemptsRemaining = attempts.attemptsRemaining();
		const message = result === 'locked' ?
			'Too many incorrect attempts. Stop and restart the installer to generate a new access code.' :
			result === 'invalid' ?
				`That code is incorrect. ${ attemptsRemaining } ${ attemptsRemaining === 1 ? 'attempt' : 'attempts' } remaining.` :
				'';
		const disabled = result === 'locked' ? ' disabled' : '';

		return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Wikibase Suite Installer</title>
	<style>
		body { margin: 0; min-height: 100vh; background: #f8f9fa; color: #202122; font: 16px/1.5 sans-serif; }
		dialog { top: 50%; width: min(360px, calc(100% - 48px)); padding: 28px; border: 1px solid #a2a9b1; border-radius: 4px; box-shadow: 0 8px 24px rgba(0, 0, 0, .18); transform: translateY(-50%); }
		h1 { margin: 0 0 8px; font-size: 1.4rem; }
		p { margin: 0 0 20px; }
		label { display: block; margin-bottom: 6px; font-weight: 700; }
		input { width: 100%; padding: 9px 10px; border: 1px solid #72777d; border-radius: 2px; font: inherit; letter-spacing: .2em; box-sizing: border-box; }
		button { margin-top: 16px; padding: 9px 16px; border: 1px solid #36c; border-radius: 2px; background: #36c; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
		button:disabled { border-color: #c8ccd1; background: #c8ccd1; cursor: default; }
		.error { color: #b32424; }
	</style>
</head>
<body>
	<dialog open aria-labelledby="access-code-title">
		<h1 id="access-code-title">Enter installer access code</h1>
		<p>Enter the six-digit code shown in the terminal where you started the installer.</p>
		${ message ? `<p class="error" role="alert">${ message }</p>` : '' }
		<form action="/access" method="post">
			<label for="access-code">Access code</label>
			<input id="access-code" name="code" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required autofocus${ disabled } />
			<button type="submit"${ disabled }>Continue</button>
		</form>
	</dialog>
</body>
</html>`;
	}

	const publicRoutes = express.Router();
	const parseAccessForm = express.urlencoded( { extended: false } );
	publicRoutes.get( '/access/:code', ( req, res ) => {
		const result = attempts.attempt( req.params.code );
		if ( result === 'granted' ) {
			grantAccess( res );
		}
		res.redirect( 303, '/' );
	} );
	publicRoutes.post( '/access', parseAccessForm, ( req, res ): void => {
		const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
		const result = attempts.attempt( code );
		if ( result === 'granted' ) {
			grantAccess( res );
			res.redirect( 303, '/' );
			return;
		}

		res.status( result === 'locked' ? 429 : 401 ).type( 'html' ).send(
			renderAccessCodePage( result )
		);
	} );
	publicRoutes.get( '/', ( req, res, next ) => {
		if ( hasAccess( req ) ) {
			next();
			return;
		}
		res.status( 401 ).type( 'html' ).send( renderAccessCodePage(
			attempts.isLocked() ? 'locked' : undefined
		) );
	} );

	function requireAccess( req: Request, res: Response, next: NextFunction ): void {
		if ( hasAccess( req ) ) {
			next();
			return;
		}

		res.status( 401 ).type( 'text' ).send(
			'This installer session is unavailable or has expired. ' +
			'Return to the server terminal and open the installer URL printed there.'
		);
	}

	return { publicRoutes, requireAccess };
}
