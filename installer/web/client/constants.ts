import type { ConfigForm, SetupProgressEvent } from './types';
export { HOST_NAME_REGEX } from '../shared/validation.ts';

export const HOST_VALIDATION_DEBOUNCE_MS = 450;
export const PASSWORD_VALIDATION_DEBOUNCE_MS = 350;
export const HOST_VALIDATION_POLL_MS = 3000;
export const SETUP_PULL_PROGRESS_TIMER_MS = 2 * 60 * 1000;
export const SETUP_STARTUP_PROGRESS_TIMER_MS = 4 * 60 * 1000;
export const SETUP_PROGRESS_TIMER_TICK_MS = 250;
export const SETUP_STATUS_LINE_LIMIT = 6;
export const TIMESTAMPED_LOG_ENTRY_REGEX = /^\d{4}-\d{2}-\d{2}T\S+\s+(.*)$/;
export const DEBUG_LOG_SUFFIX_REGEX = /\s\[debug\]$/i;
export const STATUS_CODE_SUFFIX_REGEX = /\s\[([a-z0-9_]+)\]$/i;

export const DEFAULT_FORM: ConfigForm = {
	MW_ADMIN_EMAIL: '',
	WIKIBASE_PUBLIC_HOST: '',
	WDQS_PUBLIC_HOST: '',
	METADATA_CALLBACK: true,
	MW_ADMIN_NAME: '',
	MW_ADMIN_PASS: '',
	DB_NAME: 'my_wiki',
	DB_USER: 'sqluser',
	DB_PASS: ''
};

export const SETUP_PROGRESS_EVENTS: Record<string, SetupProgressEvent> = {
	config_saved: {
		progress: 6,
		summary: 'Configuration saved. Preparing service startup.'
	},
	reset_config_removed: {
		progress: 8,
		summary: 'Removing the previous MediaWiki configuration.'
	},
	reset_services_removed: {
		progress: 10,
		summary: 'Removing existing services and data before restart.'
	},
	images_pull_started: {
		progress: 15,
		summary: 'Pulling Docker images for the Wikibase Suite services.',
		startTimer: true,
		timerTarget: 45,
		timerMs: SETUP_PULL_PROGRESS_TIMER_MS
	},
	services_waiting: {
		progress: 50,
		summary: 'Starting Wikibase Suite. This usually takes 2-6 minutes.',
		startTimer: true,
		timerTarget: 95,
		timerMs: SETUP_STARTUP_PROGRESS_TIMER_MS
	},
	services_ready: {
		progress: 95,
		summary: 'Services reported ready. Finishing installation details.',
		stopTimer: true
	},
	launch_skipped: {
		progress: 60,
		summary: 'Installation stopped before service launch because skip-launch mode is enabled. No services were started.',
		stopTimer: true
	},
	setup_complete: {
		progress: 100,
		summary: 'Installation complete. Your services are ready.',
		stopTimer: true
	}
};
