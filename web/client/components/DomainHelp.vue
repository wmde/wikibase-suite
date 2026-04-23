<template>
	<cdx-dialog
		:open="open"
		title="DNS help"
		subtitle="Use this if you need a fuller walkthrough or help troubleshooting why a host is not validating."
		use-close-button
		class="dns-help-dialog"
		:default-action="{ label: 'Close' }"
		@update:open="emit( 'update:open', $event )"
		@default="emit( 'update:open', false )"
	>
		<ol class="dialog-steps">
			<li>Register the domain with your preferred registrar if you do not already have one.</li>
			<li>Open the DNS settings for that domain.</li>
			<li>
				Create an <strong>A</strong> record for your main Wikibase host pointing to
				<copyable-value :value="serverIp" label="Copy server IP address" />.
			</li>
			<li>Create another <strong>A</strong> record for the query host, usually <code>query</code>, pointing to the same IP.</li>
			<li>Wait for DNS propagation, then return here and try continuing again.</li>
		</ol>

		<cdx-message>
			If a host still fails validation, the most common causes are an incorrect A record,
			propagation still being in progress, or the host pointing somewhere other than
			<copyable-value :value="serverIp" label="Copy server IP address" />.
		</cdx-message>

		<div class="dialog__resources">
			<h4>Common provider guides</h4>
			<ul>
				<li><a href="https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/" target="_blank" rel="noreferrer">Cloudflare: create DNS records</a></li>
				<li><a href="https://www.godaddy.com/help/add-an-a-record-19238" target="_blank" rel="noreferrer">GoDaddy: add an A record</a></li>
				<li><a href="https://www.namecheap.com/support/knowledgebase/article.aspx/319/2237/how-can-i-set-up-an-a-address-record-for-my-domain/" target="_blank" rel="noreferrer">Namecheap: set up an A record</a></li>
			</ul>
		</div>
	</cdx-dialog>
</template>

<script setup lang="ts">
import { CdxDialog, CdxMessage } from '@wikimedia/codex';
import CopyableValue from './CopyableValue.vue';

defineProps<{
	open: boolean;
	serverIp: string;
}>();

const emit = defineEmits<{
	'update:open': [ value: boolean ];
}>();
</script>
