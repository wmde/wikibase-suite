<?php

// Keep deprecation notices in the error log without corrupting JSON API responses.
ini_set( 'display_errors', 0 );

$wgShowExceptionDetails = true;
$wgShowSQLErrors = true;
$wgDebugDumpSql  = false;
$wgShowDBErrorBacktrace = false;

# TODO: do we need this?
$wgEnableParserCache = false;
$wgCachePages = false;
$wgParserCacheType = CACHE_NONE;
$wgMainCacheType = CACHE_NONE;

$testSuiteSettings = '/test-settings/LocalSettings.php';
if ( is_readable( $testSuiteSettings ) ) {
	require $testSuiteSettings;
}
