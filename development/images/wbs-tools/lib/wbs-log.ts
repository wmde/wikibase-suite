import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const WBS_LOG_PATH = process.env.WBS_LOG_PATH || '';

let processOutputIsCaptured = false;

export function appendWbsLogEntry( message: string, code?: string ): void {
	if ( !WBS_LOG_PATH ) {
		return;
	}
	mkdirSync( dirname( WBS_LOG_PATH ), { recursive: true } );
	appendFileSync(
		WBS_LOG_PATH,
		`${ new Date().toISOString() } ${ message }${ code ? ` [${ code }]` : '' }\n`
	);
}

function mirrorProcessStream( stream: NodeJS.WriteStream ): void {
	const originalWrite = stream.write.bind( stream ) as ( ...args: unknown[] ) => boolean;
	stream.write = ( (
		chunk: string | Uint8Array,
		encodingOrCallback?: BufferEncoding | ( () => void ),
		callback?: () => void
	): boolean => {
		appendFileSync( WBS_LOG_PATH, chunk );
		return originalWrite( chunk, encodingOrCallback, callback );
	} ) as typeof stream.write;
}

export function captureProcessOutputInWbsLog(): void {
	if ( !WBS_LOG_PATH || processOutputIsCaptured ) {
		return;
	}
	mkdirSync( dirname( WBS_LOG_PATH ), { recursive: true } );
	processOutputIsCaptured = true;
	mirrorProcessStream( process.stdout );
	mirrorProcessStream( process.stderr );
}
