<template>
	<section class="wizard-panel is-active">
		<div v-if="complete" class="wizard-panel__body">
			<div class="wizard-panel__header">
				<h2>Setup completed</h2>
				<p>Your services are up. Save the generated configuration somewhere secure now; this temporary setup session will close automatically and passwords will be removed after it closes.</p>
			</div>

			<cdx-message type="success">
				<strong>Services started successfully.</strong> You can now open your Wikibase Suite services and save the final configuration.
			</cdx-message>

			<div>
				<h3>Service links</h3>
				<ul class="complete-links">
					<li>Wikibase: <a :href="wikibaseUrl" target="_blank">{{ wikibaseUrl }}</a></li>
					<li>Query Service: <a :href="queryServiceUrl" target="_blank">{{ queryServiceUrl }}</a></li>
					<li>QuickStatements: <a :href="quickStatementsUrl" target="_blank">{{ quickStatementsUrl }}</a></li>
				</ul>
			</div>

			<pre id="config-content">{{ configText }}</pre>

			<div class="complete-actions">
				<cdx-button @click="copyConfig">{{ copiedConfig ? 'Copied' : 'Copy configuration' }}</cdx-button>
				<a
					class="cdx-button cdx-button--weight-quiet cdx-button--action-progressive cdx-button--fake-button cdx-button--fake-button--enabled"
					:href="configDownloadUrl"
					download="wbs-deploy-setup.env"
				>
					Download env file
				</a>
			</div>
		</div>

		<div v-else>
			<div class="wizard-panel__body">
				<div class="review-status">
					<div class="review-status__topline">
						<h3>Setup progress</h3>
						<span class="review-status__percent">{{ progress }}%</span>
					</div>
					<cdx-progress-bar :value="progress" :max="100" aria-hidden="true" />
					<p class="review-status__summary">{{ summary }}</p>
					<div class="live-status">
						<div class="live-status__header">
							<h3>Live status</h3>
							<cdx-button
								size="small"
								weight="quiet"
								action="progressive"
								@click="emit( 'open-log' )"
							>
								Full log
							</cdx-button>
						</div>
						<p v-if="!hasStatusLines" class="live-status__empty">Waiting for status updates.</p>
						<ul v-else class="status-lines">
							<li v-for="( line, index ) in statusLines" :key="`${ index }-${ line }`" class="status-line">
								{{ line }}
							</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { CdxButton, CdxMessage, CdxProgressBar } from '@wikimedia/codex';
import { computed, ref, watch } from 'vue';
import type { ConfigForm } from '../types';

const props = defineProps<{
	complete: boolean;
	form: ConfigForm;
	configText: string;
	progress: number;
	summary: string;
	statusLines: string[];
	hasStatusLines: boolean;
}>();

const emit = defineEmits<{
	'open-log': [];
}>();

const copiedConfig = ref( false );
const configDownloadUrl = ref( '#' );

const wikibaseUrl = computed( () => `https://${ props.form.WIKIBASE_PUBLIC_HOST }` );
const queryServiceUrl = computed( () => `https://${ props.form.WDQS_PUBLIC_HOST }` );
const quickStatementsUrl = computed( () => `${ wikibaseUrl.value }/tools/quickstatements` );

watch(
	() => props.configText,
	( text, previousUrl ) => {
		if ( previousUrl && configDownloadUrl.value.startsWith( 'blob:' ) ) {
			URL.revokeObjectURL( configDownloadUrl.value );
		}
		configDownloadUrl.value = URL.createObjectURL( new Blob( [ text || '' ], { type: 'text/plain' } ) );
	},
	{ immediate: true }
);

async function copyConfig(): Promise<void> {
	try {
		await navigator.clipboard.writeText( props.configText || '' );
		copiedConfig.value = true;
		window.setTimeout( () => {
			copiedConfig.value = false;
		}, 2000 );
	} catch {
		alert( 'Failed to copy the configuration. Please copy it manually.' );
	}
}
</script>
