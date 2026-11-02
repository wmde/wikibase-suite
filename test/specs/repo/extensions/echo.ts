import LoginPage from '../../../helpers/pages/login.page.js';
import page from '../../../helpers/pages/page.js';

const createUser = async (
	username: string,
	password: string,
	email: string
): Promise<void> => {
	await testEnv.runDockerComposeCmd(
		`exec -T wikibase php /var/www/html/maintenance/run.php createAndPromote --force "${ username }" "${ password }" --email "${ email }"`
	);
};

describe( 'Echo', function () {
	beforeEach( async function () {
		await browser.skipIfExtensionNotPresent( this, 'Echo' );
		await browser.deleteCookies();
	} );

	it( 'Should show a mention notification to the mentioned user', async function () {
		const stamp = Date.now();
		const recipientUser = `EchoRecipient${ stamp }`;
		const recipientPass = `EchoPassword${ stamp }`;
		const recipientEmail = `echo-recipient-${ stamp }@example.test`;
		const pageTitle = `Project_talk:Echo_notification_${ stamp }`;

		await createUser( recipientUser, recipientPass, recipientEmail );

		await LoginPage.login(
			testEnv.vars.MW_ADMIN_NAME,
			testEnv.vars.MW_ADMIN_PASS
		);
		await browser.editPage(
			testEnv.vars.WIKIBASE_URL,
			pageTitle,
			`Hello [[User:${ recipientUser }]] ~~~~`
		);
		await browser.waitForJobs();
		await browser.deleteCookies();

		await LoginPage.login( recipientUser, recipientPass );
		await page.open( '/wiki/Special:Notifications' );

		const alertBadge = $( '#pt-notifications-alert a' );
		await browser.waitUntil(
			async () => Number( await alertBadge.getAttribute( 'data-counter-num' ) ) > 0,
			{
				timeout: 10000,
				timeoutMsg: `Expected a non-zero Echo alert badge for ${ recipientUser }`
			}
		);

		await browser.waitUntil(
			async () => {
				const pageText = await browser.execute(
					() => document.body.innerText
				);
				return pageText.includes( 'mentioned you' ) && pageText.includes( `${ stamp }` );
			},
			{
				timeout: 10000,
				timeoutMsg: `Expected a mention notification for ${ recipientUser }`
			}
		);
	} );
} );
