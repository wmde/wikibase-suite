<template>
	<cdx-dialog
		:open="open"
		title="DNS help"
		subtitle="Resources for learning about DNS records and managing records with common providers."
		use-close-button
		class="dns-help-dialog"
		:default-action="{ label: 'Close' }"
		@update:open="emit( 'update:open', $event )"
		@default="emit( 'update:open', false )"
	>
		<cdx-message>
			If a host fails validation, it may still be propagating or may resolve somewhere other than
			<copyable-value :value="serverIp" label="Copy server IP address" />.
		</cdx-message>

		<div class="dialog__resources">
			<h4>Learn more</h4>
			<ul>
				<li><a href="https://developer.mozilla.org/en-US/docs/Glossary/DNS" target="_blank" rel="noreferrer">DNS basics</a></li>
				<li><a href="https://learn.wordpress.org/lesson/domain-management-understanding-dns-records/" target="_blank" rel="noreferrer">Understanding DNS records</a></li>
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
