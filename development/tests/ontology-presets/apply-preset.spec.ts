import LoginPage from '../_helpers/pages/login.page.js';
import page from '../_helpers/pages/page.js';

describe( 'Core Properties preset', function () {
	it( 'lets an administrator apply the preset once and still find it in the sidebar', async function () {
		const dashboard = '/wiki/Special:WikibaseDashboard';
		const presets = '/wiki/Special:OntologyPresets';
		const sidebarLink = $( '#n-ontology-presets a' );
		const dashboardLink = $( '.wbs-dashboard-ontology-presets-button' );
		const createProperties = $( 'button=Create Properties' );
		const propertyTable = $( '.ext-wikibase-ontology-presets-catalog__table' );

		const username = 'PresetEditor';
		const password = 'PresetEditorExamplePassword';
		await testEnv.runDockerComposeCmd(
			`exec -T wikibase php /var/www/html/maintenance/run.php createAndPromote "${ username }" "${ password }"`
		);

		await LoginPage.login( username, password );
		await page.open( dashboard );
		await expect( sidebarLink ).not.toExist();
		await expect( dashboardLink ).not.toExist();
		await page.open( presets );
		await expect( $( '.permissions-errors' ) ).toBeDisplayed();

		await browser.deleteCookies();
		await LoginPage.login( testEnv.vars.MW_ADMIN_NAME, testEnv.vars.MW_ADMIN_PASS );
		await page.open( dashboard );
		await expect( sidebarLink ).toBeDisplayed();
		await dashboardLink.click();

		await expect( propertyTable.$$( 'tbody tr' ) ).toBeElementsArrayOfSize( 8 );
		await expect( $( 'h2=Formatter URL/URI configuration' ) ).toBeDisplayed();
		await createProperties.click();
		await $( '.cdx-dialog' ).$( 'button=Create Properties' ).click();
		await expect( $( '.ext-wikibase-ontology-presets-completion' ) )
			.toHaveText( /8 properties were created/ );

		await page.open( dashboard );
		await expect( dashboardLink ).not.toExist();
		await sidebarLink.click();
		await expect( $( 'span=Unavailable because this Wikibase has already used property IDs' ) )
			.toBeDisplayed();
		await expect( createProperties ).not.toExist();
		await expect( propertyTable ).toBeDisplayed();
	} );
} );
