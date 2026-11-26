<?php

// Account-request policy used by Wikibase Cloud. It is intentionally optional:
// enabling ConfirmAccount changes the public account-creation flow.
wfLoadExtension( 'ConfirmAccount' );

$wgMakeUserPageFromBio = false;
$wgAutoWelcomeNewUsers = false;
$wgConfirmAccountCaptchas = true;
$wgConfirmAccountRequestFormItems = [
	'UserName' => [ 'enabled' => true ],
	'RealName' => [ 'enabled' => false ],
	'Biography' => [ 'enabled' => false, 'minWords' => 50 ],
	'AreasOfInterest' => [ 'enabled' => false ],
	'CV' => [ 'enabled' => false ],
	'Notes' => [ 'enabled' => true ],
	'Links' => [ 'enabled' => false ],
	'TermsOfService' => [ 'enabled' => false ],
];

$wgGroupPermissions['bureaucrat']['confirmaccount-notify'] = true;
$wgGroupPermissions['bureaucrat']['requestips'] = false;
$wgGroupPermissions['bureaucrat']['lookupcredentials'] = false;
$wgGroupPermissions['*']['requestips'] = false;
$wgGroupPermissions['*']['lookupcredentials'] = false;
$wgGroupPermissions['*']['createaccount'] = false;
$wgGroupPermissions['bureaucrat']['createaccount'] = true;

$wgHooks['SkinTemplateNavigation::Universal'][] = static function ( $skin, array &$links ): bool {
	if ( isset( $links['user-menu']['login'] ) || isset( $links['user-menu']['anonlogin'] ) ) {
		$links['user-menu']['createaccount'] = [
			'text' => wfMessage( 'requestaccount' )->text(),
			'href' => SpecialPage::getTitleFor( 'RequestAccount' )->getFullURL(),
		];
	}
	return true;
};
