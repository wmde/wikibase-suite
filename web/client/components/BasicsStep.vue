<template>
	<section class="wizard-panel is-active">
		<div class="wizard-panel__body wizard-panel__body--form">
			<header class="wizard-panel__header">
				<h2>Configure domain names</h2>
				<p>
					Enter the web addresses you’d like to locate your Wikibase and Query Service at below. The DNS records
					for both host names you choose must be set to point to this server’s IP address:
					<copyable-value :value="serverIp" label="Copy server IP address" />. The fields will show a
					<cdx-icon :icon="cdxIconCheck" class="dns-help-inline__check" size="small" />
					once the entered host name is successfully routing to this server. For additional help, see below.
				</p>
			</header>

			<div class="field-stack">
				<validated-text-field
					:model-value="form.WIKIBASE_PUBLIC_HOST"
					label="Wikibase host"
					description="The address where your Wikibase will be accessible. Don’t include <code>http://</code> or a trailing slash."
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
					description="The address for the SPARQL query service. Must be different from the Wikibase host."
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

			<cdx-message class="dns-help-inline">
				<div class="dns-help-inline__content">
					<div class="callout-heading">
						<cdx-icon :icon="cdxIconInfoFilled" class="callout-icon callout-icon--info" size="small" />
						<div class="callout-title">Need help?</div>
					</div>
					<p class="dns-help-inline__intro">
						In your DNS provider’s control panel, create two <strong>A</strong> records, one for each
						host name above. Check your provider’s documentation for the exact steps.
					</p>
					<ol class="dns-help-inline__steps">
						<li>
							Use only <copyable-value :value="serverIp" label="Copy server IP address" /> as the
							record value. Your provider may call this field value, content, address, or points to.
						</li>
						<li>
							DNS record changes may take a few minutes to propagate. This page will keep checking every
							few seconds to confirm the host names you enter match this server’s IP address. When they
							match you will see a
							<cdx-icon :icon="cdxIconCheck" class="dns-help-inline__check" size="small" />
							next to each entry and you will then be able to proceed to the next step.
						</li>
					</ol>
					<p class="dns-help-inline__resources">
						To generally learn more about DNS, see
						<a href="https://developer.mozilla.org/en-US/docs/Glossary/DNS" target="_blank" rel="noreferrer">DNS basics</a>
						and
						<a href="https://learn.wordpress.org/lesson/domain-management-understanding-dns-records/" target="_blank" rel="noreferrer">understanding DNS records</a>.
					</p>
				</div>
			</cdx-message>
		</div>

		<div class="wizard-actions">
			<span></span>
			<div class="wizard-actions__group">
				<cdx-button weight="quiet" :disabled="disabled" @click="emit( 'back' )">
					Back
				</cdx-button>
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
