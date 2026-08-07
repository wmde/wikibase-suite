import type { getConfig } from '../lib/configuration.js';
import {
	appendInstallationLog,
	clearInstallationLog
} from '../lib/installation-log.js';
import { appendWbsLogEntry } from '../lib/wbs-log.js';

type ConfigResponse = ReturnType<typeof getConfig>;

const MOCK_INSTALLATION_EVENTS = [
	{ delayMs: 250, message: 'Configuration saved.', code: 'config_saved' },
	{ delayMs: 900, message: 'Pulling Docker images...', code: 'images_pull_started' },
	{ delayMs: 1700, message: 'Starting Docker Compose services...', code: 'services_waiting' },
	{ delayMs: 2700, message: 'Docker Compose services reported ready.', code: 'services_ready' },
	{ delayMs: 3400, message: 'Installation is complete.', code: 'installation_complete' }
] as const;

export interface MockInstallation {
	getConfigResponse(): ConfigResponse | null;
	start( configResponse: ConfigResponse ): void;
}

export function createMockInstallation( logPath: string ): MockInstallation {
	let configResponse: ConfigResponse | null = null;
	let timers: ReturnType<typeof setTimeout>[] = [];

	return {
		getConfigResponse(): ConfigResponse | null {
			return configResponse;
		},
		start( nextConfigResponse: ConfigResponse ): void {
			configResponse = nextConfigResponse;
			for ( const timer of timers ) {
				clearTimeout( timer );
			}
			timers = [];
			clearInstallationLog( logPath );

			for ( const event of MOCK_INSTALLATION_EVENTS ) {
				timers.push( setTimeout( () => {
					appendWbsLogEntry( event.message );
					appendInstallationLog( event.message, event.code, logPath );
				}, event.delayMs ) );
			}
		}
	};
}
