<?php

// Know about proxies... so that we get the real IP..
$wgCdnServersNoPurge = [
    getenv('MW_ALLOWED_PROXY_CIDR')
];

// This one is needed prior to 1.34
// TODO this can probably be removed now?
$wgSquidServersNoPurge = $wgCdnServersNoPurge;

$wgParserCacheType = 'db-replicated';

// Don't specify a redis cache when running dbless maint script
// TODO we probably do want a redis connection in some maint scripts...
if(!$wwDomainIsMaintenance) {
    /** @see RedisBagOStuff for a full explanation of these options. **/
    $wgMainCacheType = 'redis2'; // See: T380448
    $wgSessionCacheType = 'redis';
    // NOTE Passwords are set further down in config
    $wgObjectCaches['redis'] = [
        'class' => 'RedisBagOStuff',
        'servers' => [ getenv('MW_REDIS_SERVER_WRITE') ],
        'loggroup'  => 'RedisBagOStuff',
        'reportDupes' => false
    ];
    $wgObjectCaches['redis2'] = [
        'class' => 'RedisBagOStuff',
        'servers' => [ getenv('MW_REDIS_CACHE_SERVER_WRITE') ],
        'loggroup'  => 'RedisBagOStuff',
        'reportDupes' => false
    ];
    if(getenv('MW_REDIS_PASSWORD') !== '') {
        // Only set the password if not empty
        $wgObjectCaches['redis']['password'] = getenv('MW_REDIS_PASSWORD');
        $wgObjectCaches['redis2']['password'] = getenv('MW_REDIS_PASSWORD');
    }
}

// Modified default from https://www.mediawiki.org/wiki/Manual:$wgObjectCaches
// to have slightly more aggressive cache purging
$wgObjectCaches[CACHE_DB] = [
    'class' => SqlBagOStuff::class,
    'loggroup' => 'SQLBagOStuff',
    'args'  => [ [
        'purgePeriod' => 5,
        'purgeLimit' => 1000,
    ] ]
];
$wgObjectCaches['db-replicated'] = [
    'class' => SqlBagOStuff::class,
    'loggroup'  => 'SQLBagOStuff',
    'reportDupes' => false,
    'args'  => [ [
        'purgePeriod' => 5,
        'purgeLimit' => 1000,
    ] ]
];
