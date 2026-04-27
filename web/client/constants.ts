import type { ConfigForm, SetupProgressMarker } from './types';
export { HOST_NAME_REGEX } from '../shared/validation.ts';

export const HOST_VALIDATION_DEBOUNCE_MS = 450;
export const PASSWORD_VALIDATION_DEBOUNCE_MS = 350;
export const HOST_VALIDATION_POLL_MS = 3000;
export const SETUP_PULL_PROGRESS_TIMER_MS = 2 * 60 * 1000;
export const SETUP_STARTUP_PROGRESS_TIMER_MS = 4 * 60 * 1000;
export const SETUP_PROGRESS_TIMER_TICK_MS = 1000;
export const SETUP_STATUS_LINE_LIMIT = 6;
export const BOOT_COMPLETE_REGEX = /setup is complete!?/i;
export const STATUS_LOG_ENTRY_REGEX = /\[status\]\s*(.*)$/i;

export const DEFAULT_FORM: ConfigForm = {
	MW_ADMIN_EMAIL: '',
	WIKIBASE_PUBLIC_HOST: '',
	WDQS_PUBLIC_HOST: '',
	METADATA_CALLBACK: true,
	MW_ADMIN_NAME: 'Admin',
	MW_ADMIN_PASS: '',
	DB_NAME: 'my_wiki',
	DB_USER: 'sqluser',
	DB_PASS: ''
};

export const SETUP_PROGRESS_MARKERS: SetupProgressMarker[] = [
	{
		pattern: /Configuration saved\./i,
		progress: 6,
		summary: 'Configuration saved. Preparing service startup.'
	},
	{
		pattern: /Removing config\/LocalSettings\.php \(RESET=true\)/i,
		progress: 8,
		summary: 'Removing the previous MediaWiki configuration.'
	},
	{
		pattern: /Taking down any existing wbs-deploy services and data \(RESET=true\)/i,
		progress: 10,
		summary: 'Removing existing services and data before restart.'
	},
	{
		pattern: /Pulling Docker images\.\.\./i,
		progress: 15,
		summary: 'Pulling Docker images for the Wikibase Suite services.',
		startTimer: true
		,
		timerTarget: 45,
		timerMs: SETUP_PULL_PROGRESS_TIMER_MS
	},
	{
		pattern: /Starting Docker Compose services\.\.\./i,
		progress: 50,
		summary: 'Starting the Wikibase Suite services.'
	},
	{
		pattern: /Waiting for services to start\./i,
		progress: 60,
		summary: 'Starting Wikibase Suite. This usually takes 2-6 minutes.',
		startTimer: true,
		timerTarget: 95,
		timerMs: SETUP_STARTUP_PROGRESS_TIMER_MS
	},
	{
		pattern: /Docker Compose services reported ready\./i,
		progress: 95,
		summary: 'Services reported ready. Finishing setup details.',
		stopTimer: true
	},
	{
		pattern: /SKIP_LAUNCH=true; not starting services\./i,
		progress: 60,
		summary: 'Setup stopped before service launch because skip-launch mode is enabled. No services were started.',
		stopTimer: true
	},
	{
		pattern: /Setup is Complete!?/i,
		progress: 100,
		summary: 'Setup complete. Your services are ready.',
		stopTimer: true
	}
];
