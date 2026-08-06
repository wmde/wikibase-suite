import { spawn } from 'node:child_process';

export async function runProcess(
	command: string,
	args: string[],
	options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<void> {
	await new Promise<void>( ( resolve, reject ) => {
		const child = spawn( command, args, {
			cwd: options.cwd,
			env: options.env ?? process.env,
			stdio: 'inherit'
		} );
		child.once( 'error', reject );
		child.once( 'exit', ( code, signal ) => {
			if ( signal ) {
				reject( new Error( `${ command } terminated by ${ signal }.` ) );
			} else if ( code !== 0 ) {
				reject( new Error( `${ command } exited with status ${ code ?? 'unknown' }.` ) );
			} else {
				resolve();
			}
		} );
	} );
}
