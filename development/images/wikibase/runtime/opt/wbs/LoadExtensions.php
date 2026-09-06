<?php

# Image-owned default extension configuration. Simple extensions use MediaWiki's
# standard loader; extension profiles group image-specific configuration and
# conditional or multi-extension setup.

$extensionProfilesPath = __DIR__ . '/extension-profiles';
$openSearchEnabled = isset( $elasticsearchHost );
$wikimediaLoginEnabled =
	getenv( 'WIKIMEDIA_OAUTH_CONSUMER_TOKEN' ) !== false &&
	getenv( 'WIKIMEDIA_OAUTH_CONSUMER_TOKEN' ) !== '' &&
	getenv( 'WIKIMEDIA_OAUTH_SECRET_TOKEN' ) !== false &&
	getenv( 'WIKIMEDIA_OAUTH_SECRET_TOKEN' ) !== '';

# Wikibase repository and client
require "$extensionProfilesPath/Wikibase.php";

if ( $wgEnableWikibaseRepo ?? true ) {
	wfLoadExtension( 'EntitySchema' );
	wfLoadExtension( 'WikibaseLocalMedia' );
}

wfLoadExtension( 'WikibaseManifest' );

# Wikibase content in wikitext
require "$extensionProfilesPath/WikibaseInWikitext.php";

wfLoadExtension( 'Babel' );
wfLoadExtension( 'cldr' );
wfLoadExtension( 'ConfirmEdit' );
wfLoadExtension( 'Echo' );
wfLoadExtension( 'Nuke' );

# OAuth support
require "$extensionProfilesPath/OAuth.php";

# Lua modules
require "$extensionProfilesPath/Scribunto.php";

wfLoadExtension( 'SyntaxHighlight_GeSHi' );
wfLoadExtension( 'UniversalLanguageSelector' );

# Visual editing
require "$extensionProfilesPath/VisualEditor.php";

wfLoadExtension( 'Linter' );

# Discussion tools
require "$extensionProfilesPath/DiscussionTools.php";

# OpenSearch integration
if ( $openSearchEnabled ) {
	require "$extensionProfilesPath/OpenSearch.php";
}

# Wikimedia OAuth login
if ( $wikimediaLoginEnabled ) {
	require "$extensionProfilesPath/WikimediaLogin.php";
}

# Wikibase Suite integration
wfLoadExtension( 'WikibaseSuite' );
