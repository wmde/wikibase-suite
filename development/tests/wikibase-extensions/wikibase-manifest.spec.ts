describe( 'WikibaseManifest', function () {
	beforeEach( async function () {
		await browser.skipIfExtensionNotPresent( this, 'WikibaseManifest' );
	} );

	it( 'Should have rest endpoint and data', async function () {
		const result = await browser.makeRequest(
			testEnv.vars.WIKIBASE_URL + '/w/rest.php/wikibase-manifest/v0/manifest'
		);
		const data = result.data;

		expect( data.name ).toEqual( 'wikibase' );

		expect( data.api.action ).toEqual( testEnv.vars.WIKIBASE_URL + '/w/api.php' );
		expect( data.api.rest ).toEqual( testEnv.vars.WIKIBASE_URL + '/w/rest.php' );

		expect( data.oauth.registration_page ).toEqual(
			testEnv.vars.WIKIBASE_URL + '/wiki/Special:OAuthConsumerRegistration'
		);

		expect( data.external_services.queryservice ).toEqual(
		  testEnv.vars.WDQS_URL + '/sparql'
		);
		expect( data.external_services.queryservice_ui ).toEqual(
		  testEnv.vars.WDQS_URL
		);
		expect( data.external_services.quickstatements ).toEqual(
		  testEnv.vars.QUICKSTATEMENTS_URL
		);
	} );
} );
