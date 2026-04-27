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
						<h2>Configure domain names</h2>
						<p>
							Enter the web addresses for your Wikibase and its Query Service. Make sure DNS records for both host names point to this server:
							<copyable-value :value="serverIp" label="Copy server IP address" />.
							These fields will only validate once those DNS records are in place.
						</p>
					</div>

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
					<div class="dns-help-inline__header">Need help?</div>
					<p class="dns-help-inline__intro">
						You need a domain you control before continuing. In your domain provider’s DNS settings, add two
						<strong>A</strong> records that point to this server.
					</p>
					<ol class="dns-help-inline__steps">
						<li>
							Set <strong>A</strong> records for both host names. They must be different from each other, and both must
							point to this server’s IP address: <copyable-value :value="serverIp" label="Copy server IP address" />.
							Most Wikibase Suite setups use <code>query</code> as the Query Service subdomain, but you can use any host name you control.
						</li>
						<li>
							When entering the IP address, use only the IP address with nothing before or after it. Your provider may call
							this field “value,” “content,” “address,” or “points to.”
						</li>
						<li>
							In the fields above, enter only the host names, like <code>mywikibase.com</code> and
							<code>query.mywikibase.com</code>.
						</li>
							<li>
								DNS changes often work within a few minutes, but can take up to 24 hours. You can leave this page open;
								it will keep checking every few seconds and show a
								<cdx-icon :icon="cdxIconCheck" class="dns-help-inline__check" size="small" />
								when each host is ready.
							</li>
					</ol>
					<p class="dns-help-inline__resources">
						For provider-specific steps, check the documentation for wherever your DNS is hosted. To generally learn more about DNS, see
						<a href="https://developer.mozilla.org/en-US/docs/Glossary/DNS" target="_blank" rel="noreferrer">DNS basics</a>
						and
						<a href="https://learn.wordpress.org/lesson/domain-management-understanding-dns-records/" target="_blank" rel="noreferrer">understanding DNS records</a>.
					</p>
				</cdx-message>
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
	import { CdxButton, CdxIcon, CdxMessage } from '@wikimedia/codex';
	import { cdxIconCheck } from '@wikimedia/codex-icons';
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
	continue: [];
}>();
</script>
