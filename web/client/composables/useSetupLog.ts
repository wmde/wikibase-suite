import { computed, ref } from 'vue';
import {
	BOOT_COMPLETE_REGEX,
	SETUP_PROGRESS_MARKERS,
	STATUS_LOG_ENTRY_REGEX
} from '../constants';

export function useSetupLog( onComplete: () => Promise<void> | void ) {
	const logText = ref( 'Loading logs...\n' );
	const statusLines = ref<string[]>( [] );
	const progress = ref( 0 );
	const summary = ref( 'Setup has started. Waiting for the first progress update.' );
	const hasStatusLines = computed( () => statusLines.value.length > 0 );
	let eventSource: EventSource | null = null;
	let handledComplete = false;

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

	function appendStatusLines( text: string ): void {
		const nextLines = text
			.split( '\n' )
			.map( ( line ) => line.match( STATUS_LOG_ENTRY_REGEX )?.[ 1 ]?.trim() || '' )
			.filter( Boolean );
		statusLines.value.push( ...nextLines );
	}

	function updateProgressFromLog( text: string ): void {
		const marker = SETUP_PROGRESS_MARKERS.find( ( candidate ) => candidate.pattern.test( text ) );
		if ( marker ) {
			setProgress( marker.progress, marker.summary );
		}
	}

	async function handleLogMessage( text: string ): Promise<void> {
		appendStatusLines( text );
		updateProgressFromLog( text );
		logText.value += text.endsWith( '\n' ) ? text : `${ text }\n`;

		if ( !handledComplete && BOOT_COMPLETE_REGEX.test( text ) ) {
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

	function resetForRun(): void {
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
		start
	};
}
