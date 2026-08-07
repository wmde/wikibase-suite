<template>
	<section class="installer-panel is-active">
		<div class="installer-panel__body installation-flow">
			<div v-if="complete" class="installation-complete">
				<div class="installer-panel__header">
					<h2>{{ configurationOnly ? 'Configuration saved!' : 'Installation complete! 🎉' }}</h2>
				</div>

				<div class="complete-checklist">
					<div v-if="!configurationOnly" class="complete-services">
							<p class="complete-checklist__description">
								Your Wikibase Suite is now available at the links below.
								<button
									type="button"
									class="installation-log-link"
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

					<cdx-message class="installer-callout installer-callout--warning complete-checklist__item">
						<div class="save-config-heading">
							<div class="callout-heading">
								<cdx-icon :icon="cdxIconAlert" class="callout-icon callout-icon--warning" size="small" />
								<h3 class="callout-title">Save your Wikibase server configuration</h3>
							</div>
						</div>
						<p class="complete-checklist__description">
							This configuration file is the <code>.env</code> file used to start your Wikibase Suite services. It contains the hostnames and passwords entered or generated during {{ configurationOnly ? 'configuration' : 'installation' }}.
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
								<cdx-icon :icon="copiedConfig ? cdxIconCheck : cdxIconCopy" size="small" />
								<span>{{ copiedConfig ? 'Configuration copied' : 'Copy configuration' }}</span>
							</button>
						</div>
					</cdx-message>
				</div>
				</div>

			<cdx-message v-else-if="failed" class="installer-callout installer-callout--error installation-failure">
				<div class="installation-failure__heading">
					<cdx-icon :icon="cdxIconAlert" class="callout-icon callout-icon--error" size="small" />
					<h2>Installation could not be completed</h2>
				</div>
				<p>{{ summary }}</p>
				<ol class="installation-failure__steps">
					<li>
						<p>View the installation log to identify the underlying error.</p>
						<cdx-button type="button" @click="emit( 'open-log' )">
							View installation log
						</cdx-button>
					</li>
					<li>
						Consult the
						<a
							href="https://github.com/wmde/wikibase-suite/blob/main/docs/operate/troubleshooting.md"
							target="_blank"
							rel="noopener noreferrer"
						>troubleshooting guide</a>
						for help understanding and correcting what you find.
					</li>
					<li>
						After correcting the problem, return to your server terminal and rerun the install
						command you used to start the installer.
					</li>
				</ol>
				<p class="installation-failure__support">
					If you’re still stuck, contact the Wikibase Suite team at
					<a href="mailto:wikibase-suite-support@wikimedia.de">wikibase-suite-support@wikimedia.de</a>.
				</p>
			</cdx-message>

			<div v-else class="installation-progress-panel surface-card">
				<div class="installation-progress-panel__topline">
					<p class="installation-progress-panel__status">{{ currentStatusLine }}</p>
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
				<ol class="installation-checklist">
					<li
						v-for="item in progressChecklistItems"
						:key="item.title"
						class="installation-checklist__item"
						:class="`is-${ item.state }`"
					>
						<span class="installation-checklist__icon" aria-hidden="true">{{ itemIcon( item.state ) }}</span>
						<span class="installation-checklist__label">{{ item.title }}</span>
					</li>
				</ol>
			</div>

			<section v-if="!complete && !failed && !configurationOnly" class="installation-contents" aria-labelledby="installation-contents-heading">
				<h3 id="installation-contents-heading">What is getting installed</h3>
				<ul>
					<li>Wikibase and MediaWiki for creating and managing structured linked data.</li>
					<li>Query Service and Query Service UI for SPARQL queries.</li>
					<li>Query Service Updater to keep query data in sync.</li>
					<li>QuickStatements for batch imports and edits.</li>
					<li>Reverse-proxy service (Traefik) for routing your domain names to Wikibase and the Query Service UI.</li>
					<li>Required services: job runner, database (MariaDB), and search server (OpenSearch).</li>
				</ul>
			</section>
		</div>
	</section>
</template>

<script setup lang="ts">
import { CdxButton, CdxIcon, CdxMessage, CdxProgressBar } from '@wikimedia/codex';
import { cdxIconAlert, cdxIconCheck, cdxIconCopy, cdxIconDownload } from '@wikimedia/codex-icons';
import { computed, ref, watch } from 'vue';
import type { ConfigForm } from '../types';

const props = defineProps<{
	complete: boolean;
	configurationOnly: boolean;
	form: ConfigForm;
	configText: string;
	progress: number;
	summary: string;
	failed: boolean;
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
