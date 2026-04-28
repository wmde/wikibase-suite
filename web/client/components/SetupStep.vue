<template>
	<section class="wizard-panel is-active">
		<div class="wizard-panel__body setup-flow">
			<div v-if="complete" class="setup-complete">
				<div class="wizard-panel__header">
					<h2>Setup complete! 🎉</h2>
				</div>

				<div class="complete-checklist">
					<div class="complete-services">
						<p class="complete-checklist__description">
							Your Wikibase Suite is now available at the links below.
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
						<div class="callout-heading">
							<cdx-icon :icon="cdxIconAlert" class="callout-icon callout-icon--warning" size="small" />
							<h3 class="callout-title">Save your configuration</h3>
						</div>
						<p class="complete-checklist__description">
							Your final configuration file is below. It includes your passwords. You can also copy or download the full configuration below, which can be used when you are upgrading or if you are setting up your server again
							(see
							<a
								href="https://github.com/wmde/wikibase-release-pipeline/blob/main/deploy/README.md#resetting-the-configuration"
								target="_blank"
								rel="noreferrer"
								>
									Resetting
								</a>
								in Deploy documentation).
						</p>
						<p class="complete-checklist__description">
							Please keep track of these passwords in a secure place, as they will be cleared from the setup configuration file now that the services have been setup.
						</p>
						<div class="config-box">
							<pre id="config-content">{{ configText }}</pre>
							<button
								type="button"
								class="config-box__copy"
								:class="{ 'is-copied': copiedConfig }"
								:aria-label="copiedConfig ? 'Copied' : 'Copy configuration'"
								:title="copiedConfig ? 'Copied' : 'Copy configuration'"
								@click="copyConfig"
							>
								<span v-if="copiedConfig">Copied</span>
								<cdx-icon v-else :icon="cdxIconCopy" size="small" />
							</button>
						</div>
						<div class="complete-actions">
							<a
								class="config-download-link"
								:href="configDownloadUrl"
								download="wbs-deploy-setup.env"
							>
								Download configuration file
							</a>
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
						Full setup log
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
import { cdxIconAlert, cdxIconCopy } from '@wikimedia/codex-icons';
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
		{ title: 'Finishing setup', state: defineState( 95, 100 ) }
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
