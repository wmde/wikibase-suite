<?php

// Lexemes are an optional Wikibase capability. When the WBS OpenSearch profile
// has loaded Wikibase search, also enable the matching Lexeme search support.
wfLoadExtension( 'WikibaseLexeme' );
$wgLexemeEnableDataTransclusion = true;

if ( ExtensionRegistry::getInstance()->isLoaded( 'WikibaseCirrusSearch' ) ) {
	wfLoadExtension( 'WikibaseLexemeCirrusSearch' );
	$wgLexemeUseCirrus = true;
	$wgContentNamespaces[] = 146;
	$wgWBRepoSettings['searchIndexTypes'][] = 'wikibase-lexeme';
	$wgWBRepoSettings['searchIndexTypes'][] = 'wikibase-form';
	$wgWBRepoSettings['searchIndexTypes'][] = 'wikibase-sense';
}
