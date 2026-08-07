<template>
	<section class="installer-panel is-active">
		<div class="installer-panel__body installer-panel__body--form">
			<header class="installer-panel__header">
				<h2>Connect domains</h2>
				<p>
					Enter the domain names you have linked via DNS A records to your server’s IP address:
					<copyable-value :value="serverIp" label="Copy server IP address" />.
				</p>
				<p class="domain-validation-copy">
					The fields will show a
					<cdx-icon :icon="cdxIconCheck" class="dns-help-inline__check" size="small" />
					when the entered domains resolve correctly.
				</p>
			</header>

			<div class="field-stack">
				<validated-text-field
					:model-value="form.WIKIBASE_PUBLIC_HOST"
					label="Wikibase domain"
					description="The address where your Wikibase will be accessible. Don’t include <code>http://</code> or a trailing slash."
					name="WIKIBASE_PUBLIC_HOST"
					placeholder="e.g. wikibase.example.org"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					:status="hostStatuses.WIKIBASE_PUBLIC_HOST"
					:disabled="disabled"
					@update:model-value="emit( 'update-field', 'WIKIBASE_PUBLIC_HOST', $event )"
					@touch="emit( 'touch', 'WIKIBASE_PUBLIC_HOST' )"
					@blur="emit( 'flush-host', 'WIKIBASE_PUBLIC_HOST' )"
				/>

				<validated-text-field
					:model-value="form.WDQS_PUBLIC_HOST"
					label="Query Service subdomain"
					description="The address for the SPARQL query service. Must be different from the Wikibase host."
					name="WDQS_PUBLIC_HOST"
					placeholder="e.g. query.wikibase.example.org"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					:status="hostStatuses.WDQS_PUBLIC_HOST"
					:disabled="disabled"
					@update:model-value="emit( 'update-field', 'WDQS_PUBLIC_HOST', $event )"
					@touch="emit( 'touch', 'WDQS_PUBLIC_HOST' )"
					@blur="emit( 'flush-host', 'WDQS_PUBLIC_HOST' )"
				/>
			</div>

			<cdx-message class="dns-help-inline">
				<div class="dns-help-inline__content">
					<div class="callout-heading">
						<cdx-icon :icon="cdxIconInfoFilled" class="callout-icon callout-icon--info" size="small" />
						<div class="callout-title">Need help?</div>
					</div>
					<p class="dns-help-inline__intro">
						To update your DNS settings, log in to your domain provider and navigate to DNS settings (often
						called “DNS Management,” “DNS Settings,” or “Zone File Editor”). For more information, follow
						the domain instructions in the
						<a href="https://github.com/wmde/wikibase-suite/blob/main/docs/install/README.md" target="_blank" rel="noreferrer">installation guide</a>.
					</p>
				</div>
			</cdx-message>
		</div>

		<div class="installer-actions">
			<span></span>
			<div class="installer-actions__group">
				<cdx-button type="button" weight="quiet" :disabled="disabled" @click="emit( 'back' )">
					Back
				</cdx-button>
				<cdx-button
					type="button"
					action="progressive"
					weight="primary"
					:disabled="disabled || !canContinue"
					@click="emit( 'continue' )"
				>
					Continue
				</cdx-button>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
	import { CdxButton, CdxIcon, CdxMessage } from '@wikimedia/codex';
	import { cdxIconCheck, cdxIconInfoFilled } from '@wikimedia/codex-icons';
import type { ConfigForm, FieldValidationStatus } from '../types';
import CopyableValue from './CopyableValue.vue';
import ValidatedTextField from './ValidatedTextField.vue';

type HostFieldName = 'WIKIBASE_PUBLIC_HOST' | 'WDQS_PUBLIC_HOST';
type BasicFieldName = HostFieldName;

defineProps<{
	form: ConfigForm;
	serverIp: string;
	hostStatuses: Record<HostFieldName, FieldValidationStatus>;
	canContinue: boolean;
	disabled: boolean;
}>();

const emit = defineEmits<{
	'update-field': [ name: BasicFieldName, value: string ];
	touch: [ name: BasicFieldName ];
	'flush-host': [ name: HostFieldName ];
	back: [];
	continue: [];
}>();
</script>
