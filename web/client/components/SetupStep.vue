<template>
	<section class="wizard-panel is-active">
		<div class="wizard-panel__body setup-flow">
			<div v-if="complete" class="setup-complete">
				<div class="wizard-panel__header">
					<h2>Installation complete! 🎉</h2>
				</div>

				<div class="complete-checklist">
					<div class="complete-services">
							<p class="complete-checklist__description">
								Your Wikibase Suite is now available at the links below.
								<button
									type="button"
									class="setup-log-link"
									@click="emit( 'open-log' )"
								>
									View log
								</button>
							</p>
						<div class="service-links">
							<a class="service-link" :href="wikibaseUrl" target="_blank">
								<span class="service-link__label">Wikibase</span>
								<span class="service-link__value">{{ wikibaseUrl }}</span>
							</a>
							<a class="service-link" :href="queryServiceUrl" target="_blank">
								<span class="service-link__label">Query Service</span>
								<span class="service-link__value">{{ queryServiceUrl }}</span>
							</a>
							<a class="service-link" :href="quickStatementsUrl" target="_blank">
								<span class="service-link__label">QuickStatements</span>
								<span class="service-link__value">{{ quickStatementsUrl }}</span>
							</a>
						</div>
					</div>

					<cdx-message class="setup-callout setup-callout--warning complete-checklist__item">
						<div class="save-config-heading">
							<div class="callout-heading">
								<cdx-icon :icon="cdxIconAlert" class="callout-icon callout-icon--warning" size="small" />
								<h3 class="callout-title">Save your Wikibase server configuration</h3>
							</div>
						</div>
						<p class="complete-checklist__description">
							This configuration file is the <code>.env</code> file used to start your Wikibase Suite services. It contains the hostnames and passwords entered or generated during installation.
						</p>
						<p class="complete-checklist__description">
							Download or copy it now and store it somewhere secure. You may need it for recovery, migration, troubleshooting, or setting up a replacement server.
						</p>
						<div class="save-config-actions">
							<a
								class="config-download-link"
								:href="configDownloadUrl"
								download="wikibase-suite.env"
							>
								<cdx-icon :icon="cdxIconDownload" size="small" />
								<span>Download configuration</span>
							</a>
							<button
								type="button"
								class="config-copy-action"
								:class="{ 'is-copied': copiedConfig }"
								@click="copyConfig"
							>
								<cdx-icon :icon="cdxIconCopy" size="small" />
								<span>{{ copiedConfig ? 'Configuration copied' : 'Copy configuration' }}</span>
							</button>
							<button
								type="button"
								class="config-reveal-button"
								:aria-expanded="configRevealed"
								aria-controls="config-content"
								@click="configRevealed = !configRevealed"
							>
								<cdx-icon :icon="configRevealed ? cdxIconEyeClosed : cdxIconEye" size="small" />
								<span>{{ configRevealed ? 'Hide configuration' : 'Show configuration' }}</span>
							</button>
						</div>
						<div v-if="configRevealed" class="config-box">
							<pre id="config-content">{{ configText }}</pre>
						</div>
					</cdx-message>
				</div>
				</div>

			<div v-else class="setup-progress-panel surface-card">
				<div class="setup-progress-panel__topline">
					<p class="setup-progress-panel__status">{{ currentStatusLine }}</p>
					<cdx-button
						size="small"
						weight="quiet"
						action="progressive"
						@click="emit( 'open-log' )"
					>
							View log
					</cdx-button>
				</div>
				<cdx-progress-bar :value="progress" :max="100" aria-hidden="true" />
				<ol class="setup-checklist">
					<li
						v-for="item in progressChecklistItems"
						:key="item.title"
						class="setup-checklist__item"
						:class="`is-${ item.state }`"
					>
						<span class="setup-checklist__icon" aria-hidden="true">{{ itemIcon( item.state ) }}</span>
						<span class="setup-checklist__label">{{ item.title }}</span>
					</li>
				</ol>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { CdxButton, CdxIcon, CdxMessage, CdxProgressBar } from '@wikimedia/codex';
import { cdxIconAlert, cdxIconCopy, cdxIconDownload, cdxIconEye, cdxIconEyeClosed } from '@wikimedia/codex-icons';
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

type ChecklistState = 'complete' | 'current' | 'upcoming';

const copiedConfig = ref( false );
const configRevealed = ref( false );
const configDownloadUrl = ref( '#' );
const currentStatusLine = computed( () => props.summary || 'Waiting for status updates.' );
const progressChecklistItems = computed( () => {
	const defineState = ( itemProgress: number, nextProgress?: number ): ChecklistState => {
		if ( props.progress >= 100 || props.progress > itemProgress ) {
			if ( nextProgress === undefined || props.progress >= nextProgress ) {
				return 'complete';
			}
		}
		if ( props.progress >= itemProgress && ( nextProgress === undefined || props.progress < nextProgress ) ) {
			return 'current';
		}
		return 'upcoming';
	};

	return [
		{ title: 'Saving your configuration', state: defineState( 6, 10 ) },
		{ title: 'Preparing the server', state: defineState( 10, 15 ) },
		{ title: 'Downloading Docker images for services', state: defineState( 15, 50 ) },
		{ title: 'Starting services', state: defineState( 50, 95 ) },
		{ title: 'Finishing installation', state: defineState( 95, 100 ) }
	];
} );

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

function itemIcon( state: ChecklistState ): string {
	if ( state === 'complete' ) {
		return '✓';
	}
	if ( state === 'current' ) {
		return '⌛';
	}
	return '○';
}
</script>
