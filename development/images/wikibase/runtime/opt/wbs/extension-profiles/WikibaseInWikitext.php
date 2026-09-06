<?php

// https://github.com/wbstack/mediawiki-extensions-WikibaseInWikitext
## WikibaseInWikitext Configuration
wfLoadExtension( 'WikibaseInWikitext' );

$wdqs_frontend_url = getenv( 'WDQS_PUBLIC_FRONTEND_URL' );
if ( !empty( $wdqs_frontend_url ) ) {
	$wgWikibaseInWikitextSparqlDefaultUi = $wdqs_frontend_url;
}
