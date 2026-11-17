import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configPath = resolve( 'upgrade/tmp/config/LocalSettings.php' );
const statePath = resolve( 'upgrade/tmp/config/.last-update' );
const setup = (): Promise<string> => testEnv.runDockerComposeCmd(
	'exec -T wikibase bash /var/www/html/extensions/WikibaseSuite/setup/setup.sh'
);

describe( 'MediaWiki updater lifecycle', function () {
	let originalConfig: string;
	let originalState: string;

	beforeEach( function () {
		originalConfig = readFileSync( configPath, 'utf8' );
		originalState = readFileSync( statePath, 'utf8' );
	} );

	afterEach( function () {
		writeFileSync( configPath, originalConfig );
		writeFileSync( statePath, originalState );
	} );

	it( 'updates changed configuration and skips the next unchanged run', async function () {
		writeFileSync( configPath, originalConfig + '\n// Changed configuration.\n' );

		assert.match( await setup(), /MediaWiki .* Updater/ );
		assert.notEqual( readFileSync( statePath, 'utf8' ), originalState );
		assert.match( await setup(), /Wikibase image is already up to date/ );
	} );

	it( 'preserves the last successful fingerprint when the updater fails', async function () {
		// Fingerprint generation succeeds; this hook fails inside the real updater.
		writeFileSync( configPath, originalConfig + `
$wgHooks['LoadExtensionSchemaUpdates'][] = static function () {
    throw new RuntimeException( 'Intentional updater failure' );
};
` );

		await assert.rejects( setup(), /Intentional updater failure/ );
		assert.equal( readFileSync( statePath, 'utf8' ), originalState );
	} );
} );
