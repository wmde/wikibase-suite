import {
	ADMIN_EMAIL,
	ADMIN_PASSWORD,
	ADMIN_USERNAME,
	DATABASE_NAME,
	DATABASE_PASSWORD,
	DATABASE_USER,
	INSTALLER_ACCESS_CODE,
	INSTALL_TIMEOUT,
	WIKIBASE_URL,
	verifyFinalizedInstallerArtifacts,
	verifyInstallerContainerIsolation,
	verifySubmittedInstallerConfiguration,
	waitForInstalledServicesHealthy,
	waitForInstallerStopped
} from './test-environment.js';

async function setField( name: string, value: string ): Promise<void> {
	const field = await $( `input[name="${ name }"]` );
	await field.waitForDisplayed();
	await field.setValue( value );
	await browser.keys( 'Tab' );
}

async function clickEnabledButton( label: string ): Promise<void> {
	const button = await $( `button=${ label }` );
	await button.waitForClickable();
	await button.click();
}

describe( 'Complete installer user journey', () => {
	it( 'configures, installs, finalizes, and signs in to a healthy Wikibase Suite', async () => {
		await browser.url( '/' );
		await expect( $( 'dialog' ) ).toBeDisplayed();
		await expect( $( 'h1=Enter installer access code' ) ).toBeDisplayed();
		await setField( 'code', '000000' );
		await clickEnabledButton( 'Continue' );
		await expect( $( '.error' ) ).toHaveText(
			expect.stringContaining( '4 attempts remaining' )
		);
		await setField( 'code', INSTALLER_ACCESS_CODE );
		await clickEnabledButton( 'Continue' );
		await expect( $( 'h1=Installer' ) ).toBeDisplayed();

		await browser.deleteCookies();
		await browser.url( `/access/${ INSTALLER_ACCESS_CODE }` );
		await expect( browser ).toHaveUrl( expect.not.stringContaining( '/access/' ) );
		await expect( $( 'h1=Installer' ) ).toBeDisplayed();
		await browser.refresh();
		await expect( $( 'h1=Installer' ) ).toBeDisplayed();
		await clickEnabledButton( 'Get started' );

		await setField( 'WIKIBASE_PUBLIC_HOST', 'wikibase.test' );
		await setField( 'WDQS_PUBLIC_HOST', 'query.wikibase.test' );
		await clickEnabledButton( 'Continue' );

		await setField( 'MW_ADMIN_EMAIL', ADMIN_EMAIL );
		await setField( 'MW_ADMIN_NAME', ADMIN_USERNAME );
		await setField( 'MW_ADMIN_PASS', ADMIN_PASSWORD );
		await clickEnabledButton( 'Continue' );

		await setField( 'DB_NAME', DATABASE_NAME );
		await setField( 'DB_USER', DATABASE_USER );
		await setField( 'DB_PASS', DATABASE_PASSWORD );
		await clickEnabledButton( 'Continue' );

		await expect( $( 'h2=Visibility' ) ).toBeDisplayed();
		const visibilityCheckbox = await $( 'input[name="METADATA_CALLBACK"]' );
		await expect( visibilityCheckbox ).not.toBeSelected();
		await visibilityCheckbox.click();
		await expect( visibilityCheckbox ).toBeSelected();
		await clickEnabledButton( 'Start installation' );
		verifyInstallerContainerIsolation();

		const completionHeading = await $( 'h2=Installation complete! 🎉' );
		await completionHeading.waitForDisplayed( { timeout: INSTALL_TIMEOUT } );
		await waitForInstalledServicesHealthy();
		verifySubmittedInstallerConfiguration();
		await clickEnabledButton( 'View log' );
		await expect( $( '#log-content' ) ).toHaveText(
			expect.stringContaining( 'Starting Wikibase Suite services...' )
		);
		const stopInstallerButton = await $(
			'.installation-log-dialog .shutdown-panel button'
		);
		await stopInstallerButton.waitForDisplayed();
		await stopInstallerButton.waitForEnabled();
		await stopInstallerButton.scrollIntoView( { block: 'center' } );
		await stopInstallerButton.waitForClickable();
		await stopInstallerButton.click();
		await waitForInstallerStopped();
		verifyFinalizedInstallerArtifacts();

		await browser.url( `${ WIKIBASE_URL }/wiki/Special:UserLogin` );
		await setField( 'wpName', ADMIN_USERNAME );
		await setField( 'wpPassword', ADMIN_PASSWORD );
		await clickEnabledButton( 'Log in' );
		await expect( $( '#pt-userpage-2' ) ).toBeDisplayed();
	} );
} );
