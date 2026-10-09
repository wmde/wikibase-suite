describe( 'Legacy configuration recognition', function () {
	it( 'accepts historical loaders and harmless formatting while rejecting ambiguous layouts', async function () {
		const output = await testEnv.runDockerComposeCmd(
			'exec -T wikibase php /migration-tests/configuration-recognition.php ' +
			'/var/www/html/extensions/WikibaseSuite/setup/migration/MigrateConfiguration.php'
		);
		expect( output ).toContain( 'All configuration recognition checks passed.' );
	} );
} );
