<?php

// These extensions form one OpenSearch integration and must share the image's
// server and Wikibase-specific search configuration.
wfLoadExtension( 'Elastica' );
wfLoadExtension( 'CirrusSearch' );
wfLoadExtension( 'WikibaseCirrusSearch' );

$wgCirrusSearchServers = [ $elasticsearchHost ];
$wgSearchType = 'CirrusSearch';
$wgCirrusSearchExtraIndexSettings['index.mapping.total_fields.limit'] = 5000;
$wgWBCSUseCirrus = true;
