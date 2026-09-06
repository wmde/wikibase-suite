<?php

# The client test intentionally loads only the extensions required for
# repository/client federation and Lua-based Wikibase access.
$wgJobRunRate = 1;

wfLoadExtension( 'WikibaseClient', "$IP/extensions/Wikibase/extension-client.json" );
require_once "$IP/extensions/Wikibase/client/ExampleSettings.php";

$wgWBClientSettings['entitySources'] = [
    'repo' => [
        'entityNamespaces' => [ 'item' => 120, 'property' => 122 ],
        'repoDatabase' => 'my_wiki',
        'baseUri' => 'http://wikibase/entity/',
        'interwikiPrefix' => 'my_wiki',
        'rdfNodeNamespacePrefix' => 'wd',
        'rdfPredicateNamespacePrefix' => '',
        'type' => 'db'
    ],
];
$wgWBClientSettings['itemAndPropertySourceName'] = 'repo';
$wgWBClientSettings['repoUrl'] = 'http://wikibase';
$wgWBClientSettings['repoScriptPath'] = '/w';
$wgWBClientSettings['repoArticlePath'] = '/wiki/$1';
$wgWBClientSettings['siteLinkGroups'] = [ 'mywikigroup' ];
$wgWBClientSettings['siteGlobalID'] = 'client_wiki';

wfLoadExtension( 'Scribunto' );
$wgScribuntoDefaultEngine = 'luastandalone';
$wgScribuntoEngineConf['luastandalone']['luaPath'] = '/usr/bin/lua5.1';
