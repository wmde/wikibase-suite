<template>
	<ol class="wizard-progress" aria-label="Configuration steps">
		<li
			v-for="( step, index ) in steps"
			:key="step.title"
			class="wizard-progress__item"
			:class="{
				'is-active': currentStep === index,
				'is-complete': currentStep > index,
				'is-locked': locked && currentStep > index
			}"
		>
			<div class="wizard-progress__topline">
				<span class="wizard-progress__step">
					<cdx-icon
						v-if="locked && currentStep > index"
						:icon="cdxIconLock"
						size="small"
					/>
					<cdx-icon
						v-else-if="currentStep > index"
						:icon="cdxIconCheck"
						size="small"
					/>
					<span v-else>{{ index + 1 }}</span>
				</span>
				<span class="wizard-progress__title">{{ step.title }}</span>
			</div>
		</li>
	</ol>
</template>

<script setup lang="ts">
import { CdxIcon } from '@wikimedia/codex';
import { cdxIconCheck, cdxIconLock } from '@wikimedia/codex-icons';
import type { WizardStep } from '../types';

defineProps<{
	currentStep: WizardStep;
	locked: boolean;
	steps: Array<{ title: string }>;
}>();
</script>
