import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseEnv, promisify } from 'node:util';
import { applyInstallationManifest } from './installation-manifest.js';

const execFileAsync = promisify( execFile );
const STABLE_RELEASE_REF = /^wbs@(\d+)\.\d+\.\d+$/u;

async function latestStableRef( repository: string ): Promise<string> {
	const { stdout } = await execFileAsync( 'git', [
		'ls-remote', '--tags', '--refs', repository, 'refs/tags/wbs@*'
	] );
	const refs = stdout.split( '\n' )
		.map( ( line ) => line.split( '\t' )[ 1 ]?.replace( 'refs/tags/', '' ) )
		.filter( ( ref ): ref is string => STABLE_RELEASE_REF.test( ref ?? '' ) )
		.sort( ( left, right ) => {
			const a = left.slice( 4 ).split( '.' ).map( Number );
			const b = right.slice( 4 ).split( '.' ).map( Number );
			return b[ 0 ] - a[ 0 ] || b[ 1 ] - a[ 1 ] || b[ 2 ] - a[ 2 ];
		} );
	if ( !refs[ 0 ] ) {
		throw new Error( `No stable Wikibase Suite release was found in ${ repository }.` );
	}
	return refs[ 0 ];
}

async function trackBranch( target: string, branch: string ): Promise<void> {
	const git = ( ...args: string[] ) => execFileAsync( 'git', [ '-C', target, ...args ] );
	const remoteHead = `refs/heads/${ branch }`;
	const upstream = `refs/remotes/origin/${ branch }`;
	await git( 'check-ref-format', remoteHead );
	await git( 'check-ref-format', '--branch', branch );
	const { stdout: advertised } = await git( 'ls-remote', '--heads', 'origin', remoteHead );
	if ( !advertised.trim() ) {
		return;
	}

	// The initial tag or SHA fetch can be shallow. Get enough history to verify
	// that the selected checkout can fast-forward to the branch.
	const { stdout: shallow } = await git( 'rev-parse', '--is-shallow-repository' );
	const depthOptions = shallow.trim() === 'true' ? [ '--unshallow' ] : [];
	await git( 'fetch', '--quiet', '--no-tags', ...depthOptions, 'origin', `${ remoteHead }:${ upstream }` );
	const { stdout: containsHead } = await git(
		'for-each-ref', '--contains', 'HEAD', '--format=%(refname)', upstream
	);
	if ( containsHead.trim() !== upstream ) {
		return;
	}
	await git( 'remote', 'set-branches', 'origin', branch );
	await git( 'switch', '--quiet', '--create', branch );
	await git( 'branch', `--set-upstream-to=origin/${ branch }` );
	console.log( `Tracking origin/${ branch } from the selected checkout.` );
}

export async function prepareRepository( options: {
	target: string;
	repository: string;
	ref?: string;
	manifestUrl?: string;
} ): Promise<void> {
	if ( existsSync( join( options.target, '.git' ) ) ) {
		console.log( `Wikibase Suite already exists at ${ options.target }.` );
		return;
	}
	const ref = options.ref || await latestStableRef( options.repository );
	const targetExisted = existsSync( options.target );
	try {
		mkdirSync( dirname( options.target ), { recursive: true } );
		if ( /^[0-9a-f]{40}$/u.test( ref ) ) {
			await execFileAsync( 'git', [ 'init', '--quiet', options.target ] );
			await execFileAsync( 'git', [ '-C', options.target, 'remote', 'add', 'origin', options.repository ] );
			await execFileAsync( 'git', [ '-C', options.target, 'fetch', '--quiet', '--depth', '1', 'origin', ref ] );
			await execFileAsync( 'git', [ '-C', options.target, 'checkout', '--quiet', '--detach', 'FETCH_HEAD' ] );
		} else {
			await execFileAsync( 'git', [
				'clone', '--branch', ref, '--single-branch', '--depth', '1',
				options.repository, options.target
			] );
		}
		const { stdout: resolvedShaOutput } = await execFileAsync(
			'git', [ '-C', options.target, 'rev-parse', 'HEAD' ]
		);
		const resolvedSha = resolvedShaOutput.trim();
		if ( /^[0-9a-f]{40}$/u.test( ref ) && resolvedSha !== ref ) {
			throw new Error( `Checkout resolved to ${ resolvedSha }, expected ${ ref }.` );
		}
		const release = STABLE_RELEASE_REF.exec( ref );
		const trackingBranch = options.manifestUrl ?
			await applyInstallationManifest( {
				repositoryRoot: options.target,
				manifestUrl: options.manifestUrl,
				resolvedSha
			} ) :
			release && `release/wbs-${ release[ 1 ] }`;
		if ( trackingBranch ) {
			try {
				await trackBranch( options.target, trackingBranch );
			} catch ( error ) {
				console.warn( 'Could not configure the checkout to track its upstream branch.', error );
			}
		}
		const versionPath = join( options.target, '.wbs/version' );
		const version = existsSync( versionPath ) ?
			parseEnv( readFileSync( versionPath, 'utf8' ) ).WBS_VERSION :
			undefined;
		console.log( `Checked out ${ ref } at ${ resolvedSha }${ version ? ` (Wikibase Suite ${ version })` : '' } in ${ options.target }.` );
	} catch ( error ) {
		if ( !targetExisted ) {
			rmSync( options.target, { recursive: true, force: true } );
		}
		throw error;
	}
}
