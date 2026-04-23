<template>
	<cdx-field class="validated-text-field" :disabled="disabled">
		<template #label>
			{{ label }}
		</template>
		<template v-if="description" #description>
			<span v-html="description"></span>
		</template>

		<div class="validated-text-field__control" :data-validation-status="status">
			<cdx-text-input
				:model-value="modelValue"
				:input-type="inputType"
				:end-icon="statusIcon"
				:disabled="disabled"
				v-bind="inputAttrs"
				@update:model-value="emit( 'update:modelValue', String( $event ) )"
				@focus="emit( 'touch' )"
				@blur="emit( 'blur' )"
			/>
			<span v-if="status === 'pending'" class="host-input__spinner" aria-hidden="true"></span>
		</div>
	</cdx-field>
</template>

<script setup lang="ts">
import { CdxField, CdxTextInput } from '@wikimedia/codex';
import { cdxIconCheck, cdxIconClose } from '@wikimedia/codex-icons';
import { computed, useAttrs } from 'vue';
import type { FieldValidationStatus } from '../types';

const props = withDefaults( defineProps<{
	modelValue: string;
	label: string;
	description?: string;
	inputType?: 'text' | 'email' | 'password';
	status?: FieldValidationStatus;
	disabled?: boolean;
}>(), {
	description: '',
	inputType: 'text',
	status: 'neutral',
	disabled: false
} );

const emit = defineEmits<{
	'update:modelValue': [ value: string ];
	touch: [];
	blur: [];
}>();

const attrs = useAttrs();
const inputAttrs = computed( () => attrs );
const statusIcon = computed( () => {
	if ( props.status === 'valid' ) {
		return cdxIconCheck;
	}
	if ( props.status === 'invalid' ) {
		return cdxIconClose;
	}
	return undefined;
} );
</script>
