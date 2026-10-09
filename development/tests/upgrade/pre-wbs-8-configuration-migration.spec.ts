import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configurationDirectory = resolve( process.cwd(), 'upgrade/tmp/config' );
const localSettingsPath = resolve( configurationDirectory, 'LocalSettings.php' );
const instanceSettingsPath = resolve( configurationDirectory, 'InstanceSettings.php' );
const backupPath = resolve( configurationDirectory, 'backups/LocalSettings.pre-wbs-8.php.backup' );
const migrationStatePath = resolve( configurationDirectory, '.wikibase-image/config-migration' );

async function prepareLegacyConfiguration( contents: string ): Promise<void> {
	await testEnv.runDockerComposeCmd( 'stop wikibase wikibase-jobrunner' );
	rmSync( configurationDirectory, { recursive: true, force: true } );
	mkdirSync( configurationDirectory, { recursive: true } );
	writeFileSync( localSettingsPath, contents );
}

for ( const [ configurationShape, fixtureDirectory ] of [
	[ 'WBS 7 split settings', 'wbs-7' ],
	[ 'WBS 1–6 inline settings', 'wbs-1-to-6' ],
] ) {
	describe( 'Pre-WBS 8 configuration migration (' + configurationShape + ')', function () {
		it( 'migrates the configuration', async function () {
			const fixture = readFileSync(
				resolve( process.cwd(), 'upgrade/fixtures/' + fixtureDirectory + '/LocalSettings.php' ),
				'utf8'
			);
			await prepareLegacyConfiguration( fixture );
			if ( fixtureDirectory === 'wbs-1-to-6' ) {
				// Earlier rejected attempts may leave an incomplete staging directory.
				mkdirSync( migrationStatePath, { recursive: true } );
			}
			await testEnv.runDockerComposeCmd( 'up -d --wait --wait-timeout 180 wikibase wikibase-jobrunner' );

			const instanceSettings = readFileSync( instanceSettingsPath, 'utf8' );
			const localSettings = readFileSync( localSettingsPath, 'utf8' );
			expect( readFileSync( backupPath, 'utf8' ) ).toBe( fixture );
			expect( existsSync( migrationStatePath ) ).toBe( false );
			expect( instanceSettings ).toContain( "$wgDBpassword = 'test-db-password';" );
			expect( instanceSettings ).not.toContain( 'custom-logo.svg' );
			expect( localSettings ).toContain( "$wgJobRunRate = 0.5;" );
			expect( localSettings ).toContain( "$wgAllowExternalImages = true;" );
			expect( localSettings ).toContain( "wfLoadExtension( 'WikibaseEdtf' );" );
			expect( localSettings ).toContain( "require_once __DIR__ . '/Extensions.php';" );
			for ( const oldLoader of [
				'/LocalSettings.MediaWiki.php',
				'/LocalSettings.Extensions.php',
				'LocalSettings.d/*.php'
			] ) {
				expect( localSettings ).not.toContain( oldLoader );
			}

			const configurationOutput = await testEnv.runDockerComposeCmd(
				'exec -T wikibase php /var/www/html/maintenance/run.php getConfiguration --format=json --json-partial-output-on-error'
			);
			const effective = JSON.parse( configurationOutput.slice(
				configurationOutput.indexOf( '{' ), configurationOutput.lastIndexOf( '}' ) + 1
			) );
			for ( const right of [ 'edit', 'createpage', 'createtalk', 'createaccount' ] ) {
				expect( effective.wgGroupPermissions[ '*' ][ right ] ).toBe( fixtureDirectory === 'wbs-1-to-6' );
			}
			expect( effective.wgGroupPermissions[ '*' ].writeapi ).toBe( false );

			await browser.url( '/wiki/Main_Page' );
			await expect( $( 'body' ) ).toHaveElementClass( 'skin-monobook' );
			await expect( $( '#firstHeading' ) ).toHaveText( 'Main Page' );
		} );
	} );
}

describe( 'Pre-WBS 8 configuration rejection', function () {
	it( 'leaves an unrecognized file untouched and migrates it after correction', async function () {
		const fixture = readFileSync(
			resolve( process.cwd(), 'upgrade/fixtures/wbs-7/LocalSettings.php' ), 'utf8'
		);
		const include = "require_once '/LocalSettings.MediaWiki.php';";
		const unrecognized = fixture.replace( include, include + '\n' + include );
		await prepareLegacyConfiguration( unrecognized );
		const migrationCommand = 'run --rm --no-deps --entrypoint /bin/bash wikibase ' +
			'/var/www/html/extensions/WikibaseSuite/setup/migration/migrate.sh';
		let errorMessage = '';
		try {
			await testEnv.runDockerComposeCmd( migrationCommand );
		} catch ( error ) {
			errorMessage = String( error );
		}
		for ( const text of [
			'The file is unchanged.',
			'For WBS 7:',
			'For WBS 1–6',
			'https://phabricator.wikimedia.org/maniphest/task/edit/form/129/'
		] ) {
			expect( errorMessage ).toContain( text );
		}
		expect( readFileSync( localSettingsPath, 'utf8' ) ).toBe( unrecognized );
		expect( existsSync( instanceSettingsPath ) ).toBe( false );
		expect( existsSync( backupPath ) ).toBe( false );
		expect( existsSync( migrationStatePath ) ).toBe( false );

		writeFileSync( localSettingsPath, fixture );
		await testEnv.runDockerComposeCmd( 'up -d --wait --wait-timeout 180 wikibase wikibase-jobrunner' );
		expect( existsSync( instanceSettingsPath ) ).toBe( true );
		expect( readFileSync( localSettingsPath, 'utf8' ) ).not.toContain( include );
	} );
} );
