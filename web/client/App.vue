<template>
	<main class="page-shell">
		<div class="wizard-layout">
			<header class="wizard-header">
				<div class="wizard-header__brand" aria-hidden="true">
					<img :src="logoSrc" alt="" />
				</div>
				<div class="wizard-header__identity">
					<h1>Deploy Setup</h1>
				</div>
			</header>

			<section class="wizard-progress-area" aria-label="Setup progress">
				<wizard-steps
					:current-step="currentStep"
					:locked="configLocked"
					:steps="steps"
				/>
			</section>

			<section class="surface-card wizard-card">
				<form @submit.prevent>
					<basics-step
						v-if="currentStep === 1"
						:form="form"
						:server-ip="initialState.serverIp"
						:host-statuses="hostValidation.statuses"
						:can-continue="domainReady"
						:disabled="configLocked"
						@update-field="updateField"
						@touch="touchField"
						@flush-host="flushHost"
						@back="currentStep = 0"
						@continue="continueToAccount"
					/>

					<welcome-step
						v-else-if="currentStep === 0"
						:disabled="configLocked"
						@continue="currentStep = 1"
					/>

					<account-step
						v-else-if="currentStep === 2"
						:form="form"
						:text-status="adminNameStatus"
						:email-status="emailStatus"
						:password-status="passwordStatuses.MW_ADMIN_PASS"
						:can-continue="accountReady"
						:disabled="configLocked"
						@update-field="updateField"
						@update-checkbox="form.METADATA_CALLBACK = $event"
						@touch="touchField"
						@back="currentStep = 1"
						@continue="continueToDatabase"
					/>

					<database-step
						v-else-if="currentStep === 3"
						:form="form"
						:text-statuses="databaseTextStatuses"
						:password-status="passwordStatuses.DB_PASS"
						:can-start="canStartSetup"
						:disabled="configLocked"
						@update-field="updateField"
						@touch="touchField"
						@back="currentStep = 2"
						@start="startSetup"
					/>

					<setup-step
						v-else
						:complete="setupComplete"
						:form="form"
						:config-text="configText"
						:progress="setupProgress"
						:summary="setupSummary"
						:status-lines="setupStatusLines"
						:has-status-lines="setupHasStatusLines"
						@open-log="logOpen = true"
					/>
				</form>
			</section>
		</div>

		<domain-help
			v-model:open="dnsHelpOpen"
			:server-ip="initialState.serverIp"
		/>

		<log-dialog
			v-model:open="logOpen"
			:log-text="setupLogText"
		/>
	</main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { HOST_NAME_REGEX, HOST_VALIDATION_POLL_MS } from './constants';
import { configToForm, deriveWdqsHost, fetchConfig, saveConfig } from './config';
import { useHostValidation } from './composables/useHostValidation';
import { usePasswordValidation } from './composables/usePasswordValidation';
import { useSetupLog } from './composables/useSetupLog';
import {
	isValidAdminUsername,
	isValidDatabaseName,
	isValidDatabaseUser,
	isValidEmailAddress
} from './validation';
import type { ConfigForm, FieldValidationStatus, InitialSetupState, WizardStep } from './types';
import AccountStep from './components/AccountStep.vue';
import BasicsStep from './components/BasicsStep.vue';
import DatabaseStep from './components/DatabaseStep.vue';
import DomainHelp from './components/DomainHelp.vue';
import LogDialog from './components/LogDialog.vue';
import SetupStep from './components/SetupStep.vue';
import WelcomeStep from './components/WelcomeStep.vue';
import WizardSteps from './components/WizardSteps.vue';

type HostFieldName = 'WIKIBASE_PUBLIC_HOST' | 'WDQS_PUBLIC_HOST';
type PasswordFieldName = 'MW_ADMIN_PASS' | 'DB_PASS';
type PreferenceTextFieldName = 'MW_ADMIN_NAME' | 'DB_NAME' | 'DB_USER';
type DatabaseTextFieldName = 'DB_NAME' | 'DB_USER';
type FormFieldName = keyof ConfigForm;

const fallbackState: InitialSetupState = {
	isConfigSaved: false,
	isBooted: false,
	isLocalhostSetup: false,
	serverIp: ''
};

const initialState = window.__SETUP_STATE__ || fallbackState;
const logoSrc = '/Wikibase_Suite_(RGB).png';
const currentStep = ref<WizardStep>( initialState.isConfigSaved ? 4 : 0 );
const configLocked = ref( initialState.isConfigSaved );
const setupComplete = ref( initialState.isBooted );
const form = reactive<ConfigForm>( configToForm( null ) );
const configText = ref( '' );
const touchedFields = reactive<Record<string, boolean>>( {} );
const dnsHelpOpen = ref( false );
const logOpen = ref( false );
const wdqsDefaulted = ref( true );
let pollTimer: number | undefined;

