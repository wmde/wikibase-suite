import LoginPage from '../../../helpers/pages/login.page.js';
import { ChainablePromiseElement } from 'webdriverio';
import page from '../../../helpers/pages/page.js';

const waitForDiscussionTools = async (): Promise<void> => {
	await browser.waitUntil(
		async () => {
			const bodyClasses = await $( 'body' ).getAttribute( 'class' );
			return bodyClasses.includes( 'ext-discussiontools-replytool-enabled' );
		},
		{
			timeout: 10000,
			timeoutMsg: 'Expected DiscussionTools reply tools to be enabled on the talk page'
		}
	);
};

const getVisibleAddTopicButton = async (): Promise<ChainablePromiseElement | null> => {
	const selectors = [
		'#ca-addsection',
		'#ca-more-addsection a',
		'#ca-addsection-sticky-header'
	];

	for ( const selector of selectors ) {
		const element = $( selector );
		if ( await element.isExisting() && await element.isDisplayed() ) {
			return element;
		}
	}

	return null;
};

const openDiscussionToolsNewTopic = async (): Promise<'discussiontools' | 'wikitext'> => {
	await browser.waitUntil(
		async () => !!( await getVisibleAddTopicButton() ),
		{
			timeout: 15000,
			timeoutMsg: 'Expected an Add topic link to be present on the talk page'
		}
	);

	const addTopicButton = await getVisibleAddTopicButton();
	if ( !addTopicButton ) {
		throw new Error( 'Could not resolve a visible Add topic control on the talk page' );
	}

	await addTopicButton.scrollIntoView();
	await addTopicButton.click();

	const topicTitleInput = $( '.ext-discussiontools-ui-newTopic-sectionTitle .oo-ui-inputWidget-input' );
	const sourceEditorTopicTitleInput = $( '#wpSummary' );
	await browser.waitUntil(
		async () =>
			await topicTitleInput.isDisplayed() || await sourceEditorTopicTitleInput.isDisplayed(),
		{
			timeout: 15000,
			timeoutMsg:
				'Expected either the DiscussionTools new topic form or the wikitext new-section editor to appear'
		}
	);

	return await topicTitleInput.isDisplayed() ? 'discussiontools' : 'wikitext';
};

const setDiscussionToolsBody = async (
	replyWidget: ChainablePromiseElement,
	text: string
): Promise<void> => {
	const sourceInput = replyWidget.$( 'textarea.oo-ui-inputWidget-input' );
	const visualRoot = replyWidget.$( '.ve-ce-attachedRootNode' );

	await browser.waitUntil(
		async () => await sourceInput.isDisplayed() || await visualRoot.isDisplayed(),
		{
			timeout: 15000,
			timeoutMsg: 'Expected a DiscussionTools source or visual editor input to appear'
		}
	);

	if ( await sourceInput.isDisplayed() ) {
		await sourceInput.setValue( text );
		return;
	}

	const ready = await browser.execute( () => {
		const root = document.querySelector<HTMLElement>(
			'.ext-discussiontools-ui-replyWidget .ve-ce-attachedRootNode'
		);
		if ( !root ) {
			return false;
		}

		const walker = document.createTreeWalker( root, NodeFilter.SHOW_TEXT );
		let lastTextNode = null;
		while ( walker.nextNode() ) {
			lastTextNode = walker.currentNode;
		}

		const selection = window.getSelection();
		const range = document.createRange();
		if ( lastTextNode ) {
			range.setStart( lastTextNode, lastTextNode.textContent.length );
		} else {
			range.selectNodeContents( root );
		}
		range.collapse( false );
		selection.removeAllRanges();
		selection.addRange( range );
		root.focus();
		return true;
	} );

	if ( !ready ) {
		throw new Error( 'Could not focus the DiscussionTools visual editor surface' );
	}

	await browser.keys( text.split( '' ) );
};

const submitDiscussionToolsComment = async ( buttonLabel: RegExp ): Promise<void> => {
	const replyWidget = $( '.ext-discussiontools-ui-replyWidget' );
	await expect( replyWidget ).toBeDisplayed();

	const submitButton = replyWidget.$( '.oo-ui-flaggedElement-primary .oo-ui-buttonElement-button' );
	await browser.waitUntil(
		async () => {
			const label = await submitButton.getText();
			return await submitButton.isClickable() && buttonLabel.test( label );
		},
		{
			timeout: 15000,
			timeoutMsg: `Expected DiscussionTools submit button ${ buttonLabel } to become clickable`
		}
	);
	await submitButton.click();
};

const postDiscussionToolsComment = async (
	text: string,
	buttonLabel: RegExp
): Promise<void> => {
	const replyWidget = $( '.ext-discussiontools-ui-replyWidget' );
	await expect( replyWidget ).toBeDisplayed();

	await setDiscussionToolsBody( replyWidget, text );
	await submitDiscussionToolsComment( buttonLabel );
};

describe( 'DiscussionTools', function () {
	beforeEach( async function () {
		await browser.skipIfExtensionNotPresent( this, 'DiscussionTools' );
		await browser.deleteCookies();
	} );

	it( 'Should reply inline and open the new topic flow on talk pages', async function () {
		const stamp = Date.now();
		const pageTitle = `Project_talk:DiscussionTools_feature_${ stamp }`;
		const replyText = `Reply from DiscussionTools ${ stamp }`;
		const topicTitle = `DiscussionTools topic ${ stamp }`;

		await LoginPage.login(
			testEnv.vars.MW_ADMIN_NAME,
			testEnv.vars.MW_ADMIN_PASS
		);
		await browser.editPage(
			testEnv.vars.WIKIBASE_URL,
			pageTitle,
			'First signed comment ~~~~'
		);
		await browser.waitForJobs();

		await page.open( `/wiki/${ pageTitle }` );
		await waitForDiscussionTools();

		await expect( $( '#ca-addsection' ) ).toHaveText( /Add topic/ );

		const replyButton = $( '.ext-discussiontools-init-replybutton' );
		await expect( replyButton ).toBeDisplayed();
		await replyButton.click();
		await postDiscussionToolsComment( replyText, /Reply/ );

		await browser.waitUntil(
			async () => ( await $( '#mw-content-text' ).getText() ).includes( replyText ),
			{
				timeout: 30000,
				timeoutMsg: 'Expected the posted inline reply to appear on the talk page'
			}
		);

		await page.open( `/wiki/${ pageTitle }` );
		await waitForDiscussionTools();
		const newTopicMode = await openDiscussionToolsNewTopic();

		if ( newTopicMode === 'discussiontools' ) {
			const topicTitleInput = $(
				'.ext-discussiontools-ui-newTopic-sectionTitle .oo-ui-inputWidget-input'
			);
			await topicTitleInput.waitForDisplayed( { timeout: 15000 } );
			await browser.waitUntil(
				async () => {
					const currentInput = $(
						'.ext-discussiontools-ui-newTopic-sectionTitle .oo-ui-inputWidget-input'
					);
					await currentInput.setValue( topicTitle );
					return await currentInput.getValue() === topicTitle;
				},
				{
					timeout: 15000,
					timeoutMsg: 'Expected DiscussionTools topic title to be retained'
				}
			);
			await expect( topicTitleInput ).toHaveValue( topicTitle );
		} else {
			const topicTitleInput = $( '#wpSummary' );
			await topicTitleInput.waitForDisplayed( { timeout: 15000 } );
			await topicTitleInput.setValue( topicTitle );
			await expect( topicTitleInput ).toHaveValue( topicTitle );
		}
	} );
} );
