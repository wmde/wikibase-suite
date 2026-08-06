<?php

# Wikibase Repository
wfLoadExtension( 'WikibaseRepository', "$IP/extensions/Wikibase/extension-repo.json" );
require_once "$IP/extensions/Wikibase/repo/ExampleSettings.php";
$wgWBRepoSettings['enableMulLanguageCode'] = true;

// Match Wikidata's default statement grouping for item identifiers and
// property constraints.
// https://www.mediawiki.org/wiki/Wikibase/Installation/Advanced_configuration#statementSections
$wgWBRepoSettings['statementSections'] = [
	'item' => [
		'statements' => null,
		'identifiers' => [
			'type' => 'dataType',
			'dataTypes' => [ 'external-id' ],
		],
	],
	'property' => [
		'statements' => null,
		'constraints' => [
			'type' => 'propertySet',
			'propertyIds' => [ 'P2302' ],
		],
	],
];

# Wikibase Client
wfLoadExtension( 'WikibaseClient', "$IP/extensions/Wikibase/extension-client.json" );
require_once "$IP/extensions/Wikibase/client/ExampleSettings.php";
