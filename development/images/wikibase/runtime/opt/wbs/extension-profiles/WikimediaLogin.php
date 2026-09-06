<?php

# Do not load PluggableAuth without a configured provider: its default
# configuration disables local-password login.
$wgGroupPermissions['*']['autocreateaccount'] = true;
$wgPluggableAuth_EnableLocalLogin = true;
wfLoadExtension( 'PluggableAuth' );

// WSOAuth declares PluggableAuth as an upstream extension dependency.
wfLoadExtension( 'WSOAuth' );
$wgPluggableAuth_Config['Log in with Wikimedia'] = [
	'plugin' => 'WSOAuth',
	'data' => [
		'type' => 'mediawiki',
		'uri' => 'https://meta.wikimedia.org/w/index.php?title=Special:OAuth',
		'clientId' => getenv( 'WIKIMEDIA_OAUTH_CONSUMER_TOKEN' ),
		'clientSecret' => getenv( 'WIKIMEDIA_OAUTH_SECRET_TOKEN' ),
	],
];
