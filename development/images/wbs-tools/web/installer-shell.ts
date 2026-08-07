import { readFileSync } from 'fs';
import {
	getExistingInstallState,
	isBooted,
	isConfigSaved,
	isLocalMode,
	isInstallationStarted
} from '../lib/configuration.js';

export interface InstallerShellOptions {
	configurationOnly: boolean;
	devServer: boolean;
	indexTemplatePath: string;
	installerDevMock: boolean;
	serverIp: string;
}

function escapeJsonForHtml( value: unknown ): string {
	return JSON.stringify( value ).replace( /</g, '\\u003c' );
}

function escapeHtmlAttribute( value: string ): string {
	return value
		.replace( /&/g, '&amp;' )
		.replace( /"/g, '&quot;' )
		.replace( /</g, '&lt;' )
		.replace( />/g, '&gt;' );
}

export function createInstallerShellRenderer(
	options: InstallerShellOptions
): ( scriptSrc: string ) => string {
	return ( scriptSrc: string ): string => {
		const initialState = {
			installerDevMock: options.installerDevMock,
			configurationOnly: options.configurationOnly,
			isConfigSaved: options.installerDevMock ? false : isConfigSaved(),
			isBooted: options.installerDevMock ? false : isBooted(),
			isInstallationStarted: options.installerDevMock ? false : isInstallationStarted(),
			existingInstallState: options.installerDevMock ? 'none' : getExistingInstallState(),
			isLocalMode: isLocalMode(),
			serverIp: options.serverIp
		};

		return readFileSync( options.indexTemplatePath, 'utf8' )
			.replace( '%INSTALLER_STATE%', escapeJsonForHtml( initialState ) )
			.replace(
				'%BUILT_STYLE_LINK%',
				options.devServer ? '' : '<link rel="stylesheet" href="/assets/installer-app.css" />'
			)
			.replace( '%SCRIPT_SRC%', escapeHtmlAttribute( scriptSrc ) );
	};
}
