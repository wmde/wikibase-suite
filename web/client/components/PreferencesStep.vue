<template>
	<section class="wizard-panel is-active">
		<div class="wizard-panel__body wizard-panel__body--form">
			<div class="metadata-choice">
				<cdx-checkbox
					:model-value="form.METADATA_CALLBACK"
					name="METADATA_CALLBACK"
					:disabled="disabled"
					@update:model-value="emit( 'update-checkbox', Boolean( $event ) )"
				>
					Make this Wikibase visible in the global Wikibase directory
				</cdx-checkbox>
				<div class="metadata-choice__description">
					Enable this if you want your Wikibase to be listed in the shared global directory for discovery.
				</div>
			</div>

			<section class="field-section">
				<div class="field-section__header">
					<h2>Optional</h2>
					<p>
						Some settings are set by default, including the automatic generation of secure passwords. You
						can view and edit those settings below if you have special requirements or preferences,
						otherwise that can be safely left as is.
					</p>
				</div>

				<cdx-accordion v-model="optionalOpen" separation="none" class="optional-setup">
					<template #title>Show optional fields</template>
					<div class="field-stack">
						<validated-text-field
							:model-value="form.MW_ADMIN_NAME"
							label="Admin username"
							description="This will be the username for the initial admin account."
							name="MW_ADMIN_NAME"
							autocomplete="username"
							autocapitalize="off"
							:status="textStatuses.MW_ADMIN_NAME"
							:disabled="disabled"
							@update:model-value="emit( 'update-field', 'MW_ADMIN_NAME', $event )"
							@touch="emit( 'touch', 'MW_ADMIN_NAME' )"
						/>

						<password-field
							:model-value="form.MW_ADMIN_PASS"
							label="Admin password"
							description="At least 10 characters. Avoid common passwords."
							name="MW_ADMIN_PASS"
							placeholder="Password will be generated"
							autocomplete="new-password"
							:status="passwordStatuses.MW_ADMIN_PASS"
							:disabled="disabled"
							@update:model-value="emit( 'update-field', 'MW_ADMIN_PASS', $event )"
							@touch="emit( 'touch', 'MW_ADMIN_PASS' )"
						/>

						<validated-text-field
							:model-value="form.DB_NAME"
							label="Database name"
							description="Default: <code>my_wiki</code>."
							name="DB_NAME"
							autocomplete="off"
							autocapitalize="off"
							:status="textStatuses.DB_NAME"
							:disabled="disabled"
							@update:model-value="emit( 'update-field', 'DB_NAME', $event )"
							@touch="emit( 'touch', 'DB_NAME' )"
						/>

						<validated-text-field
							:model-value="form.DB_USER"
							label="Database user"
							description="Used by Wikibase to connect to the database. Default: <code>sqluser</code>."
							name="DB_USER"
							autocomplete="username"
							autocapitalize="off"
							:status="textStatuses.DB_USER"
							:disabled="disabled"
							@update:model-value="emit( 'update-field', 'DB_USER', $event )"
							@touch="emit( 'touch', 'DB_USER' )"
						/>

						<password-field
							:model-value="form.DB_PASS"
							label="Database password"
							description="At least 10 characters. Avoid common passwords."
							name="DB_PASS"
							placeholder="Password will be generated"
							autocomplete="new-password"
							:status="passwordStatuses.DB_PASS"
							:disabled="disabled"
							@update:model-value="emit( 'update-field', 'DB_PASS', $event )"
							@touch="emit( 'touch', 'DB_PASS' )"
						/>
					</div>
				</cdx-accordion>
			</section>
		</div>

		<div class="wizard-actions">
			<div class="wizard-actions__group">
				<cdx-button weight="quiet" :disabled="disabled" @click="emit( 'back' )">
					Back
				</cdx-button>
			</div>
			<div class="wizard-actions__group">
				<cdx-button
					action="progressive"
					weight="primary"
					:disabled="disabled || !canStart"
					@click="emit( 'start' )"
				>
					Start Setup
				</cdx-button>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { CdxAccordion, CdxButton, CdxCheckbox } from '@wikimedia/codex';
import { ref } from 'vue';
import type { ConfigForm, FieldValidationStatus } from '../types';
import PasswordField from './PasswordField.vue';
import ValidatedTextField from './ValidatedTextField.vue';

type PreferenceTextField = 'MW_ADMIN_NAME' | 'MW_ADMIN_PASS' | 'DB_NAME' | 'DB_USER' | 'DB_PASS';
type PasswordFieldName = 'MW_ADMIN_PASS' | 'DB_PASS';
type PreferenceTextValidationField = 'MW_ADMIN_NAME' | 'DB_NAME' | 'DB_USER';

defineProps<{
	form: ConfigForm;
	passwordStatuses: Record<PasswordFieldName, FieldValidationStatus>;
	textStatuses: Record<PreferenceTextValidationField, FieldValidationStatus>;
	canStart: boolean;
	disabled: boolean;
}>();

const emit = defineEmits<{
	'update-field': [ name: PreferenceTextField, value: string ];
	'update-checkbox': [ value: boolean ];
	touch: [ name: PreferenceTextField ];
	back: [];
	start: [];
}>();

const optionalOpen = ref( false );
</script>
