<?php

$wikimediaConsumerToken = getenv( 'WIKIMEDIA_OAUTH_CONSUMER_TOKEN' );
$wikimediaSecretToken = getenv( 'WIKIMEDIA_OAUTH_SECRET_TOKEN' );

if (
	$wikimediaConsumerToken !== false && $wikimediaConsumerToken !== '' &&
	$wikimediaSecretToken !== false && $wikimediaSecretToken !== ''
) {
	// Authenticate local Wikibase users through a Wikimedia OAuth 1.0a consumer.
	// Credentials are deliberately read at runtime so they can be added after
	// initial setup. Do not load PluggableAuth without a configured provider: its
	// default configuration disables local-password login.
	$wgGroupPermissions['*']['autocreateaccount'] = true;
	$wgPluggableAuth_EnableLocalLogin = true;
	wfLoadExtension( 'PluggableAuth' );
	wfLoadExtension( 'WSOAuth' );
	$wgPluggableAuth_Config['Log in with Wikimedia'] = [
		'plugin' => 'WSOAuth',
		'data' => [
			'type' => 'mediawiki',
			'uri' => 'https://meta.wikimedia.org/w/index.php?title=Special:OAuth',
			'clientId' => $wikimediaConsumerToken,
			'clientSecret' => $wikimediaSecretToken,
		],
	];
}
