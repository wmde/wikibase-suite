import { getTestString } from 'wdio-mediawiki/Util.js';
import WikibaseApi from 'wdio-wikibase/wikibase.api.js';
import { ChainablePromiseElement } from 'webdriverio';
import ItemPage from '../../helpers/pages/entity/item.page.js';

const getStatementGroupListForHeading = (
	headingId: string
): ChainablePromiseElement => $(
	`//h2[@id="${ headingId }"]/following-sibling::div[contains(@class, "wikibase-statementgrouplistview")][1]`
);

const getStatementGroup = (
	section: ChainablePromiseElement,
	propertyId: string
): ChainablePromiseElement => section.$(
	`.//div[@id="${ propertyId }" and contains(@class, "wikibase-statementgroupview")]`
);

const getHeadingTexts = async (): Promise<string[]> => {
	const headings = await $$(
		'h2.wb-section-heading.section-heading.wikibase-statements'
	).getElements();
	const texts = [];

	for ( const heading of headings ) {
		texts.push( await heading.getText() );
	}

	return texts;
};

const findSectionIndex = ( sectionTexts: string[], heading: RegExp ): number =>
	sectionTexts.findIndex( ( text ) => heading.test( text ) );

const waitForStatementSections = async (): Promise<void> => {
	await browser.waitUntil(
		async () => {
			const sectionHeadings = await $$(
				'h2.wb-section-heading.section-heading.wikibase-statements'
			).getElements();
			return sectionHeadings.length >= 2;
		},
		{
			timeout: 15000,
			timeoutMsg: 'Expected statement section headings to be rendered on the item page'
		}
	);
};

describe( 'Statement grouping', function () {
	it( 'Should group external identifier statements into a separate section on item pages', async function () {
		const stringPropertyId = await WikibaseApi.createProperty( 'string' );
		const externalIdPropertyA = await WikibaseApi.createProperty( 'external-id' );
		const externalIdPropertyB = await WikibaseApi.createProperty( 'external-id' );

		const itemId = await WikibaseApi.createItem(
			getTestString( 'statement-grouping-' ),
			{
				claims: [
					{
						mainsnak: {
							snaktype: 'value',
							property: stringPropertyId,
							datatype: 'string',
							datavalue: {
								value: 'regular statement value',
								type: 'string'
							}
						},
						type: 'statement',
						rank: 'normal'
					},
					{
						mainsnak: {
							snaktype: 'value',
							property: externalIdPropertyA,
							datatype: 'external-id',
							datavalue: {
								value: 'EXT-ID-001',
								type: 'string'
							}
						},
						type: 'statement',
						rank: 'normal'
					},
					{
						mainsnak: {
							snaktype: 'value',
							property: externalIdPropertyB,
							datatype: 'external-id',
							datavalue: {
								value: 'EXT-ID-002',
								type: 'string'
							}
						},
						type: 'statement',
						rank: 'normal'
					}
				]
			}
		);
		await browser.waitForJobs();

		await ItemPage.open( itemId );
		await waitForStatementSections();

		const sectionTexts = await getHeadingTexts();
		const statementsIndex = findSectionIndex( sectionTexts, /Statements/ );
		const identifiersIndex = findSectionIndex( sectionTexts, /Identifiers/ );

		expect( statementsIndex ).toBeGreaterThanOrEqual( 0 );
		expect( identifiersIndex ).toBeGreaterThanOrEqual( 0 );
		expect( statementsIndex ).toBeLessThan( identifiersIndex );

		const statementsSection = getStatementGroupListForHeading( 'claims' );
		const identifiersSection = getStatementGroupListForHeading( 'identifiers' );

		await expect( getStatementGroup( statementsSection, stringPropertyId ) ).toExist();
		await expect(
			getStatementGroup( statementsSection, externalIdPropertyA )
		).not.toExist();
		await expect(
			getStatementGroup( identifiersSection, externalIdPropertyA )
		).toExist();
		await expect(
			getStatementGroup( identifiersSection, externalIdPropertyB )
		).toExist();
		await expect(
			getStatementGroup( identifiersSection, stringPropertyId )
		).not.toExist();
	} );
} );
