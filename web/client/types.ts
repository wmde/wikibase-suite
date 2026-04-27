export type WizardStep = 0 | 1 | 2;

export type FieldValidationStatus = 'neutral' | 'pending' | 'valid' | 'invalid';

export type ConfigForm = {
	MW_ADMIN_EMAIL: string;
	WIKIBASE_PUBLIC_HOST: string;
	WDQS_PUBLIC_HOST: string;
	METADATA_CALLBACK: boolean;
	MW_ADMIN_NAME: string;
	MW_ADMIN_PASS: string;
	DB_NAME: string;
	DB_USER: string;
	DB_PASS: string;
};

export type ConfigResponse = {
	config: Record<string, string>;
	configText: string;
};

export type InitialSetupState = {
	isConfigSaved: boolean;
	isBooted: boolean;
	isLocalhostSetup: boolean;
	serverIp: string;
};

export type SetupProgressMarker = {
	pattern: RegExp;
	progress: number;
	summary: string;
	startTimer?: boolean;
	stopTimer?: boolean;
	timerTarget?: number;
	timerMs?: number;
};
