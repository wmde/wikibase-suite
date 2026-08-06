<template>
	<button
		type="button"
		class="inline-copy__button"
		:class="{ 'is-copied': copied }"
		:aria-label="copied ? 'Copied' : label"
		:title="copied ? 'Copied' : label"
		@click="copy"
	>
		<span class="inline-copy__text">{{ value }}</span>
		<cdx-icon :icon="copied ? cdxIconCheck : cdxIconCopy" size="small" />
	</button>
</template>

<script setup lang="ts">
import { CdxIcon } from '@wikimedia/codex';
import { cdxIconCheck, cdxIconCopy } from '@wikimedia/codex-icons';
import { ref } from 'vue';

const props = withDefaults( defineProps<{
	value: string;
	label?: string;
}>(), {
	label: 'Copy'
} );

const copied = ref( false );
let resetTimer: number | undefined;

async function copy(): Promise<void> {
	if ( !props.value ) {
		return;
	}

	try {
		await navigator.clipboard.writeText( props.value );
		copied.value = true;
	} catch {
		copied.value = false;
	}

	if ( resetTimer ) {
		window.clearTimeout( resetTimer );
	}
	resetTimer = window.setTimeout( () => {
		copied.value = false;
	}, 1600 );
}
</script>
