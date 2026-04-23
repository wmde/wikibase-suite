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
		<pre id="log-content">{{ logText }}</pre>

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
import { CdxButton, CdxDialog } from '@wikimedia/codex';
import { ref } from 'vue';

defineProps<{
	open: boolean;
	logText: string;
}>();

const emit = defineEmits<{
	'update:open': [ value: boolean ];
}>();

const finalizing = ref( false );
const shutdownMessage = ref( '' );

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
