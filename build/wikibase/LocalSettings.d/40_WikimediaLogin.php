<?php

$wikimediaConsumerKey = getenv( 'WIKIMEDIA_OAUTH_CONSUMER_KEY' );
$wikimediaConsumerSecret = getenv( 'WIKIMEDIA_OAUTH_CONSUMER_SECRET' );

if (
	$wikimediaConsumerKey !== false && $wikimediaConsumerKey !== '' &&
	$wikimediaConsumerSecret !== false && $wikimediaConsumerSecret !== ''
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
			'clientId' => $wikimediaConsumerKey,
			'clientSecret' => $wikimediaConsumerSecret,
		],
	];
}
