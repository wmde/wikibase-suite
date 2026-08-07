import {
	isBooted,
	sanitizeConfig
} from '../lib/configuration.js';
import { clearInstallationLog } from '../lib/installation-log.js';

// 10 minutes
const AUTO_FINALIZE_TIMEOUT_MS = 10 * 60 * 1000;
const INSTALLATION_STATUS_POLL_MS = 5 * 1000;

export interface InstallerLifecycle {
	exit(): void;
	finalize(): void;
	startAutoFinalizeMonitor(): void;
}

export interface InstallerLifecycleOptions {
	configurationOnly: boolean;
	devServer: boolean;
	installerDevMock: boolean;
}

export function createInstallerLifecycle(
	options: InstallerLifecycleOptions
): InstallerLifecycle {
	function finalize(): void {
		if ( !options.installerDevMock ) {
			sanitizeConfig();
		}
		clearInstallationLog();
	}

	function exit(): void {
		setTimeout( () => process.exit( 0 ), 300 );
	}

	function scheduleAutoFinalizeAfterBoot(): void {
		if ( !isBooted() ) {
			setTimeout( scheduleAutoFinalizeAfterBoot, INSTALLATION_STATUS_POLL_MS );
			return;
		}

		console.log( '⏱️ Installation complete. Auto-finalize scheduled in 10 minutes.' );
		setTimeout( () => {
			try {
				finalize();
				console.log( '✅ Auto-finalize complete. Exiting...' );
				exit();
			} catch ( err ) {
				console.error( '❌ Auto-finalize failed:', err );
			}
		}, AUTO_FINALIZE_TIMEOUT_MS );
	}

	return {
		exit,
		finalize,
		startAutoFinalizeMonitor(): void {
			// A live-reload development server remains available until the developer replaces it.
			if ( !options.devServer && !options.configurationOnly ) {
				scheduleAutoFinalizeAfterBoot();
			}
		}
	};
}
