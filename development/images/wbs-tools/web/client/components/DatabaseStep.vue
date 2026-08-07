<template>
	<section class="installer-panel is-active">
		<div class="installer-panel__body installer-panel__body--form">
			<header class="installer-panel__header">
				<h2>Database credentials</h2>
				<p>
					Wikibase stores data in a MariaDB database. These credentials are used internally between
					services.
				</p>
			</header>

			<div class="field-stack">
				<validated-text-field
					:model-value="form.DB_NAME"
					label="Database name"
					description="The name of the database that will store your Wikibase data."
					name="DB_NAME"
					placeholder="e.g. my_wiki"
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
					description="The username that Wikibase will use to connect to the database."
					name="DB_USER"
					placeholder="e.g. sqluser"
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
					description="Select Generate to create a secure unique password, or enter your own. Passwords must be at least 10 characters."
					name="DB_PASS"
					autocomplete="new-password"
					:status="passwordStatus"
					:disabled="disabled"
					show-generate-button
					@update:model-value="emit( 'update-field', 'DB_PASS', $event )"
					@generate="emit( 'generate-password', 'DB_PASS' )"
					@touch="emit( 'touch', 'DB_PASS' )"
				/>
			</div>

			<cdx-message class="installer-callout installer-callout--warning">
				<div class="callout-heading">
					<cdx-icon :icon="cdxIconAlert" class="callout-icon callout-icon--warning" size="small" />
					<div class="callout-title">Please note</div>
				</div>
				<p class="installer-callout__text">
					You can continue with the default credentials, or change them to something more familiar. Remember
					that these cannot be changed easily after installation.
				</p>
			</cdx-message>
		</div>

		<div class="installer-actions">
			<span></span>
			<div class="installer-actions__group">
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
import { CdxButton, CdxIcon, CdxMessage } from '@wikimedia/codex';
import { cdxIconAlert } from '@wikimedia/codex-icons';
import type { ConfigForm, FieldValidationStatus } from '../types';
import PasswordField from './PasswordField.vue';
import ValidatedTextField from './ValidatedTextField.vue';

type DatabaseTextFieldName = 'DB_NAME' | 'DB_USER';
type DatabaseFieldName = DatabaseTextFieldName | 'DB_PASS';

defineProps<{
	form: ConfigForm;
	textStatuses: Record<DatabaseTextFieldName, FieldValidationStatus>;
	passwordStatus: FieldValidationStatus;
	canContinue: boolean;
	disabled: boolean;
}>();

const emit = defineEmits<{
	'update-field': [ name: DatabaseFieldName, value: string ];
	'generate-password': [ name: 'DB_PASS' ];
	touch: [ name: DatabaseFieldName ];
	back: [];
	continue: [];
}>();
</script>