const hostValidation = useHostValidation( initialState.serverIp );
const passwordValidation = usePasswordValidation();
const setupLog = useSetupLog( handleSetupComplete );
const setupProgress = computed( () => setupLog.progress.value );
const setupSummary = computed( () => setupLog.summary.value );
const setupStatusLines = computed( () => setupLog.statusLines.value );
const setupHasStatusLines = computed( () => setupLog.hasStatusLines.value );
const setupLogText = computed( () => setupLog.logText.value );

const steps = [
	{ title: 'Welcome' },
	{ title: 'Domain' },
	{ title: 'Account' },
	{ title: 'Database' },
	{ title: 'Setup' }
];

const emailStatus = computed<FieldValidationStatus>( () => {
	if ( !touchedFields.MW_ADMIN_EMAIL || form.MW_ADMIN_EMAIL.trim() === '' ) {
		return 'neutral';
	}
	return isValidEmailAddress( form.MW_ADMIN_EMAIL ) ? 'valid' : 'invalid';
} );

const passwordStatuses = computed<Record<PasswordFieldName, FieldValidationStatus>>( () => ( {
	MW_ADMIN_PASS: passwordValidation.statuses.MW_ADMIN_PASS,
	DB_PASS: passwordValidation.statuses.DB_PASS
} ) );

const preferenceTextStatuses = computed<Record<PreferenceTextFieldName, FieldValidationStatus>>( () => ( {
	MW_ADMIN_NAME: getPreferenceTextStatus( 'MW_ADMIN_NAME' ),
	DB_NAME: getPreferenceTextStatus( 'DB_NAME' ),
	DB_USER: getPreferenceTextStatus( 'DB_USER' )
} ) );

const adminNameStatus = computed<FieldValidationStatus>( () => preferenceTextStatuses.value.MW_ADMIN_NAME );

const databaseTextStatuses = computed<Record<DatabaseTextFieldName, FieldValidationStatus>>( () => ( {
	DB_NAME: preferenceTextStatuses.value.DB_NAME,
	DB_USER: preferenceTextStatuses.value.DB_USER
} ) );

const domainReady = computed( () => (
	hostValidation.statuses.WIKIBASE_PUBLIC_HOST === 'valid' &&
	hostValidation.statuses.WDQS_PUBLIC_HOST === 'valid'
) );

const accountReady = computed( () => (
	isValidAdminUsername( form.MW_ADMIN_NAME ) &&
	isValidEmailAddress( form.MW_ADMIN_EMAIL ) &&
	isPasswordAccepted( 'MW_ADMIN_PASS' )
) );

const databaseReady = computed( () => (
	isValidDatabaseName( form.DB_NAME ) &&
	isValidDatabaseUser( form.DB_USER ) &&
	isPasswordAccepted( 'DB_PASS' )
) );

const canStartSetup = computed( () => domainReady.value && accountReady.value && databaseReady.value );

function isPasswordAccepted( name: PasswordFieldName ): boolean {
	if ( form[ name ].trim() === '' ) {
		return true;
	}
	return passwordValidation.statuses[ name ] === 'valid';
}

function getPreferenceTextStatus( name: PreferenceTextFieldName ): FieldValidationStatus {
	if ( form[ name ].trim() === '' ) {
		return touchedFields[ name ] ? 'invalid' : 'neutral';
	}

	const validators: Record<PreferenceTextFieldName, ( value: string ) => boolean> = {
		MW_ADMIN_NAME: isValidAdminUsername,
		DB_NAME: isValidDatabaseName,
		DB_USER: isValidDatabaseUser
	};

	return validators[ name ]( form[ name ] ) ? 'valid' : 'invalid';
}

function touchField( name: FormFieldName ): void {
	touchedFields[ name ] = true;
}

function updateField( name: FormFieldName, value: string ): void {
	form[ name ] = value as never;

	if ( name === 'WIKIBASE_PUBLIC_HOST' ) {
		hostValidation.scheduleValidation( name, value );
		if ( wdqsDefaulted.value ) {
			form.WDQS_PUBLIC_HOST = deriveWdqsHost( value );
			hostValidation.scheduleValidation( 'WDQS_PUBLIC_HOST', form.WDQS_PUBLIC_HOST );
		}
	}

	if ( name === 'WDQS_PUBLIC_HOST' ) {
		wdqsDefaulted.value = value.trim() === '';
		if ( wdqsDefaulted.value ) {
			form.WDQS_PUBLIC_HOST = deriveWdqsHost( form.WIKIBASE_PUBLIC_HOST );
		}
		hostValidation.scheduleValidation( 'WDQS_PUBLIC_HOST', form.WDQS_PUBLIC_HOST );
	}

	if ( name === 'MW_ADMIN_PASS' || name === 'DB_PASS' ) {
		passwordValidation.scheduleValidation( name, value );
	}
}

async function flushHost( name: HostFieldName ): Promise<void> {
	await hostValidation.validateNow( name, form[ name ] );
}

