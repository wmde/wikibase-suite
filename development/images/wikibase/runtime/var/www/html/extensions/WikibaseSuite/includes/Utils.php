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
}