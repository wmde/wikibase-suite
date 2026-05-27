<template>
	<section class="wizard-panel is-active">
		<div class="wizard-panel__body wizard-panel__body--form">
			<header class="wizard-panel__header">
				<h2>Create an admin account</h2>
				<p>
					This will be the first account on your Wikibase with full administrative permissions. You can
					create additional accounts later.
				</p>
			</header>

			<div class="field-stack">
				<validated-text-field
					:model-value="form.MW_ADMIN_EMAIL"
					label="Email address"
					description="Used for password resets and system notifications."
					input-type="email"
					name="MW_ADMIN_EMAIL"
					placeholder="e.g. admin@example.org"
					autocomplete="email"
					:status="emailStatus"
					:disabled="disabled"
					@update:model-value="emit( 'update-field', 'MW_ADMIN_EMAIL', $event )"
					@touch="emit( 'touch', 'MW_ADMIN_EMAIL' )"
				/>

				<validated-text-field
					:model-value="form.MW_ADMIN_NAME"
					label="Username"
					description="At least 4 characters. Publicly visible as the author of edits."
					name="MW_ADMIN_NAME"
					placeholder="e.g. admin"
					autocomplete="username"
					autocapitalize="off"
					:status="textStatus"
					:disabled="disabled"
					@update:model-value="emit( 'update-field', 'MW_ADMIN_NAME', $event )"
					@touch="emit( 'touch', 'MW_ADMIN_NAME' )"
				/>

				<password-field
					:model-value="form.MW_ADMIN_PASS"
					label="Password"
					description="Select Generate to create a secure unique password, or enter your own. Passwords must be at least 10 characters."
					name="MW_ADMIN_PASS"
					autocomplete="new-password"
					:status="passwordStatus"
					:disabled="disabled"
					show-generate-button
					@update:model-value="emit( 'update-field', 'MW_ADMIN_PASS', $event )"
					@generate="emit( 'generate-password', 'MW_ADMIN_PASS' )"
					@touch="emit( 'touch', 'MW_ADMIN_PASS' )"
				/>
			</div>

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
import { CdxButton, CdxCheckbox } from '@wikimedia/codex';
import type { ConfigForm, FieldValidationStatus } from '../types';
import PasswordField from './PasswordField.vue';
import ValidatedTextField from './ValidatedTextField.vue';

type AccountFieldName = 'MW_ADMIN_NAME' | 'MW_ADMIN_EMAIL' | 'MW_ADMIN_PASS';

defineProps<{
	form: ConfigForm;
	textStatus: FieldValidationStatus;
	emailStatus: FieldValidationStatus;
	passwordStatus: FieldValidationStatus;
	canContinue: boolean;
	disabled: boolean;
}>();

const emit = defineEmits<{
	'update-field': [ name: AccountFieldName, value: string ];
	'update-checkbox': [ value: boolean ];
	'generate-password': [ name: 'MW_ADMIN_PASS' ];
	touch: [ name: AccountFieldName ];
	back: [];
	continue: [];
}>();
</script>
