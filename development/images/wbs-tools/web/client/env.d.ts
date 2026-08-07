/// <reference types="vite/client" />

import type { InitialInstallerState } from './types';

declare global {
	interface Window {
		__INSTALLER_STATE__?: InitialInstallerState;
	}
}
