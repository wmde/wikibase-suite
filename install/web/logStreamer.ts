/* eslint-disable security/detect-non-literal-fs-filename */
import { createReadStream, existsSync } from 'fs';
import { stat } from 'fs/promises';
import type { Session } from 'better-sse';

export interface LogStreamer {
	start( intervalMs?: number ): void;
	register( session: Session, lastEventId?: string ): Promise<() => void>;
}

export function createLogStreamer( logPath: string ): LogStreamer {
	let offset = 0; // last byte read
	let leftover = ''; // partial line carried to next chunk
	let seq = 0; // SSE id counter
	const sessions = new Set<Session>();

	async function streamRange( start: number, end: number, to?: Session ): Promise<void> {
		if ( end < start ) {
			return;
		}
		const rs = createReadStream( logPath, { start, end, encoding: 'utf8' } );

		for await ( const chunk of rs ) {
			const combined = leftover + chunk;
			const lines = combined.split( '\n' );
			leftover = lines.pop() ?? ''; // keep incomplete tail

			for ( const line of lines ) {
				if ( !line ) {
					continue;
				}
				const id = String( ++seq );
				if ( to ) {
					to.push( line, undefined, id );
				} else {
					for ( const s of sessions ) {
						s.push( line, undefined, id );
					}
				}
			}
		}
	}

	async function tick(): Promise<void> {
		if ( !existsSync( logPath ) ) {
			offset = 0;
			leftover = '';
			return;
		}
		const { size } = await stat( logPath );

		if ( size < offset ) {
			offset = 0;
			leftover = '';
		} // rotated/truncated
		if ( size > offset ) {
			await streamRange( offset, size - 1 );
			offset = size;
		}
	}

	return {
		start( intervalMs: number = 1000 ): void {
			setInterval( () => {
				tick();
			}, intervalMs );
		},
		async register( session: Session, lastEventId?: string ): Promise<() => void> {
			sessions.add( session );

			// Fresh connect → one-time backfill; reconnect (Last-Event-ID present) → skip
			if ( !lastEventId && existsSync( logPath ) ) {
				const { size } = await stat( logPath );
				if ( size > 0 ) {
					await streamRange( 0, size - 1, session );
				}
				offset = size;
			}

			return (): void => {
				sessions.delete( session );
			};
		}
	};
}
