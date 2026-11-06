<?php

// Needed by the pinned Wikibase mobile browser specs; keep product enablement
// separate from the test profile.
wfLoadExtension( 'MobileFrontend' );

// The PHPUnit harness uses the Scribunto engine configuration before its
// extension defaults are merged. Seed it from the pinned extension source.
$scribuntoConfig = json_decode(
	file_get_contents( "$IP/extensions/Scribunto/extension.json" ),
	true
)['config']['ScribuntoEngineConf']['value']['luastandalone'];
$wgScribuntoEngineConf['luastandalone'] = array_replace(
	$scribuntoConfig,
	$wgScribuntoEngineConf['luastandalone']
);

// The upstream repository tests expect the public wiki editing profile.
$wgGroupPermissions['*']['edit'] = true;
$wgGroupPermissions['*']['createpage'] = true;
$wgGroupPermissions['*']['createtalk'] = true;
$wgGroupPermissions['*']['writeapi'] = true;

// The upstream browser specs create and edit many items as the same anonymous
// client. MediaWiki's default limit of eight edits per IP per minute blocks
// later specs in a full run.
$wgRateLimits['edit']['ip'] = [ 1000, 60 ];

// Upstream's Selenium page object edits the first description field. Suite's
// multilingual default-term row adds a readonly field before the language rows.
$wgWBRepoSettings['enableMulLanguageCode'] = false;
