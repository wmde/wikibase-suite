<template>
	<cdx-field class="password-field" :disabled="disabled">
		<template #label>
			{{ label }}
		</template>

		<div class="password-field__control" :data-validation-status="status">
			<cdx-text-input
				:model-value="modelValue"
				:input-type="visible ? 'text' : 'password'"
				:disabled="disabled"
				status="default"
				v-bind="$attrs"
				@update:model-value="emit( 'update:modelValue', String( $event ) )"
				@focus="emit( 'touch' )"
				@blur="emit( 'blur' )"
			/>
			<cdx-icon
				v-if="statusIcon"
				:icon="statusIcon"
				size="small"
				class="password-field__validation-icon"
				aria-hidden="true"
			/>
			<button
				type="button"
				class="password-toggle"
				:aria-label="visible ? `Hide ${ label.toLowerCase() }` : `Show ${ label.toLowerCase() }`"
				:aria-pressed="visible"
				:disabled="disabled"
				@click="visible = !visible"
			>
				<cdx-icon :icon="visible ? cdxIconEyeClosed : cdxIconEye" size="medium" />
			</button>
		</div>

		<template #help-text>
			{{ description }}
		</template>
	</cdx-field>
</template>

<script setup lang="ts">
import { CdxField, CdxIcon, CdxTextInput } from '@wikimedia/codex';
import { cdxIconCheck, cdxIconClose, cdxIconEye, cdxIconEyeClosed } from '@wikimedia/codex-icons';
import { computed, ref } from 'vue';
import type { FieldValidationStatus } from '../types';

const props = withDefaults( defineProps<{
	modelValue: string;
	label: string;
	description: string;
	status?: FieldValidationStatus;
	disabled?: boolean;
}>(), {
	status: 'neutral',
	disabled: false
} );

const emit = defineEmits<{
	'update:modelValue': [ value: string ];
	touch: [];
	blur: [];
}>();

const visible = ref( false );
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
