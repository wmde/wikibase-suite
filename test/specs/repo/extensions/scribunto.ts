import { readFile } from 'fs/promises';
import LoginPage from '../../../helpers/pages/login.page.js';
import { utf8 } from '../../../helpers/read-file-encoding.js';

const pageSuffix = Date.now();
const moduleName = `Bananas-${ pageSuffix }`;
const testPage = `LuaTest-${ pageSuffix }`;

// Test the installation and function of lua in the Wikibase Docker image
describe( 'Scribunto', function () {
	beforeEach( async function () {
		await browser.skipIfExtensionNotPresent( this, 'Scribunto' );
	} );

	before( async function () {
		await LoginPage.login(
			testEnv.vars.MW_ADMIN_NAME,
			testEnv.vars.MW_ADMIN_PASS
		);
	} );

	it( 'Should be able to execute lua module', async function () {
		// eslint-disable-next-line security/detect-non-literal-fs-filename
		const fileContents = await readFile(
			new URL( 'bananas.lua', import.meta.url ),
			utf8
		);
		await browser.editPage(
			testEnv.vars.WIKIBASE_URL,
			`Module:${ moduleName }`,
			fileContents
		);

		const executionContent = await browser.editPage(
			testEnv.vars.WIKIBASE_URL,
			testPage,
			`{{#invoke:${ moduleName }|hello}}`
		);

		// should come from executed lua script
		expect( executionContent ).toMatch( 'Hello, world!' );
	} );

	it( 'Should be able to execute lua module within 0.05 seconds', async function () {
		const cpuTime = await browser.getLuaCpuTime(
			testEnv.vars.WIKIBASE_URL,
			testPage
		);

		expect( cpuTime.value ).toBeLessThan( 0.05 );
		expect( cpuTime.scale ).toEqual( 'seconds' );
	} );
} );
