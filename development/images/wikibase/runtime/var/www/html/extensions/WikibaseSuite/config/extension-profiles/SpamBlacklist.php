<?php

// Shared anti-spam sources used by Wikibase Cloud. The optional DNS blacklist
// policy remains separate because it depends on deployment-specific networking.
wfLoadExtension( 'SpamBlacklist' );

$wgBlacklistSettings = [
	'spam' => [
		'files' => [
			'https://meta.wikimedia.org/w/index.php?title=Spam_blacklist&action=raw&sb_ver=1',
			'https://en.wikipedia.org/w/index.php?title=MediaWiki:Spam-blacklist&action=raw&sb_ver=1',
			'https://raw.githubusercontent.com/wbstack/mediawiki-spam-lists/main/spam_list',
		],
	],
	'email' => [
		'files' => [
			'https://raw.githubusercontent.com/wbstack/mediawiki-spam-lists/main/email_list',
		],
	],
];
