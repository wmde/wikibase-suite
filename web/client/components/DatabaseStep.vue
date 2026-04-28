<template>
	<section class="wizard-panel is-active">
		<div class="wizard-panel__body wizard-panel__body--form">
			<header class="wizard-panel__header">
				<h2>Set up database credentials</h2>
				<p>
					Wikibase stores data in a MariaDB database. These credentials are used internally between
					services. You can leave the generated passwords as they are.
				</p>
			</header>

			<div class="field-stack">
				<validated-text-field
					:model-value="form.DB_NAME"
					label="Database name"
					description="The name of the database that will store your Wikibase data."
					name="DB_NAME"
					placeholder="my_wiki"
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
					placeholder="sqluser"
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
					description="Leave blank to generate a secure password, or enter at least 10 characters."
					name="DB_PASS"
					placeholder="Password will be generated"
					autocomplete="new-password"
					:status="passwordStatus"
					:disabled="disabled"
					@update:model-value="emit( 'update-field', 'DB_PASS', $event )"
					@touch="emit( 'touch', 'DB_PASS' )"
				/>
			</div>

			<cdx-message class="setup-callout setup-callout--warning">
				<div class="callout-heading">
					<cdx-icon :icon="cdxIconAlert" class="callout-icon callout-icon--warning" size="small" />
					<div class="callout-title">Before you start</div>
				</div>
				<p class="setup-callout__text">
					Once setup has started, the database name, user, and password can’t be easily changed without
					starting the setup over fresh.
				</p>
			</cdx-message>
		</div>

		<div class="wizard-actions">
			<span></span>
			<div class="wizard-actions__group">
				<cdx-button weight="quiet" :disabled="disabled" @click="emit( 'back' )">
					Back
				</cdx-button>
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
	canStart: boolean;
	disabled: boolean;
}>();

const emit = defineEmits<{
	'update-field': [ name: DatabaseFieldName, value: string ];
	touch: [ name: DatabaseFieldName ];
	back: [];
	start: [];
}>();
</script>
