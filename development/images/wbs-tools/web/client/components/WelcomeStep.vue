<template>
	<section class="installer-panel is-active">
		<div v-if="existingInstallState === 'previous'" class="installer-panel__body installer-panel__body--intro">
			<header class="installer-panel__header">
				<h2>Installation already completed</h2>
			</header>

			<cdx-message class="installer-callout installer-callout--warning">
				<div class="callout-heading">
					<cdx-icon :icon="cdxIconAlert" class="callout-icon callout-icon--warning" size="small" />
					<div class="callout-title">Existing installation found</div>
				</div>
				<p>
					This Wikibase Suite has already been installed. The installer cannot safely be run again
					for this installation. To start over with a new configuration, see
					<a
						href="https://github.com/wmde/wikibase-suite/blob/main/docs/operate/reset.md"
						target="_blank"
						rel="noreferrer"
					>Resetting an instance</a>.
				</p>
			</cdx-message>
		</div>

		<div v-else class="installer-panel__body installer-panel__body--intro">
			<header class="installer-panel__header">
				<h2>Welcome to Wikibase Suite</h2>
				<p v-if="configurationOnly">
					Create or update the configuration used by your Wikibase Suite installation.
					Services and data will not be changed.
				</p>
				<p v-else>
					You're about to set up your own Wikibase instance, a platform for creating and managing
					structured linked open data. The installer will write your configuration and start the installation.
					It takes about 5 minutes.
				</p>
			</header>

			<section class="overview-list" aria-labelledby="overview-heading">
				<h3 id="overview-heading">What you'll configure</h3>
				<ul>
					<li>
						<cdx-icon :icon="cdxIconGlobe" size="medium" />
						<span>Connect domains</span>
					</li>
					<li>
						<cdx-icon :icon="cdxIconLock" size="medium" />
						<span>Administrator account</span>
					</li>
					<li>
						<cdx-icon :icon="cdxIconDatabase" size="medium" />
						<span>Database credentials</span>
					</li>
					<li>
						<cdx-icon :icon="cdxIconGlobe" size="medium" />
						<span>Choose whether to share ecosystem statistics</span>
					</li>
					<li v-if="!configurationOnly">
						<cdx-icon :icon="cdxIconCheck" size="medium" />
						<span>Install Wikibase Suite</span>
					</li>
				</ul>
			</section>

			<cdx-message class="installer-callout security-note">
				<div class="callout-heading">
					<cdx-icon :icon="cdxIconLock" class="callout-icon callout-icon--info" size="small" />
					<div class="callout-title">Security note</div>
				</div>
				<p class="installer-callout__text">
					Any credentials entered here are transmitted securely, used only for this installation, and
					are not stored or shared with any third party.
				</p>
			</cdx-message>
		</div>

		<div v-if="existingInstallState !== 'previous'" class="installer-actions">
			<span></span>
			<div class="installer-actions__group">
				<cdx-button type="button" action="progressive" weight="primary" :disabled="disabled" @click="emit( 'continue' )">
					Get started
				</cdx-button>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { CdxButton, CdxIcon, CdxMessage } from '@wikimedia/codex';
import {
	cdxIconAlert,
	cdxIconCheck,
	cdxIconDatabase,
	cdxIconGlobe,
	cdxIconLock
} from '@wikimedia/codex-icons';
import type { ExistingInstallState } from '../types';

defineProps<{
	configurationOnly: boolean;
	disabled: boolean;
	existingInstallState: ExistingInstallState;
}>();

const emit = defineEmits<{
	continue: [];
}>();
</script>
