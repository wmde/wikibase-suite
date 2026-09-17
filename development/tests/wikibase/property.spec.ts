/* eslint-disable mocha/no-setup-in-suite -- This suite generates cases from the supported datatype matrix. */
import { minor as getMinorVersion } from 'semver';
import WikibaseApi from 'wdio-wikibase/wikibase.api.js';
import PropertyPage from '../_helpers/pages/entity/property.page.js';
import LoginPage from '../_helpers/pages/login.page.js';
import page from '../_helpers/pages/page.js';
import SpecialEntityDataPage from '../_helpers/pages/special/entity-data.page.js';
import propertyIdSelector from '../_helpers/property-id-selector.js';
import {
	wikibasePropertyItem,
	wikibasePropertyString
} from '../_helpers/wikibase-property-types.js';
import { Claim, Reference } from '../_types/entity-data.js';
import WikibasePropertyType from '../_types/wikibase-property-type.js';

const dataTypes = [ wikibasePropertyItem, wikibasePropertyString ];

const statementText = 'STATEMENT';
const referenceText = 'REFERENCE';
const undoSummaryText = 'UNDO_SUMMARY';

const waitForEntityData = async (
	propertyId: string,
	condition: ( claim: Claim ) => boolean,
	timeoutMsg: string
): Promise<void> => {
	await browser.waitUntil(
		async () => {
			const responseData = await SpecialEntityDataPage.getData( propertyId );
			const claims = responseData.entities[ propertyId ].claims;
			return Object.values( claims )
				.some( ( propertyClaims ) => propertyClaims.some( condition ) );
		},
		{ timeoutMsg }
	);
};

const waitForValueInputFocus = async (): Promise<void> => {
	await browser.waitUntil(
		async () => browser.execute( () => {
			const activeElement = document.activeElement;
			return (
				activeElement !== document.body &&
				!activeElement.matches( 'a, .ui-entityselector-input' )
			);
		} ),
		{ timeoutMsg: 'Expected focus to move to the statement value input' }
	);
};

