<template>
	<section class="wizard-panel is-active">
		<div class="wizard-panel__body wizard-panel__body--form">
			<validated-text-field
				:model-value="form.MW_ADMIN_EMAIL"
				label="Admin email address"
				description="Used for the initial admin account and service notices."
				input-type="email"
				name="MW_ADMIN_EMAIL"
				placeholder="you@example.org"
				autocomplete="email"
				:status="emailStatus"
				:disabled="disabled"
				@update:model-value="emit( 'update-field', 'MW_ADMIN_EMAIL', $event )"
				@touch="emit( 'touch', 'MW_ADMIN_EMAIL' )"
			/>

			<section class="field-section">
				<div class="field-section__header">
					<h2>Domain names</h2>
					<p>
						Your server's IP address is:
						<copyable-value :value="serverIp" label="Copy server IP address" />.
						You can't proceed to the next step until both host names below resolve to this IP address.
						For additional guidance or troubleshooting in this process see
						<a href="#" @click.prevent="emit( 'open-dns-help' )">DNS help</a>.
					</p>
				</div>

				<div class="field-stack">
					<validated-text-field
						:model-value="form.WIKIBASE_PUBLIC_HOST"
						label="Wikibase host"
						description="Public address to your Wikibase (e.g. <code>mywikibase.com</code>)"
						name="WIKIBASE_PUBLIC_HOST"
						placeholder="mywikibase.com"
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
						label="Query Service host"
						description="Public address for your Wikibase Query Service (e.g. <code>query.mywikibase.com</code>)"
						name="WDQS_PUBLIC_HOST"
						placeholder="query.mywikibase.com"
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

				<cdx-accordion v-model="helpOpen" separation="none" class="optional-setup">
					<template #title>Need more help?</template>
					<ol>
						<li>If you have not already registered the domain used above you will need to register it.</li>
						<li>
							Create an <strong>A</strong> record in your DNS service for each of the host names you chose above.
							Both should point to the IP address of this server:
							<copyable-value :value="serverIp" label="Copy server IP address" />.
						</li>
						<li>Enter your chosen host names in the fields above.</li>
					</ol>
				</cdx-accordion>
			</section>
		</div>

		<div class="wizard-actions">
			<span></span>
			<div class="wizard-actions__group">
				<cdx-button
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
import { CdxAccordion, CdxButton } from '@wikimedia/codex';
import { ref } from 'vue';
import type { ConfigForm, FieldValidationStatus } from '../types';
import CopyableValue from './CopyableValue.vue';
import ValidatedTextField from './ValidatedTextField.vue';

type HostFieldName = 'WIKIBASE_PUBLIC_HOST' | 'WDQS_PUBLIC_HOST';
type BasicFieldName = 'MW_ADMIN_EMAIL' | HostFieldName;

defineProps<{
	form: ConfigForm;
	serverIp: string;
	emailStatus: FieldValidationStatus;
	hostStatuses: Record<HostFieldName, FieldValidationStatus>;
	canContinue: boolean;
	disabled: boolean;
}>();

const emit = defineEmits<{
	'update-field': [ name: BasicFieldName, value: string ];
	touch: [ name: BasicFieldName ];
	'flush-host': [ name: HostFieldName ];
	'open-dns-help': [];
	continue: [];
}>();

const helpOpen = ref( false );
</script>
