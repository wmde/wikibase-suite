describe( 'OAuth extension', function () {
	it( 'Should allow creating a same-host callback consumer', async function () {
		const callbackUrl = `${ testEnv.vars.QUICKSTATEMENTS_URL }/api.php`;
		const consumerName = `WBS OAuth Test ${ Date.now() }`;
		const createConsumerCommand = [
			'exec -T wikibase',
			'php /var/www/html/extensions/OAuth/maintenance/createOAuthConsumer.php',
			'--approve',
			`--callbackUrl "${ callbackUrl }"`,
			'--callbackIsPrefix true',
			`--user "${ testEnv.vars.MW_ADMIN_NAME }"`,
			`--name "${ consumerName }"`,
			'--description "Wikibase Suite OAuth smoke test"',
			'--version 1.0.1',
			'--grants editpage',
			'--jsonOnSuccess'
		].join( ' ' );

		const output = await testEnv.runDockerComposeCmd( createConsumerCommand );
		const jsonMatch = output.match( /\{[\s\S]*\}/ );

		expect( jsonMatch ).not.toBeNull();
		if ( !jsonMatch ) {
			throw new Error( `Expected JSON output but got: ${ output }` );
		}
		const response = JSON.parse( jsonMatch[ 0 ] );

		expect( response.created ).toEqual( true );
		expect( response.approved ).toEqual( 1 );
		expect( response.key ).toMatch( /^[a-f0-9]{32}$/ );
		expect( response.secret ).toMatch( /^[a-f0-9]{40}$/ );
	} );
} );