async function continueToAccount(): Promise<void> {
	touchField( 'WIKIBASE_PUBLIC_HOST' );
	touchField( 'WDQS_PUBLIC_HOST' );
	await Promise.all( [
		hostValidation.validateNow( 'WIKIBASE_PUBLIC_HOST', form.WIKIBASE_PUBLIC_HOST ),
		hostValidation.validateNow( 'WDQS_PUBLIC_HOST', form.WDQS_PUBLIC_HOST )
	] );

	if ( domainReady.value ) {
		currentStep.value = 2;
	}
}

async function continueToDatabase(): Promise<void> {
	touchField( 'MW_ADMIN_NAME' );
	touchField( 'MW_ADMIN_EMAIL' );
	touchField( 'MW_ADMIN_PASS' );
	await passwordValidation.validateNow( 'MW_ADMIN_PASS', form.MW_ADMIN_PASS );

	if ( accountReady.value ) {
		currentStep.value = 3;
	}
}

async function startSetup(): Promise<void> {
	touchField( 'MW_ADMIN_EMAIL' );
	touchField( 'WIKIBASE_PUBLIC_HOST' );
	touchField( 'WDQS_PUBLIC_HOST' );
	touchField( 'MW_ADMIN_NAME' );
	touchField( 'MW_ADMIN_PASS' );
	touchField( 'DB_NAME' );
	touchField( 'DB_USER' );
	touchField( 'DB_PASS' );
	await Promise.all( [
		hostValidation.validateNow( 'WIKIBASE_PUBLIC_HOST', form.WIKIBASE_PUBLIC_HOST ),
		hostValidation.validateNow( 'WDQS_PUBLIC_HOST', form.WDQS_PUBLIC_HOST ),
		passwordValidation.validateNow( 'MW_ADMIN_PASS', form.MW_ADMIN_PASS ),
		passwordValidation.validateNow( 'DB_PASS', form.DB_PASS )
	] );

	if ( !canStartSetup.value ) {
		if ( !domainReady.value ) {
			currentStep.value = 1;
		} else if ( !accountReady.value ) {
			currentStep.value = 2;
		} else {
			currentStep.value = 3;
		}
		return;
	}

	try {
		const response = await saveConfig( form );
		Object.assign( form, configToForm( response.config ) );
		configText.value = response.configText || '';
		configLocked.value = true;
		setupComplete.value = false;
		currentStep.value = 4;
		setupLog.resetForRun();
	} catch ( error ) {
		console.error( error );
		alert( 'Failed to save the environment. See the browser console for details.' );
	}
}

async function handleSetupComplete(): Promise<void> {
	const response = await fetchConfig();
	if ( response ) {
		Object.assign( form, configToForm( response.config ) );
		configText.value = response.configText || '';
	}
	setupLog.setProgress( 100, 'Setup complete. Your services are ready.' );
	setupComplete.value = true;
	currentStep.value = 4;
}

async function hydrateInitialConfig(): Promise<void> {
	const response = await fetchConfig();
	if ( response ) {
		Object.assign( form, configToForm( response.config ) );
		configText.value = response.configText || '';
		wdqsDefaulted.value = form.WDQS_PUBLIC_HOST.trim() === '';
	}

	await Promise.all( [
		hostValidation.validateNow( 'WIKIBASE_PUBLIC_HOST', form.WIKIBASE_PUBLIC_HOST ),
		hostValidation.validateNow( 'WDQS_PUBLIC_HOST', form.WDQS_PUBLIC_HOST ),
		passwordValidation.validateNow( 'MW_ADMIN_PASS', form.MW_ADMIN_PASS ),
		passwordValidation.validateNow( 'DB_PASS', form.DB_PASS )
	] );

	if ( initialState.isConfigSaved && !initialState.isBooted ) {
		setupLog.setProgress( 0, 'Setup has started. Waiting for the first progress update.' );
	}

	if ( initialState.isBooted ) {
		await handleSetupComplete();
	}
}

function startHostValidationPolling(): void {
	pollTimer = window.setInterval( () => {
		if ( currentStep.value !== 1 || configLocked.value ) {
			return;
		}

		( [ 'WIKIBASE_PUBLIC_HOST', 'WDQS_PUBLIC_HOST' ] as HostFieldName[] ).forEach( ( name ) => {
			const value = form[ name ].trim();
			if ( !value || !HOST_NAME_REGEX.test( value ) || hostValidation.statuses[ name ] === 'valid' ) {
				return;
			}
			void hostValidation.validateNow( name, value );
		} );
	}, HOST_VALIDATION_POLL_MS );
}

onMounted( async () => {
	setupLog.start();
	await hydrateInitialConfig();
	startHostValidationPolling();
} );

onUnmounted( () => {
	setupLog.stop();
	if ( pollTimer ) {
		window.clearInterval( pollTimer );
	}
} );
</script>
