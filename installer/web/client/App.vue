<template>
	<main class="page-shell">
		<div class="wizard-layout">
			<header class="wizard-header">
				<div class="wizard-header__brand" aria-hidden="true">
					<img :src="logoSrc" alt="" />
				</div>
				<div class="wizard-header__identity">
					<h1>Installer</h1>
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
				<cdx-message v-if="saveErrorMessage" class="setup-callout setup-callout--error final-save-error">
					<div class="callout-heading">
						<div class="callout-title">Configuration could not be saved</div>
					</div>
					<p class="setup-callout__text">
						The final validation check found a problem before the setup file was written. Try starting over.
						If this keeps happening, contact Wikibase Suite support.
					</p>
					<ul v-if="saveErrorDetails.length" class="final-save-error__details">
						<li v-for="detail in saveErrorDetails" :key="detail">
							{{ detail }}
						</li>
					</ul>
				</cdx-message>
				<form @submit.prevent="submitCurrentStep">
					<button class="form-submit-proxy" type="submit" aria-hidden="true" tabindex="-1"></button>
					<basics-step
						v-if="currentStep === 1"
						:form="form"
						:server-ip="initialState.serverIp"
						:host-statuses="displayedHostStatuses"
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
						:existing-install-state="initialState.existingInstallState"
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
						@generate-password="generatePasswordForField"
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
						@generate-password="generatePasswordForField"
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
import { CdxMessage } from '@wikimedia/codex';
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { HOST_VALIDATION_POLL_MS } from './constants';
import { SaveConfigError, configToForm, fetchConfig, saveConfig } from './config';
import { useHostValidation } from './composables/useHostValidation';
import { usePasswordValidation } from './composables/usePasswordValidation';
import { useSetupLog } from './composables/useSetupLog';
import {
	areSetupHostsDistinct,
	isValidAdminUsername,
	isValidDatabaseName,
	isValidDatabaseUser,
	isValidEmailAddress,
	isValidSetupHostname
} from '../shared/validation.ts';
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
type TextValidationFieldName = 'MW_ADMIN_NAME' | 'DB_NAME' | 'DB_USER';
type DatabaseTextFieldName = 'DB_NAME' | 'DB_USER';
type FormFieldName = keyof ConfigForm;

const fallbackState: InitialSetupState = {
	isConfigSaved: false,
	isBooted: false,
	isSetupStarted: false,
	existingInstallState: 'none',
	isLocalhostSetup: false,
	serverIp: ''
};

const initialState = window.__SETUP_STATE__ || fallbackState;
const logoSrc = '/Wikibase_Suite_(RGB).png';
const existingInstallIsRunning = initialState.existingInstallState === 'running';
const existingInstallBlocksSetup = initialState.existingInstallState === 'previous';
const initialSetupComplete = initialState.isBooted || existingInstallIsRunning;
const initialSetupLocked = initialSetupComplete || initialState.isSetupStarted || existingInstallBlocksSetup;
const currentStep = ref<WizardStep>( initialSetupComplete || initialState.isSetupStarted ? 4 : 0 );
const configLocked = ref( initialSetupLocked );
const setupComplete = ref( initialSetupComplete );
const form = reactive<ConfigForm>( configToForm( null ) );
const configText = ref( '' );
const dnsHelpOpen = ref( false );
const logOpen = ref( false );
const saveErrorMessage = ref( '' );
const saveErrorDetails = ref<string[]>( [] );
let pollTimer: number | undefined;

const hostValidation = useHostValidation( initialState.isLocalhostSetup );
const passwordValidation = usePasswordValidation();
const setupLog = useSetupLog( handleSetupComplete );
const setupProgress = computed( () => setupLog.progress.value );
const setupSummary = computed( () => setupLog.summary.value );
const setupStatusLines = computed( () => setupLog.statusLines.value );
const setupHasStatusLines = computed( () => setupLog.hasStatusLines.value );
const setupLogText = computed( () => setupLog.logText.value );

const steps = computed( () => [
	{ title: 'Welcome' },
	{ title: 'Domain' },
	{ title: 'Account' },
	{ title: 'Database' },
	{ title: 'Setup', complete: setupComplete.value }
] );

const emailStatus = computed<FieldValidationStatus>( () => {
	return isValidEmailAddress( form.MW_ADMIN_EMAIL ) ? 'valid' : 'invalid';
} );

const passwordStatuses = computed<Record<PasswordFieldName, FieldValidationStatus>>( () => ( {
	MW_ADMIN_PASS: passwordValidation.statuses.MW_ADMIN_PASS,
	DB_PASS: passwordValidation.statuses.DB_PASS
} ) );

