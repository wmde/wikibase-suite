<template>
	<section class="wizard-panel is-active">
		<div class="wizard-panel__body wizard-panel__body--intro">
			<header class="wizard-panel__header">
				<h2>Welcome to Wikibase Suite</h2>
				<p>
					You're about to set up your own Wikibase instance, a platform for creating and managing
					structured linked open data. This wizard will write your configuration and start the installation.
					It takes about 5 minutes.
				</p>
			</header>

			<cdx-message class="intro-callout">
				<div class="callout-heading">
					<cdx-icon :icon="cdxIconInfoFilled" class="callout-icon callout-icon--info" size="small" />
					<div class="callout-title">What you'll need:</div>
				</div>
				<ul class="intro-callout__list">
					<li>A domain you own or control</li>
					<li>Access to your domain provider’s DNS settings</li>
				</ul>
			</cdx-message>

			<section class="overview-list" aria-labelledby="overview-heading">
				<h3 id="overview-heading">What you'll configure</h3>
				<ul>
					<li>
						<cdx-icon :icon="cdxIconGlobe" size="medium" />
						<span>Domain settings</span>
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
						<cdx-icon :icon="cdxIconCheck" size="medium" />
						<span>Install Wikibase Suite</span>
					</li>
				</ul>
			</section>
		</div>

		<div class="wizard-actions">
			<span></span>
			<div class="wizard-actions__group">
				<cdx-button action="progressive" weight="primary" :disabled="disabled" @click="emit( 'continue' )">
					Get started
				</cdx-button>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { CdxButton, CdxIcon, CdxMessage } from '@wikimedia/codex';
import { cdxIconCheck, cdxIconDatabase, cdxIconGlobe, cdxIconInfoFilled, cdxIconLock } from '@wikimedia/codex-icons';

defineProps<{
	disabled: boolean;
}>();

const emit = defineEmits<{
	continue: [];
}>();
</script>
