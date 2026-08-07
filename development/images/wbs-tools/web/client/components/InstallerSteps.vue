<template>
	<ol class="installer-progress" aria-label="Configuration steps">
		<li
			v-for="( step, index ) in steps"
			:key="step.title"
			class="installer-progress__item"
			:class="{
				'is-active': currentStep === index,
				'is-complete': currentStep > index,
				'is-interactive': interactive,
				'is-locked': locked && currentStep > index
			}"
			:aria-label="interactive ? `Show ${ step.title } step` : undefined"
			:role="interactive ? 'button' : undefined"
			:tabindex="interactive ? 0 : undefined"
			@click="selectStep( index )"
			@keydown.enter.prevent="selectStep( index )"
			@keydown.space.prevent="selectStep( index )"
		>
			<div class="installer-progress__topline">
				<span class="installer-progress__step">
					<cdx-icon
						v-if="step.complete || currentStep > index"
						:icon="cdxIconCheck"
						size="small"
					/>
					<span v-else>{{ index + 1 }}</span>
				</span>
				<span class="installer-progress__title">{{ step.title }}</span>
			</div>
		</li>
	</ol>
</template>

<script setup lang="ts">
import { CdxIcon } from '@wikimedia/codex';
import { cdxIconCheck } from '@wikimedia/codex-icons';
const props = defineProps<{
	currentStep: number;
	interactive: boolean;
	locked: boolean;
	steps: Array<{ title: string; complete?: boolean }>;
}>();

const emit = defineEmits<{
	'select-step': [ index: number ];
}>();

function selectStep( index: number ): void {
	if ( !props.interactive ) {
		return;
	}
	emit( 'select-step', index );
}
</script>
