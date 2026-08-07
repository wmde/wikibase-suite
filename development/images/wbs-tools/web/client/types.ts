export type InstallerStep = 0 | 1 | 2 | 3 | 4 | 5;

export type FieldValidationStatus = 'neutral' | 'pending' | 'valid' | 'invalid';
export type ExistingInstallState = 'none' | 'running' | 'previous';

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

export type InitialInstallerState = {
	installerDevMock: boolean;
	configurationOnly: boolean;
	isConfigSaved: boolean;
	isBooted: boolean;
	isInstallationStarted: boolean;
	existingInstallState: ExistingInstallState;
	isLocalMode: boolean;
	serverIp: string;
};

export type InstallationProgressEvent = {
	progress: number;
	summary: string;
	failed?: boolean;
	startTimer?: boolean;
	stopTimer?: boolean;
	timerTarget?: number;
	timerMs?: number;
};
