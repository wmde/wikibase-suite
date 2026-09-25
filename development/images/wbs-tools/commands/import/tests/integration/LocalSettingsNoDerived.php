<?php
// Disposable authoritative-storage benchmark configuration. It deliberately
// omits CirrusSearch/WikibaseCirrusSearch and any QLever/updater integration.
$wgSitename = 'Bulk import no-derived-services test';
$wgServer = 'http://bulk.test';
$wgScriptPath = '/w';
$wgArticlePath = '/wiki/$1';
$wgDBtype = 'mysql';
$wgDBserver = 'mysql';
$wgDBname = 'bulk_test';
$wgDBuser = 'bulk_test';
$wgDBpassword = 'bulk-test-only';
$wgSecretKey = 'bulk-import-integration-test-only';
$wgLanguageCode = 'en';
$wgMainCacheType = CACHE_NONE;
$wgJobRunRate = 0;
$wgShowExceptionDetails = true;
$wgEnableWikibaseRepo = true;
$wgEnableWikibaseClient = false;
wfLoadExtension( 'WikibaseRepository', "$IP/extensions/Wikibase/extension-repo.json" );
require "$IP/extensions/Wikibase/repo/ExampleSettings.php";
$wgWBRepoSettings['conceptBaseUri'] = 'http://bulk.test/entity/';
$wgGroupPermissions['*']['edit'] = false;
$wgGroupPermissions['*']['createaccount'] = false;
