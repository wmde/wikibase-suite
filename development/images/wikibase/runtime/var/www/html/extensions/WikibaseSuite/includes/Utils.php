<?php

namespace MediaWiki\Extension\WikibaseSuite;
use Wikibase\Repo\WikibaseRepo;
use MediaWiki\MediaWikiServices;


class Utils {
    public static function getEntityCounts(): array {
            $namespaceLookup = WikibaseRepo::getEntityNamespaceLookup();

            $itemNs = $namespaceLookup->getEntityNamespace( 'item' );
            $propertyNs = $namespaceLookup->getEntityNamespace( 'property' );

            $dbr = MediaWikiServices::getInstance()
                ->getConnectionProvider()
                ->getReplicaDatabase();

            $count = static function ( ?int $ns ) use ( $dbr ): int {
                if ( $ns === null ) {
                    return 0;
                }
                return (int)$dbr->newSelectQueryBuilder()
                    ->select( 'COUNT(*)' )
                    ->from( 'page' )
                    ->where( [ 'page_namespace' => $ns, 'page_is_redirect' => 0 ] )
                    ->caller( __METHOD__ )
                    ->fetchField();
            };

            return [ $count( $itemNs ), $count( $propertyNs ) ];
        }

    public static function getTripleCount(): int {
        $services = MediaWikiServices::getInstance();
        $endpoint = getenv( 'WDQS_PUBLIC_ENDPOINT_URL' );

        if ( $endpoint === false || $endpoint === '' ) {
            return 0;
        }

        $query = 'SELECT (COUNT(*) AS ?count) WHERE { ?s ?p ?o }';
        $url = $endpoint . '?query=' . urlencode( $query ) . '&format=json';

        $req = $services->getHttpRequestFactory()
            ->create( $url, [ 'timeout' => 5 ], __METHOD__ );
        $req->setHeader( 'Accept', 'application/sparql-results+json' );

        if ( !$req->execute()->isOK() ) {
            return 0;
        }

        $data = json_decode( $req->getContent(), true );
        return (int)( $data['results']['bindings'][0]['count']['value'] ?? 0 );
    }
}
