import LoginPage from 'wdio-mediawiki/LoginPage.js';

class TestLoginPage {
	public async login( username: string, password: string ): Promise<void> {
		await LoginPage.login( username, password );
		// LoginPage can observe wgUserName before the form navigation has finished.
		// Wait for authenticated page chrome so a following navigation cannot abort login.
		await LoginPage.userPage.waitForExist();
	}
}

export default new TestLoginPage();
