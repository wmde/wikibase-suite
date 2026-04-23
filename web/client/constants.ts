import type { ConfigForm, SetupProgressMarker } from './types';

export const HOST_NAME_REGEX = /^(localhost|([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})$/;
export const HOST_VALIDATION_DEBOUNCE_MS = 450;
export const PASSWORD_VALIDATION_DEBOUNCE_MS = 350;
export const HOST_VALIDATION_POLL_MS = 3000;
export const BOOT_COMPLETE_REGEX = /setup is complete!?/i;
export const STATUS_LOG_ENTRY_REGEX = /\[status\]\s*(.*)$/i;

export const DEFAULT_FORM: ConfigForm = {
	MW_ADMIN_EMAIL: '',
	WIKIBASE_PUBLIC_HOST: '',
	WDQS_PUBLIC_HOST: '',
	METADATA_CALLBACK: true,
	MW_ADMIN_NAME: 'Admin',
	MW_ADMIN_PASS: '',
	DB_NAME: '',
	DB_USER: '',
	DB_PASS: ''
};

export const SETUP_PROGRESS_MARKERS: SetupProgressMarker[] = [
	{
		pattern: /Configuration saved\./i,
		progress: 20,
		summary: 'Configuration saved. Preparing service startup.'
	},
	{
		pattern: /Removing config\/LocalSettings\.php \(RESET=true\)/i,
		progress: 25,
		summary: 'Removing the previous MediaWiki configuration.'
	},
	{
		pattern: /Taking down any existing wbs-deploy services and data \(RESET=true\)/i,
		progress: 35,
		summary: 'Removing existing services and data before restart.'
	},
	{
		pattern: /Starting Docker Compose services\.\.\./i,
		progress: 55,
		summary: 'Starting the Wikibase Suite services.'
	},
	{
		pattern: /Waiting for services to start\./i,
		progress: 70,
		summary: 'Waiting for the services to come online. This usually takes 2-6 minutes.'
	},
	{
		pattern: /Docker Compose services reported ready\./i,
		progress: 90,
		summary: 'Services reported ready. Finishing setup details.'
	},
	{
		pattern: /SKIP_LAUNCH=true; not starting services\./i,
		progress: 60,
		summary: 'Setup stopped before service launch because skip-launch mode is enabled. No services were started.'
	},
	{
		pattern: /Setup is Complete!?/i,
		progress: 100,
		summary: 'Setup complete. Your services are ready.'
	}
];
