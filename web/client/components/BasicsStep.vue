<template>
	<section class="wizard-panel is-active">
		<div class="wizard-panel__body wizard-panel__body--form">
			<header class="wizard-panel__header">
				<h2>Configure domain names</h2>
				<p>
					Enter the web addresses you’d like to use for your Wikibase and Query Service. In your DNS
					provider's control panel, create two records of either <strong>A</strong> or <strong>CNAME</strong>
					type, one for each hostname. Each hostname must ultimately route to this server's public IP address:
					<copyable-value :value="serverIp" label="Copy server IP address" />. DNS changes can take a few
					minutes to propagate. The fields will show a
					<cdx-icon :icon="cdxIconCheck" class="dns-help-inline__check" size="small" />
					once the entered hostname resolves to this server.
				</p>
			</header>

			<div class="field-stack">
				<validated-text-field
					:model-value="form.WIKIBASE_PUBLIC_HOST"
					label="Wikibase host"
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
					label="Query Service host"
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
						Your DNS provider’s documentation will have the exact steps for managing records. To learn more, see
						<a href="https://developer.mozilla.org/en-US/docs/Glossary/DNS" target="_blank" rel="noreferrer">DNS basics</a>
						or
						<a href="https://learn.wordpress.org/lesson/domain-management-understanding-dns-records/" target="_blank" rel="noreferrer">understanding DNS records</a>,
						or check guides for
						<a href="https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/" target="_blank" rel="noreferrer">Cloudflare</a>,
						<a href="https://www.godaddy.com/help/add-an-a-record-19238" target="_blank" rel="noreferrer">GoDaddy</a>, or
						<a href="https://www.namecheap.com/support/knowledgebase/article.aspx/319/2237/how-can-i-set-up-an-a-address-record-for-my-domain/" target="_blank" rel="noreferrer">Namecheap</a>.
					</p>
				</div>
			</cdx-message>
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
