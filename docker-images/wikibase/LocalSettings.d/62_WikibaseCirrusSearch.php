<?php

if (isset($elasticsearchHost)) {
    // https://www.mediawiki.org/wiki/Extension:WikibaseCirrusSearch
    wfLoadExtension( 'WikibaseCirrusSearch' );

    $wgCirrusSearchServers = [ $elasticsearchHost ];
    $wgSearchType = 'CirrusSearch';
    $wgCirrusSearchExtraIndexSettings['index.mapping.total_fields.limit'] = 5000;
    $wgWBCSUseCirrus = true;
}
