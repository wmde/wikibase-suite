import page from '../_helpers/pages/page.js';

const defaultExtensions: Record<string, string[]> = {
	wikibase: [
		'EntitySchema',
		'WikibaseClient',
		'Wikibase Local Media',
		'WikibaseRepository',
		'WikibaseManifest'
	],
	other: [
		'cldr',
		'DiscussionTools',
		'OAuth',
		'UniversalLanguageSelector'
	],
	parserhook: [ 'Babel', 'Scribunto' ],
	editor: [ 'VisualEditor' ],
	antispam: [ 'ConfirmEdit' ],
	specialpage: [ 'Echo', 'Linter', 'Nuke' ]
};

describe( 'Default extensions', function () {
	it( 'Should list every required extension on Special:Version', async function () {
		await page.open( '/wiki/Special:Version' );

		for ( const [ extensionPackage, extensions ] of Object.entries(
			defaultExtensions
		) ) {
			for ( const extension of extensions ) {
				const extensionInfo = $(
					`#mw-version-ext-${ extensionPackage }-${ extension.replace( / /g, '_' ) }`
				);
				await expect( extensionInfo ).toHaveText( /.+/ );
			}
		}
	} );

	it( 'Should not load Wikibase EDTF by default', async function () {
		await page.open( '/wiki/Special:Version' );
		await expect( $( '#mw-version-ext-other-Wikibase_EDTF' ) ).not.toExist();
	} );
} );
