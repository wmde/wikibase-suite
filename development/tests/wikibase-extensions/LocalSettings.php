<?php

// EntitySchema
$wgEntitySchemaShExSimpleUrl = "http://validator.svc";

// Cache for one second only, so tests can see updates
$wgWBRepoSettings['sharedCacheDuration'] = 1;

// Load user defined extension
wfLoadExtension( 'extensions/WikibaseSuiteTestExtension' );

