import WikibaseApi from 'wdio-wikibase/wikibase.api.js';
import ItemPage from '../_helpers/pages/entity/item.page.js';
import propertyIdSelector from '../_helpers/property-id-selector.js';
import SpecialEntityDataPage from '../_helpers/pages/special/entity-data.page.js';
import SpecialNewPropertyPage from '../_helpers/pages/special/new-property.page.js';

describe( 'WikibaseEdtf', function () {
	const propertyLabel = 'Groundhog Day Release';

	before( async function () {
		await browser.skipIfExtensionNotPresent( this, 'Wikibase EDTF' );
	} );

	it( 'Should allow to create and use the EDTF property', async function () {
		// create the property
		const propertyId = await WikibaseApi.createProperty( 'edtf' );
		expect( propertyId ).toMatch( /^P/ );

		const rawValue = '1985-04-12T23:20:30';

		const data = {
			claims: [
				{
					mainsnak: {
						snaktype: 'value',
						property: propertyId,
						datavalue: { value: rawValue, type: 'string' }
					},
					type: 'statement',
					rank: 'normal'
				}
			]
		};

		const itemId = await WikibaseApi.createItem( 'edtf-test', data );

		// go look at wikibase
		const responseData = await SpecialEntityDataPage.getData( itemId );
		const responseSnak =
			responseData.entities[ itemId ].claims[ propertyId ][ 0 ].mainsnak;

		expect( responseSnak.datavalue.value ).toEqual( '1985-04-12T23:20:30' );
		expect( responseSnak.datatype ).toEqual( 'edtf' );

		// for a pretty screenshot
		await ItemPage.open( itemId );
	} );

	it( 'Should allow to create and use the EDTF property in UI', async function () {
		// create the property
		await SpecialNewPropertyPage.open( { datatype: 'edtf' } );
		await SpecialNewPropertyPage.labelInput.setValue( propertyLabel );
		await SpecialNewPropertyPage.descriptionInput.setValue(
			'Date on which the film Groundhog Day was broadly released to theaters'
		);
		await SpecialNewPropertyPage.aliasesInput.setValue( 'Groundhog Day Opening' );
		await SpecialNewPropertyPage.submit();
		const propertyUrl = await browser.getUrl();
		const propertyIdMatch = propertyUrl.match( /Property:(P\d+)/ );
		if ( !propertyIdMatch ) {
			throw new Error( `Could not resolve property ID from URL: ${ propertyUrl }` );
		}
		const propertyId = propertyIdMatch[ 1 ];

		await browser.waitForJobs();

		const itemId = await WikibaseApi.createItem( 'edtf-test' );

		await ItemPage.open( itemId );
		await $( '=add statement' ).click();
		await browser.keys( propertyLabel.split( '' ) );
		const propertySuggestionById = propertyIdSelector( propertyId );
		const propertySuggestionByDescription = $(
			'span.ui-entityselector-description=Date on which the film Groundhog Day was broadly released to theaters'
		);
		await browser.waitUntil(
			async () =>
				await propertySuggestionById.isExisting() ||
				await propertySuggestionByDescription.isExisting(),
			{ timeout: 15000, timeoutMsg: 'Property suggestion did not appear.' }
		);
		if ( await propertySuggestionById.isExisting() ) {
			await propertySuggestionById.click();
		} else {
			await propertySuggestionByDescription.click();
		}

		const timeValue = '1993-02-12T00:00:00';
		await browser.keys( timeValue.split( '' ) );
		await $( '.wikibase-toolbar-button-save[aria-disabled="false"]' )
			.$( '=save' )
			.click();

		await expect( $( 'span.edtf-plain' ) ).toHaveText( timeValue );
		await expect( $( 'span.edtf-humanized' ) ).toHaveText(
			'(00:00:00 (local time) February 12th, 1993)'
		);
	} );
} );
