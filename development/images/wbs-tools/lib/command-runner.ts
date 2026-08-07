import { spawn } from 'node:child_process';
import { appendWbsLogEntry, WBS_LOG_PATH } from './wbs-log.js';

export async function runProcess(
	command: string,
	args: string[],
	options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<void> {
	const renderedCommand = [ command, ...args ].map( ( argument ) =>
		JSON.stringify( argument )
	).join( ' ' );
	appendWbsLogEntry( `BEGIN RUN: ${ renderedCommand }`, 'debug' );
	try {
		await new Promise<void>( ( resolve, reject ) => {
			const child = spawn( command, args, {
				cwd: options.cwd,
				env: options.env ?? process.env,
				stdio: WBS_LOG_PATH ? [ 'inherit', 'pipe', 'pipe' ] : 'inherit'
			} );
			child.stdout?.pipe( process.stdout, { end: false } );
			child.stderr?.pipe( process.stderr, { end: false } );
			child.once( 'error', reject );
			child.once( 'close', ( code, signal ) => {
				if ( signal ) {
					reject( new Error( `${ command } terminated by ${ signal }.` ) );
				} else if ( code !== 0 ) {
					reject( new Error(
						`${ command } exited with status ${ code ?? 'unknown' }.`
					) );
				} else {
					resolve();
				}
			} );
		} );
	} finally {
		appendWbsLogEntry( 'END RUN', 'debug' );
	}
}
