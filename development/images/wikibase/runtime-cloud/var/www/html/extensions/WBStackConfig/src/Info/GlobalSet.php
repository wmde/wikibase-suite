<?php

namespace WBStack\Info;

class GlobalSetException extends \Exception {}

/**
 * A class for setting a global holding a WBStackInfo object.
 * This includes lookup of the data for the global from cache or API.
 */

class GlobalSet {

    /**
     * @param string $requestDomain A request domain, or 'maint' Example: 'addshore-alpha.wiki.opencura.com'
     * @return void
     */
    public static function forDomain($requestDomain) {
        // Normalize the domain by setting to lowercase
        $requestDomain = strtolower($requestDomain);

        // If the domain is 'maint' then set the maint settings
        if ($requestDomain === 'maint') {
            self::forMaint();
            return;
        }

        $info = self::getCachedOrFreshInfo($requestDomain);
        if ($info instanceof WBStackLookupFailure) {
            throw new GlobalSetException(
                "Failure looking up wiki $requestDomain.",
                $info->statusCode,
            );
        }

        self::setGlobal($info);
    }

    /**
     * Sets the global for a generic wiki using WikiInfo-maint.json
     */
    private static function forMaint() {
        $info = WBStackInfo::newFromJsonString(
            file_get_contents(__DIR__ . '/../../data/WikiInfo-maint.json'),
            'maintenance'
        );

        if($info === null) {
            echo 'Failed to load json from file, probably invalid.';
            die(1);
        }

        self::setGlobal( $info );
    }

    /**
     * Set the global to the given value
     * @param WBStackInfo $info
     */
    private static function setGlobal( $info ) {
        /** @var WBStackInfo $info */
        $GLOBALS[WBSTACK_INFO_GLOBAL] = $info;
    }

    /**
     * @param string $requestDomain
     * @return WBStackInfo|WBStackLookupFailure
     */
    private static function getCachedOrFreshInfo( $requestDomain ) {
        $info = self::getInfoFromApcCache( $requestDomain );
        if( $info !== false ) {
            return $info;
        }

        // TODO create an APC lock saying this proc is going to get fresh data?
        // TODO in reality all of this needs to change...
        $info = self::getInfoFromApi( $requestDomain );

        // Cache positive results for 10 seconds, failures for 2
        $ttl = $info instanceof WBStackInfo ? 10 : 2;
        self::writeInfoToApcCache( $requestDomain, $info, $ttl );

        return $info;
    }

    /**
     * @param string $requestDomain
     * @return WBStackInfo|WBStackLookupFailure|false false if no info is cached (should check)
     */
    private static function getInfoFromApcCache( $requestDomain ) {
        return apcu_fetch( self::cacheKey($requestDomain) );
    }

    /**
     * @param string $requestDomain
     * @param WBStackInfo|WBStackLookupFailure $info
     * @param int $ttl
     */
    private static function writeInfoToApcCache( $requestDomain, $info, $ttl ) {
        $result = apcu_store( self::cacheKey($requestDomain), $info, $ttl );
        if(!$result) {
            // TODO log failed stores?!
        }
    }

    private static function cacheKey( $requestDomain ) {
        return 'WBStackInfo.v1.requestDomain.' . $requestDomain;
    }

    /**
     * @param string $requestDomain
     * @return WBStackInfo|WBStackLookupFailure
     */
    private static function getInfoFromApi( $requestDomain ) {
        // START generic getting of wiki info from domain
        $url = 'http://' . getenv( 'PLATFORM_API_BACKEND_HOST' ) . '/backend/wiki/getWikiForDomain?domain=' . urlencode($requestDomain);
        $headers = [
            'X-Backend-Service: backend-service',
            'X-Backend-Token: backend-token',
        ];

        $client = curl_init($url);
        curl_setopt($client, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($client, CURLOPT_RETURNTRANSFER, true);
        curl_setopt( $client, CURLOPT_USERAGENT, "WBStack - MediaWiki - WBStackInfo::getInfoFromApi" );
        
        $response = curl_exec($client);
        if ($response === false) {
            return new WBStackLookupFailure(502);
        }
        $responseCode = intval(curl_getinfo($client, CURLINFO_RESPONSE_CODE));

        if ($responseCode > 399) {
            return new WBStackLookupFailure($responseCode);
        }

        try {
            return WBStackInfo::newFromJsonString($response, $requestDomain);
        } catch (\Exception $ex) {
            return new WBStackLookupFailure(502);
        }
    }

}

