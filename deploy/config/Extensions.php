<?php
// ************************************************************************
// Wikibase Suite Deploy Extensions.php
// ************************************************************************
//
// File to load MediaWiki extension in the Wikibase image.
//
// This file will be loaded after all other extensions and LocalSettings.php 
// have loaded.
//
// For extensions added via deploy/config/extensions, prefix the name with
// "extensions/".
// e.g. wfLoadExtension( 'WikibaseLexeme' ); becomes
//      wfLoadExtension( 'extensions/WikibaseLexeme' );

// NOTE: As of the 7.0.0 version of the Wikibase image EDTF is no longer
// loaded by default. To re-enable it uncomment the following line:
// wfLoadExtension( 'WikibaseEdtf' );
