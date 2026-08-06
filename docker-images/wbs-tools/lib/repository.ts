import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify( execFile );

async function latestStableRef( repository: string ): Promise<string> {
	const { stdout } = await execFileAsync( 'git', [
		'ls-remote', '--tags', '--refs', repository, 'refs/tags/wbs@*'
	] );
	const refs = stdout.split( '\n' )
		.map( ( line ) => line.split( '\t' )[ 1 ]?.replace( 'refs/tags/', '' ) )
		.filter( ( ref ): ref is string => /^wbs@\d+\.\d+\.\d+$/u.test( ref ) )
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

export async function prepareRepository( options: {
	target: string;
	repository: string;
	ref?: string;
} ): Promise<void> {
	if ( existsSync( join( options.target, '.git' ) ) ) {
		console.log( `Wikibase Suite already exists at ${ options.target }.` );
		return;
	}
	const ref = options.ref || await latestStableRef( options.repository );
	mkdirSync( dirname( options.target ), { recursive: true } );
	await execFileAsync( 'git', [
		'clone', '--branch', ref, '--single-branch', '--depth', '1',
		options.repository, options.target
	] );
	const packagePath = join( options.target, 'package.json' );
	const version = existsSync( packagePath ) ?
		( JSON.parse( readFileSync( packagePath, 'utf8' ) ) as { version?: string } ).version :
		undefined;
	console.log( `Checked out ${ ref }${ version ? ` (Wikibase Suite ${ version })` : '' } at ${ options.target }.` );
}
