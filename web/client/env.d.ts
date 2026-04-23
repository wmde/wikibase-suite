/// <reference types="vite/client" />

import type { InitialSetupState } from './types';

declare global {
	interface Window {
		__SETUP_STATE__?: InitialSetupState;
	}
}
