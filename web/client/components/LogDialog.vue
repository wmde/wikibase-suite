<template>
	<cdx-dialog
		:open="open"
		title="Setup log"
		subtitle="Use the live log when you need more detail than the step-by-step status summary provides."
		use-close-button
		class="setup-log-dialog"
		:default-action="{ label: 'Close' }"
		@update:open="emit( 'update:open', $event )"
		@default="emit( 'update:open', false )"
	>
		<div class="setup-log-dialog__frame">
			<div
				ref="logScroll"
				class="setup-log-dialog__scroll"
				@scroll="updateLogPosition"
			>
				<pre id="log-content">{{ logText }}</pre>
			</div>
			<div class="setup-log-dialog__actions">
				<button
					type="button"
					class="setup-log-dialog__action"
					:class="{ 'is-copied': copied }"
					:aria-label="copied ? 'Copied log' : 'Copy log'"
					:title="copied ? 'Copied log' : 'Copy log'"
					@click="copyLog"
				>
					<cdx-icon :icon="copied ? cdxIconCheck : cdxIconCopy" size="small" />
				</button>
				<button
					v-if="!atLatest"
					type="button"
					class="setup-log-dialog__action"
					:class="{ 'has-new-entries': hasNewEntries }"
					aria-label="Scroll to latest log entry"
					title="Scroll to latest log entry"
					@click="scrollToLatest"
				>
					<cdx-icon :icon="cdxIconArrowDown" size="small" />
				</button>
			</div>
		</div>

		<template #footer>
			<div class="shutdown-panel">
				<cdx-button
					action="destructive"
					:disabled="finalizing"
					@click="finalize"
				>
					Shut down installer
				</cdx-button>
				<span class="shutdown-panel__message">{{ shutdownMessage }}</span>
			</div>
		</template>
	</cdx-dialog>
</template>

<script setup lang="ts">
import { CdxButton, CdxDialog, CdxIcon } from '@wikimedia/codex';
import { cdxIconArrowDown, cdxIconCheck, cdxIconCopy } from '@wikimedia/codex-icons';
import { nextTick, ref, watch } from 'vue';

const props = defineProps<{
	open: boolean;
	logText: string;
}>();

const emit = defineEmits<{
	'update:open': [ value: boolean ];
}>();

const finalizing = ref( false );
const shutdownMessage = ref( '' );
const logScroll = ref<HTMLElement | null>( null );
const atLatest = ref( true );
const hasNewEntries = ref( false );
const copied = ref( false );
let copyResetTimer: number | undefined;

watch(
	() => props.logText,
	( text, previousText ) => {
		if ( previousText && text !== previousText && !atLatest.value ) {
			hasNewEntries.value = true;
		}
	}
);

watch(
	() => props.open,
	( open ) => {
		if ( open ) {
			void nextTick( updateLogPosition );
		}
	}
);

function updateLogPosition(): void {
	const scroll = logScroll.value;
	if ( !scroll ) {
		return;
	}

	atLatest.value = Math.abs( scroll.scrollTop ) < 2;
	if ( atLatest.value ) {
		hasNewEntries.value = false;
	}
}

function scrollToLatest(): void {
	const scroll = logScroll.value;
	if ( !scroll ) {
		return;
	}

	scroll.scrollTop = 0;
	updateLogPosition();
}

async function copyLog(): Promise<void> {
	try {
		await navigator.clipboard.writeText( props.logText );
		copied.value = true;
	} catch {
		copied.value = false;
	}

	if ( copyResetTimer ) {
		window.clearTimeout( copyResetTimer );
	}
	copyResetTimer = window.setTimeout( () => {
		copied.value = false;
	}, 1600 );
}

async function finalize(): Promise<void> {
	finalizing.value = true;
	shutdownMessage.value = 'Shutting down installer...';

	try {
		const response = await fetch( '/finalize-setup', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		} );

		if ( response.ok ) {
			shutdownMessage.value = 'Finalized. The installer will stop shortly.';
			return;
		}

		shutdownMessage.value = `Finalize failed (HTTP ${ response.status }). Check the log for details.`;
		finalizing.value = false;
	} catch {
		shutdownMessage.value = 'Network error while finalizing. See the log for details.';
		finalizing.value = false;
	}
}
</script>