describe( 'Property', function () {
	before( async function () {
		await LoginPage.login(
			testEnv.vars.MW_ADMIN_NAME,
			testEnv.vars.MW_ADMIN_PASS
		);
	} );

	dataTypes.forEach( ( dataType: WikibasePropertyType ) => {
		describe( `Should be able to work with type ${ dataType.name }`, function () {
			let propertyId: string = null;
			let stringPropertyId: string = null;
			let stringPropertyLabel: string = null;

			before( async function () {
				propertyId = await WikibaseApi.createProperty( dataType.urlName );
				stringPropertyLabel = `property-selector-${ Date.now() }`;
				stringPropertyId = await WikibaseApi.createProperty(
					wikibasePropertyString.urlName,
					{
						labels: {
							en: {
								language: 'en',
								value: stringPropertyLabel
							}
						}
					}
				);
				await browser.waitForJobs();
				await browser.waitUntil(
					async () => {
						const result = await browser.makeRequest(
							`${ testEnv.vars.WIKIBASE_URL }/w/api.php?action=wbsearchentities&search=${ encodeURIComponent( stringPropertyLabel ) }&format=json&errorformat=plaintext&language=en&uselang=en&type=property`
						);
						return result.data.search.some(
							( property ) => property.id === stringPropertyId
						);
					},
					{
						timeoutMsg:
							`Expected ${ stringPropertyId } to appear in property search`
					}
				);
			} );

			beforeEach( async function () {
				await PropertyPage.open( propertyId );
			} );

			it( 'Should resolve its canonical entity URI to the property page', async function () {
				await page.open( `/entity/${ propertyId }` );
				await expect( browser ).toHaveUrl(
					`${ testEnv.vars.WIKIBASE_URL }/wiki/Property:${ propertyId }`
				);
			} );

			it( 'Should be able to add statement to property', async function () {
				await $( '=add statement' ).click();
				await browser.waitUntil(
					async () => $( '.ui-entityselector-input' ).isFocused(),
					{ timeoutMsg: 'Expected focus on the statement property selector' }
				);
				await browser.keys( stringPropertyLabel.split( '' ) );
				const propertySelector = propertyIdSelector(
					stringPropertyId,
					stringPropertyLabel
				);
				await propertySelector.waitForExist();
				await propertySelector.click();
				await waitForValueInputFocus();
				await browser.keys( statementText.split( '' ) );
				await PropertyPage.saveStatementLink.click();
				await waitForEntityData(
					propertyId,
					( claim ) => claim.mainsnak.property === stringPropertyId &&
						claim.mainsnak.datavalue.value === statementText,
					`Expected statement on ${ propertyId } to be persisted`
				);
			} );

			it( 'Should be able to see added statement', async function () {
				await expect( $( `div=${ statementText }` ) ).toExist();
				await expect( $( `aria/Property:${ stringPropertyId }` ) ).toHaveText(
					stringPropertyLabel
				);
			} );

			it( 'Should be able to add reference to property', async function () {
				await $( '=add reference' ).click();
				await browser.waitUntil(
					async () => $( '.ui-entityselector-input' ).isFocused(),
					{ timeoutMsg: 'Expected focus on the reference property selector' }
				);
				await browser.keys( stringPropertyLabel.split( '' ) );
				const propertySelector = propertyIdSelector(
					stringPropertyId,
					stringPropertyLabel
				);
				await propertySelector.waitForExist();
				await propertySelector.click();
				await waitForValueInputFocus();
				await browser.keys( referenceText.split( '' ) );
				await PropertyPage.saveStatementLink.click();
				await waitForEntityData(
					propertyId,
					( claim ) => Boolean(
						claim.references &&
						claim.references.some(
							( reference ) => Boolean(
								reference.snaks[ stringPropertyId ] &&
								reference.snaks[ stringPropertyId ].some(
									( snak ) => snak.datavalue.value === referenceText
								)
							)
						)
					),
					`Expected reference on ${ propertyId } to be persisted`
				);
			} );

			it( 'Should be able to see added reference', async function () {
				await $( '=1 reference' ).click();
				await expect( $( `div=${ referenceText }` ) ).toExist();
			} );

			it( 'Should contain statement and reference in EntityData', async function () {
				const responseData = await SpecialEntityDataPage.getData( propertyId );
				const claim: Claim =
					responseData.entities[ propertyId ].claims[ stringPropertyId ][ 0 ];
				const reference: Reference =
					claim.references[ 0 ].snaks[ stringPropertyId ][ 0 ];
				await expect( claim.mainsnak.datavalue.value ).toEqual( statementText );
				await expect( reference.datavalue.value ).toEqual( referenceText );
			} );

			it( 'Should show changes in "View history" tab', async function () {
				await $( '=View history' ).click();
				await expect( $( '.comment*=Created claim' ) ).toExist();
				await expect( $( '.comment*=Changed claim' ) ).toExist();
				await expect( $( '.comment*=Created a new Property' ) ).toExist();
			} );

			it( 'Should display the added properties on the "Recent changes" page', async function () {
				await page.open( '/wiki/Special:RecentChanges?limit=500' );
				await expect(
					$( `a[href$="/wiki/Property:${ propertyId }"]` )
				).toExist();
				await expect(
					$( `a[href$="/wiki/Property:${ stringPropertyId }"]` )
				).toExist();
			} );

			it( 'Should be able to revert a change', async function () {
				await $( '=View history' ).click();
				expect(
					await $( 'ul.mw-contributions-list' ).$$( 'li' ).getElements()
				).toHaveLength( 3 );
				await $( 'ul.mw-contributions-list' ).$( 'li.before' ).$( 'a=undo' ).click();
				await $(
					'label=Summary (will be appended to an automatically generated summary):'
				).click();
				await browser.keys( undoSummaryText.split( '' ) );
				await $( 'button=Save page' ).click();

				await $( '=View history' ).click();
				expect(
					await $( 'ul.mw-contributions-list' ).$$( 'li' ).getElements()
				).toHaveLength( 4 );
				await expect( $( 'span.mw-tag-marker-mw-undo' ) ).toExist();
				await expect( $( 'ul.mw-contributions-list' ).$( 'li.before' ) ).toHaveText(
					new RegExp( undoSummaryText )
				);
			} );

			it( 'Should be able to set label, description, aliases', async function () {
				const mediaWikiVersion = await browser.getMediaWikiVersion();

				await page.open( '/wiki/Special:SetLabelDescriptionAliases/' );
				await $( 'label=ID:' ).click();
				await browser.keys( propertyId.split( '' ) );

				if ( getMinorVersion( mediaWikiVersion ) === 39 ) {
					await $( 'span=Set label, description and aliases' ).click();
				} else {
					await $( 'span=Continue' ).click();
				}

				await $( 'label=Label:' ).click();
				await browser.keys( `${ dataType.name } Label`.split( '' ) );
				await $( 'label=Description:' ).click();
				await browser.keys( `${ dataType.name } Description`.split( '' ) );
				await $( 'label=Aliases:' ).click();
				await browser.keys(
					`${ dataType.name } Alias A|${ dataType.name } Alias B`.split( '' )
				);

				if ( getMinorVersion( mediaWikiVersion ) === 39 ) {
					await $( 'span=Set label, description and aliases' ).click();
				} else {
					await $( 'span=Save changes' ).click();
				}

				await expect(
					$( `span.wikibase-labelview-text=${ dataType.name } Label` )
				).toExist();
				await expect(
					$( `span.wikibase-descriptionview-text=${ dataType.name } Description` )
				).toExist();
				await expect(
					$( `li.wikibase-aliasesview-list-item=${ dataType.name } Alias A` )
				).toExist();
				await expect(
					$( `li.wikibase-aliasesview-list-item=${ dataType.name } Alias B` )
				).toExist();
			} );
		} );
	} );
} );
