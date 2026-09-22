import WikibaseApi from 'wdio-wikibase/wikibase.api.js';
import ItemPage from '../_helpers/pages/entity/item.page.js';
import LoginPage from '../_helpers/pages/login.page.js';
import PropertyPage from '../_helpers/pages/entity/property.page.js';
import page from '../_helpers/pages/page.js';
import propertyIdSelector from '../_helpers/property-id-selector.js';
import { Claim } from '../_types/entity-data.js';

describe( 'WikibaseLocalMedia', function () {
	let propertyId: string;
	let propertyLabel: string;

	beforeEach( async function () {
		await browser.skipIfExtensionNotPresent( this, 'Wikibase Local Media' );
		await browser.waitForJobs();
	} );

	it( 'Should allow to upload an image', async function () {
		await LoginPage.login(
			testEnv.vars.MW_ADMIN_NAME,
			testEnv.vars.MW_ADMIN_PASS
		);

		await page.open( '/wiki/Special:Upload/' );

		const filePath = new URL( 'image.png', import.meta.url );
		await $( '#wpUploadFile' ).setValue( filePath.pathname );

		await $( 'input.mw-htmlform-submit' ).click();

		await expect( $( '#firstHeading' ) ).toHaveText( 'File:Image.png' );
	} );

	it( 'Should allow to create a property with localMedia datatype', async function () {
		propertyLabel = `local-media-${ Date.now() }`;
		propertyId = await WikibaseApi.createProperty(
			'localMedia',
			{
				labels: {
					en: {
						language: 'en',
						value: propertyLabel
					}
				}
			}
		);
		expect( propertyId ).toMatch( /^P\d+$/ );
		await browser.waitUntil(
			async () => {
				const result = await browser.makeRequest(
					`${ testEnv.vars.WIKIBASE_URL }/w/api.php?action=wbsearchentities&search=${ encodeURIComponent( propertyLabel ) }&format=json&errorformat=plaintext&language=en&uselang=en&type=property`
				);
				return result.data.search.some(
					( property ) => property.id === propertyId
				);
			},
			{
				timeoutMsg: `Expected ${ propertyId } to appear in property search`
			}
		);

		await PropertyPage.open( propertyId );
		await expect( $( '#firstHeading' ) ).toHaveText(
			`${ propertyLabel } (${ propertyId })`
		);
	} );

	it( 'Should allow to use uploaded image on statement', async function () {
		const data: { claims: Claim[] } = {
			claims: [
				{
					mainsnak: {
						snaktype: 'value',
						property: propertyId,
						datavalue: { value: 'Image.png', type: 'string' }
					},
					type: 'statement',
					rank: 'normal'
				}
			]
		};

		const itemId = await WikibaseApi.createItem( 'image-test', data );

		await ItemPage.open( itemId );
		await expect( $( '.wikibase-snakview-value img' ) ).toHaveAttr(
			'src',
			/Image\.png/
		);
	} );

	it( 'Should allow to use uploaded image on statement in UI', async function () {
		const itemId = await WikibaseApi.createItem( 'image-test-2' );

		await ItemPage.open( itemId );

		await $( '=add statement' ).click();

		await browser.keys( propertyLabel.split( '' ) );
		await propertyIdSelector( propertyId, propertyLabel ).click();

		await browser.keys( 'image.png'.split( '' ) );

		const saveButtonSelector =
			'.wikibase-toolbar-button-save[aria-disabled="false"] a';
		await $( saveButtonSelector ).waitForClickable();
		// eslint-disable-next-line wdio/no-pause -- LocalMedia replaces Save while validating the filename.
		await browser.pause( 300 );
		await $( saveButtonSelector ).waitForClickable();
		await $( saveButtonSelector ).click();

		await expect( $( 'div.commons-media-caption' ).$( 'a' ) ).toHaveText( 'Image.png' );
	} );
} );
