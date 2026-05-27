import { computed, ref } from 'vue';
import {
	DEBUG_LOG_SUFFIX_REGEX,
	SETUP_PROGRESS_EVENTS,
	SETUP_PROGRESS_TIMER_TICK_MS,
	SETUP_STATUS_LINE_LIMIT,
	STATUS_CODE_SUFFIX_REGEX,
	TIMESTAMPED_LOG_ENTRY_REGEX
} from '../constants';

type ParsedStatusLine = {
	message: string;
	code?: string;
};

export function useSetupLog( onComplete: () => Promise<void> | void ) {
	const logText = ref( 'Loading logs...\n' );
	const statusLines = ref<string[]>( [] );
	const progress = ref( 0 );
	const summary = ref( 'Setup has started. Waiting for the first progress update.' );
	const hasStatusLines = computed( () => statusLines.value.length > 0 );
	let eventSource: EventSource | null = null;
	let handledComplete = false;
	let progressTimer: number | null = null;
	let progressTimerStartedAt = 0;
	let progressTimerFrom = 0;
	let progressTimerTarget = 95;

	function stopProgressTimer(): void {
		if ( progressTimer !== null ) {
			window.clearInterval( progressTimer );
			progressTimer = null;
		}
	}

	function startProgressTimer( fromProgress: number, targetProgress: number, durationMs: number ): void {
		const safeFrom = Math.max( 0, Math.min( 100, fromProgress ) );
		const safeTarget = Math.max( safeFrom, Math.min( 95, targetProgress ) );
		if ( progressTimer !== null && progressTimerFrom >= safeFrom ) {
			return;
		}

		stopProgressTimer();
		progressTimerFrom = safeFrom;
		progressTimerTarget = safeTarget;
		progressTimerStartedAt = Date.now();
		progressTimer = window.setInterval( () => {
			const elapsed = Date.now() - progressTimerStartedAt;
			const ratio = Math.min( 1, elapsed / durationMs );
			const nextProgress = safeFrom + ( ( safeTarget - safeFrom ) * ratio );
			setProgress( nextProgress );

			if ( ratio >= 1 ) {
				stopProgressTimer();
			}
		}, SETUP_PROGRESS_TIMER_TICK_MS );
	}

	function setProgress( nextProgress: number, nextSummary?: string ): void {
		const safeProgress = Math.max( 0, Math.min( 100, nextProgress ) );
		if ( safeProgress < progress.value ) {
			return;
		}
		progress.value = safeProgress;
		if ( nextSummary ) {
			summary.value = nextSummary;
		}
	}

	function parseStatusLines( text: string ): ParsedStatusLine[] {
		return text
			.split( '\n' )
			.map( parseStatusLine )
			.filter( ( line ): line is ParsedStatusLine => line !== null );
	}

	function parseStatusLine( line: string ): ParsedStatusLine | null {
		const message = line.match( TIMESTAMPED_LOG_ENTRY_REGEX )?.[ 1 ]?.trim();
		if ( !message || DEBUG_LOG_SUFFIX_REGEX.test( message ) ) {
			return null;
		}

		const code = message.match( STATUS_CODE_SUFFIX_REGEX )?.[ 1 ];
		return {
			message: code ? message.replace( STATUS_CODE_SUFFIX_REGEX, '' ).trim() : message,
			code
		};
	}

	function appendStatusLines( lines: ParsedStatusLine[] ): void {
		for ( const line of lines ) {
			if ( statusLines.value.at( -1 ) === line.message ) {
				continue;
			}
			statusLines.value.push( line.message );
		}

		if ( statusLines.value.length > SETUP_STATUS_LINE_LIMIT ) {
			statusLines.value = statusLines.value.slice( -SETUP_STATUS_LINE_LIMIT );
		}
	}

	function updateProgressFromStatusCode( code: string | undefined ): void {
		if ( !code ) {
			return;
		}

		const marker = SETUP_PROGRESS_EVENTS[ code ];
		if ( marker ) {
			if ( marker.startTimer ) {
				startProgressTimer(
					marker.progress,
					marker.timerTarget ?? 95,
					marker.timerMs ?? SETUP_PROGRESS_TIMER_TICK_MS
				);
			}
			if ( marker.stopTimer ) {
				stopProgressTimer();
			}
			setProgress( marker.progress, marker.summary );
		}
	}

	async function handleLogMessage( text: string ): Promise<void> {
		const parsedStatusLines = parseStatusLines( text );
		appendStatusLines( parsedStatusLines );
		for ( const line of parsedStatusLines ) {
			updateProgressFromStatusCode( line.code );
		}
		logText.value += text.endsWith( '\n' ) ? text : `${ text }\n`;

		if ( !handledComplete && parsedStatusLines.some( ( line ) => line.code === 'setup_complete' ) ) {
			handledComplete = true;
			await onComplete();
		}
	}

	function start(): void {
		if ( eventSource ) {
			return;
		}

		eventSource = new EventSource( '/log/stream', { withCredentials: false } );
		eventSource.onmessage = ( event ) => {
			if ( !event.data ) {
				return;
			}
			void handleLogMessage( JSON.parse( event.data ) );
		};
		eventSource.onerror = () => {
			// EventSource reconnects automatically; keep the UI calm while that happens.
			console.log( 'SSE error (will auto-reconnect)' );
		};
	}

	function stop(): void {
		stopProgressTimer();
		if ( eventSource ) {
			eventSource.close();
			eventSource = null;
		}
	}

	function resetForRun(): void {
		stopProgressTimer();
		logText.value = 'Loading logs...\n';
		statusLines.value = [];
		progress.value = 0;
		summary.value = 'Setup has started. Waiting for the first progress update.';
		handledComplete = false;
	}

	return {
		logText,
		statusLines,
		hasStatusLines,
		progress,
		summary,
		setProgress,
		resetForRun,
		start,
		stop
	};
}
