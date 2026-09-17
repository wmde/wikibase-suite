import SpecialEntityPage from 'wdio-wikibase/pageobjects/item.page.js';
import LoginPage from '../_helpers/pages/login.page.js';
import SpecialNewItemPage from '../_helpers/pages/special/new-item.page.js';

describe( 'Special:NewItem', function () {
	before( async function () {
		await LoginPage.login(
			testEnv.vars.MW_ADMIN_NAME,
			testEnv.vars.MW_ADMIN_PASS
		);
	} );

	it( 'Should be able to create a new item', async function () {
		const label = 'Cool label';
		const description = 'Cool description';
		const firstAlias = 'Great job';
		const secondAlias = 'Bra Jobbat';

		await SpecialNewItemPage.open();

		await $( 'input[name="label"]' ).setValue( label );
		await $( 'input[name="description"]' ).setValue( description );
		await $( 'input[name="aliases"]' ).setValue( `${ firstAlias }|${ secondAlias }` );
		await SpecialNewItemPage.submit();

		await SpecialEntityPage.addStatementLink;

		await expect(
			$( '.wikibase-entitytermsforlanguageview-en .wikibase-labelview-text' )
		).toHaveText( label );

		await expect(
			$( '.wikibase-entitytermsforlanguageview-en .wikibase-descriptionview-text' )
		).toHaveText( description );

		await expect(
			$( '.wikibase-entitytermsforlanguageview-en .wikibase-aliasesview-list-item:nth-child(1)' )
		).toHaveText( firstAlias );

		await expect(
			$( '.wikibase-entitytermsforlanguageview-en .wikibase-aliasesview-list-item:nth-child(2)' )
		).toHaveText( secondAlias );
	} );
} );