const textStatuses = computed<Record<TextValidationFieldName, FieldValidationStatus>>( () => ( {
	MW_ADMIN_NAME: getTextStatus( 'MW_ADMIN_NAME' ),
	DB_NAME: getTextStatus( 'DB_NAME' ),
	DB_USER: getTextStatus( 'DB_USER' )
} ) );

const adminNameStatus = computed<FieldValidationStatus>( () => textStatuses.value.MW_ADMIN_NAME );

const databaseTextStatuses = computed<Record<DatabaseTextFieldName, FieldValidationStatus>>( () => ( {
	DB_NAME: textStatuses.value.DB_NAME,
	DB_USER: textStatuses.value.DB_USER
} ) );

const displayedHostStatuses = computed<Record<HostFieldName, FieldValidationStatus>>( () => ( {
	WIKIBASE_PUBLIC_HOST: hostValidation.statuses.WIKIBASE_PUBLIC_HOST,
	WDQS_PUBLIC_HOST: !areSetupHostsDistinct( form.WIKIBASE_PUBLIC_HOST, form.WDQS_PUBLIC_HOST ) &&
		hostValidation.statuses.WIKIBASE_PUBLIC_HOST === 'valid' &&
		hostValidation.statuses.WDQS_PUBLIC_HOST === 'valid' ?
		'invalid' :
		hostValidation.statuses.WDQS_PUBLIC_HOST
} ) );

const domainReady = computed( () => (
	hostValidation.statuses.WIKIBASE_PUBLIC_HOST === 'valid' &&
	hostValidation.statuses.WDQS_PUBLIC_HOST === 'valid' &&
	areSetupHostsDistinct( form.WIKIBASE_PUBLIC_HOST, form.WDQS_PUBLIC_HOST )
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
	return passwordValidation.statuses[ name ] === 'valid';
}

function getTextStatus( name: TextValidationFieldName ): FieldValidationStatus {
	const validators: Record<TextValidationFieldName, ( value: string ) => boolean> = {
		MW_ADMIN_NAME: isValidAdminUsername,
		DB_NAME: isValidDatabaseName,
		DB_USER: isValidDatabaseUser
	};

	return validators[ name ]( form[ name ] ) ? 'valid' : 'invalid';
}

function touchField( _name: FormFieldName ): void {
}

function updateField( name: FormFieldName, value: string ): void {
	clearSaveError();
	form[ name ] = value as never;

	if ( name === 'WIKIBASE_PUBLIC_HOST' ) {
		hostValidation.scheduleValidation( name, value );
	}

	if ( name === 'WDQS_PUBLIC_HOST' ) {
		hostValidation.scheduleValidation( 'WDQS_PUBLIC_HOST', form.WDQS_PUBLIC_HOST );
	}

	if ( name === 'MW_ADMIN_PASS' || name === 'DB_PASS' ) {
		passwordValidation.scheduleValidation( name, value );
	}
}

function generateSecurePassword(): string {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
	const bytes = new Uint8Array( 24 );
	window.crypto.getRandomValues( bytes );
	return Array.from( bytes, ( byte ) => alphabet[ byte % alphabet.length ] ).join( '' );
}

function generatePasswordForField( name: PasswordFieldName ): void {
	const password = generateSecurePassword();
	touchField( name );
	updateField( name, password );
	void passwordValidation.validateNow( name, password );
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
	clearSaveError();
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
		saveErrorMessage.value = 'Configuration could not be saved';
		saveErrorDetails.value = error instanceof SaveConfigError ? error.details : [];
	}
}

function submitCurrentStep(): void {
	if ( configLocked.value ) {
		return;
	}

	if ( currentStep.value === 0 && initialState.existingInstallState !== 'previous' ) {
		currentStep.value = 1;
	} else if ( currentStep.value === 1 ) {
		void continueToAccount();
	} else if ( currentStep.value === 2 ) {
		void continueToDatabase();
	} else if ( currentStep.value === 3 ) {
		void startSetup();
	}
}

function clearSaveError(): void {
	saveErrorMessage.value = '';
	saveErrorDetails.value = [];
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
	}

	await Promise.all( [
		hostValidation.validateNow( 'WIKIBASE_PUBLIC_HOST', form.WIKIBASE_PUBLIC_HOST ),
		hostValidation.validateNow( 'WDQS_PUBLIC_HOST', form.WDQS_PUBLIC_HOST ),
		passwordValidation.validateNow( 'MW_ADMIN_PASS', form.MW_ADMIN_PASS ),
		passwordValidation.validateNow( 'DB_PASS', form.DB_PASS )
	] );

	if ( initialSetupComplete ) {
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
			if ( !value ||
				!isValidSetupHostname( value, initialState.isLocalhostSetup ) ||
				hostValidation.statuses[ name ] === 'valid'
			) {
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
