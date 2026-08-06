<template>
	<section class="wizard-panel is-active">
		<div class="wizard-panel__body wizard-panel__body--form visibility-step">
			<header class="wizard-panel__header">
				<h2>Visibility</h2>
				<p>
					Help us understand the Wikibase ecosystem. Wikibase is used by hundreds of libraries, museums,
					research projects, and companies—but nobody has a clear picture of how big or diverse that
					ecosystem really is. You can help change that.
				</p>
			</header>

			<div class="visibility-choice">
				<cdx-checkbox
					:model-value="enabled"
					name="METADATA_CALLBACK"
					:disabled="disabled"
					@update:model-value="emit( 'update:enabled', Boolean( $event ) )"
				>
					Yes, include this Wikibase in Wikimedia Deutschland’s ecosystem statistics
				</cdx-checkbox>
			</div>

			<div class="visibility-details">
				<p>
					Once a week, we’ll read a few public numbers from your instance: entities, triples, edits, and
					editors, plus your Wikibase and MediaWiki version. No personal data is collected. No usernames,
					no emails, no IP addresses. Nothing that isn’t already public.
				</p>
				<p>
					In the near future, we plan on making an index of Wikibases which will include details on which
					ones are ready for federation and reuse. This will help your Wikibase become discoverable across
					the ecosystem.
				</p>
				<p>
					Write to us if you change your mind:
					<a href="mailto:support@wikimedia.de">support@wikimedia.de</a>
				</p>
			</div>
		</div>

		<div class="wizard-actions">
			<span></span>
			<div class="wizard-actions__group">
				<cdx-button type="button" weight="quiet" :disabled="disabled" @click="emit( 'back' )">
					Back
				</cdx-button>
				<cdx-button
					type="button"
					action="progressive"
					weight="primary"
					:disabled="disabled || !canStart"
					@click="emit( 'start' )"
				>
					{{ configurationOnly ? 'Save configuration' : 'Start installation' }}
				</cdx-button>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { CdxButton, CdxCheckbox } from '@wikimedia/codex';

defineProps<{
	configurationOnly: boolean;
	enabled: boolean;
	canStart: boolean;
	disabled: boolean;
}>();

const emit = defineEmits<{
	'update:enabled': [ value: boolean ];
	back: [];
	start: [];
}>();
</script>
