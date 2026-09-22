import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import page from '../_helpers/pages/page.js';

type WikibaseSuiteVersions = {
	wikibaseImageVersion: string;
	wbsVersion: string;
	wbsToolsImage: string;
};

type WikibaseSuitePublicMetrics = {
	wikimediaLinkedUserCount?: number;
};

const getInstalledSoftwareVersionForProduct = async (
	productName: string
): Promise<string> =>
	$(
		`//*[@id="sv-software"]//tr[td and normalize-space(string(td[1]))="${ productName }"]/td[2]`
	).getText();

const normalizeVersionValue = ( value: string ): string => value.trim();
const getVersionOrEmpty = (
	source: Record<string, string>,
	key: string
): string => source[ key ] ?? '';
const getWbsManifestVersions = (): Omit<
	WikibaseSuiteVersions,
	'wikibaseImageVersion'
> => {
	const values = parseEnv(
		readFileSync( new URL( '../../../.wbs/version', import.meta.url ), 'utf8' )
	);
	return {
		wbsVersion: values.WBS_VERSION ?? '',
		wbsToolsImage: values.WBS_TOOLS_IMAGE ?? ''
	};
};

const getRuntimeVersionsFromWikibaseContainer =
	async (): Promise<WikibaseSuiteVersions> => {
		const runtimeOutput = await testEnv.runDockerComposeCmd(
			'exec -T wikibase sh -lc \'printf "wikibaseImageVersion=%s\\n" "$WIKIBASE_IMAGE_VERSION"; printf "wbsVersion=%s\\n" "$WBS_VERSION"; printf "wbsToolsImage=%s\\n" "$WBS_TOOLS_IMAGE"\''
		);
		const runtimeEntries = runtimeOutput
			.trim()
			.split( '\n' )
			.reduce( ( entries, line ) => {
				const [ key, ...rest ] = line.split( '=' );
				entries[ key ] = rest.join( '=' );
				return entries;
			}, {} as Record<string, string> );

		return {
			wikibaseImageVersion:
				runtimeEntries.wikibaseImageVersion ?? '',
			wbsVersion: runtimeEntries.wbsVersion ?? '',
			wbsToolsImage: runtimeEntries.wbsToolsImage ?? ''
		};
	};

const getWikibaseSuiteApiVersions =
	async (): Promise<WikibaseSuiteVersions> => {
		const result = await browser.makeRequest(
			testEnv.vars.WIKIBASE_URL + '/w/api.php?action=query&meta=wikibasesuite&wbsprop=versions&format=json'
		);

		const apiVersions = result.data.query.wikibasesuite.versions;
		return {
			wikibaseImageVersion:
				getVersionOrEmpty( apiVersions, 'wikibase_image_version' ),
			wbsVersion: getVersionOrEmpty( apiVersions, 'wbs_version' ),
			wbsToolsImage: getVersionOrEmpty( apiVersions, 'wbs_tools_image' )
		};
	};

const getWikibaseSuiteApiPublicMetrics =
	async (): Promise<WikibaseSuitePublicMetrics> => {
		const result = await browser.makeRequest(
			testEnv.vars.WIKIBASE_URL + '/w/api.php?action=query&meta=wikibasesuite&wbsprop=publicmetrics&format=json'
		);

		expect( result.data.error ).toBeUndefined();
		const apiMetrics = result.data.query.wikibasesuite.publicmetrics;
		return {
			wikimediaLinkedUserCount: apiMetrics.wikimedia_linked_user_count
		};
	};

describe( 'Wikibase Suite extension', function () {
	let runtimeVersions: WikibaseSuiteVersions;

	before( async function () {
		runtimeVersions = await getRuntimeVersionsFromWikibaseContainer();
	} );

	it( 'Should expose suite versions through action API', async function () {
		const versions = await getWikibaseSuiteApiVersions();

		expect( normalizeVersionValue( versions.wikibaseImageVersion ) ).toEqual(
			normalizeVersionValue( runtimeVersions.wikibaseImageVersion )
		);
		expect( normalizeVersionValue( versions.wbsVersion ) ).toEqual(
			normalizeVersionValue( runtimeVersions.wbsVersion )
		);
		expect( normalizeVersionValue( versions.wbsToolsImage ) ).toEqual(
			normalizeVersionValue( runtimeVersions.wbsToolsImage )
		);
	} );

	it( 'Should include suite versions on Special:Version', async function () {
		await page.open( '/wiki/Special:Version' );
		const dockerImageVersion = await getInstalledSoftwareVersionForProduct(
			'Wikibase Suite Docker Image'
		);
		expect( normalizeVersionValue( dockerImageVersion ) ).toEqual(
			normalizeVersionValue( runtimeVersions.wikibaseImageVersion )
		);

		const wbsVersion = await getInstalledSoftwareVersionForProduct(
			'Wikibase Suite'
		);
		expect( normalizeVersionValue( wbsVersion ) ).toEqual(
			normalizeVersionValue( runtimeVersions.wbsVersion )
		);

		const wbsToolsImage = await getInstalledSoftwareVersionForProduct(
			'Wikibase Suite Tools'
		);
		expect( normalizeVersionValue( wbsToolsImage ) ).toEqual(
			normalizeVersionValue( runtimeVersions.wbsToolsImage )
		);
	} );

	it( 'Should be listed on Special:Version with its extension version', async function () {
		await page.open( '/wiki/Special:Version' );
		const extensionInfo = await $( '#mw-version-ext-other-WikibaseSuite' ).getText();
		await expect( extensionInfo ).toMatch( /Wikibase Suite.*1\.0\.0/ );
	} );

	it( 'Should expose Wikimedia linked user count through public metrics', async function () {
		const metrics = await getWikibaseSuiteApiPublicMetrics();

		expect( metrics.wikimediaLinkedUserCount ).toEqual( 0 );
	} );

	it( 'Should expose the WBS release manifest in the wikibase service', function () {
		const manifestVersions = getWbsManifestVersions();
		expect( normalizeVersionValue( runtimeVersions.wbsVersion ) ).toEqual(
			normalizeVersionValue( manifestVersions.wbsVersion )
		);
		expect( normalizeVersionValue( runtimeVersions.wbsToolsImage ) ).toEqual(
			normalizeVersionValue( manifestVersions.wbsToolsImage )
		);
	} );
} );
