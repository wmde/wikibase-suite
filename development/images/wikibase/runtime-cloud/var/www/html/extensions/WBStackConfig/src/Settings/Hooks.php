<?php

use MediaWiki\MediaWikiServices;

//// CUSTOM Sidebar for WBStack
// https://www.mediawiki.org/wiki/Manual:Hooks/SkinBuildSidebar
$wgHooks['SkinBuildSidebar'][] = function ( $skin, &$sidebar ) use ( $wikiInfo ) {
    $sidebar['Wikibase'][] = [
        'text'  => 'New Item',
        'href'  => '/wiki/Special:NewItem',
    ];
    $sidebar['Wikibase'][] = [
        'text'  => 'New Property',
        'href'  => '/wiki/Special:NewProperty',
    ];
    if( $wikiInfo->getSetting('wwExtEnableWikibaseLexeme') ) {
        $sidebar['Wikibase'][] = [
            'text'  => 'New Lexeme',
            'href'  => '/wiki/Special:NewLexeme',
        ];
    }
    $sidebar['Wikibase'][] = [
        'text'  => 'New Schema',
        'href'  => '/wiki/Special:NewEntitySchema',
    ];
    $sidebar['Wikibase'][] = [
        'text'  => 'All Properties',
        'href'  => '/wiki/Special:ListProperties',
    ];
    $sidebar['Wikibase'][] = [
        'text'  => 'Query Service',
        'href'  => '/query/',
    ];
    $sidebar['Wikibase'][] = [
        'text'  => 'Cradle',
        'href'  => '/tools/cradle/',
    ];
    $sidebar['Wikibase'][] = [
        'text'  => 'QuickStatements',
        'href'  => '/tools/quickstatements/',
    ];
};

//// CUSTOM Query Service Updater hooks
class WBStackPageUpdateHandler {

    private static $titles = [];
    private static $hasScheduledDeferredUpdate = false;

    public static function registerUpdate( $title ) {
        $key = $title->getNamespace() . ':' . $title->getDBkey();
        self::$titles[$key] = [ $title->getDBkey(), $title->getNamespace() ];
        self::scheduleDeferredUpdateIfNeeded();
    }

    private static function scheduleDeferredUpdateIfNeeded() {
        global $wikiInfo;
        if( !self::$hasScheduledDeferredUpdate ) {
            self::$hasScheduledDeferredUpdate = true;
            $data = [];
            foreach( self::$titles as $titleData ) {
                $data[] = [
                    'wiki_id' => $wikiInfo->id,
                    'title' => $titleData[0],
                    'namespace' => $titleData[1],
                ];
            }
            \DeferredUpdates::addCallableUpdate( function() use ( $data ) {
                $options = [];
                $options['userAgent'] = 'WBStackPageUpdateHandler MediaWiki Event Submitter';
                $options['method'] = 'POST';
                $options['timeout'] = 5;
                $options['postData'] = json_encode($data);
                $httpRequestFactory = MediaWikiServices::getInstance()->getHttpRequestFactory();
                $request = $httpRequestFactory->create(
                    'http://' . getenv( 'PLATFORM_API_BACKEND_HOST' ) . '/backend/event/pageUpdateBatch',
                    $options
                );
                $status = $request->execute();
                if ( !$status->isOK() ) {
                    wfDebugLog('WBSTACK', 'Failed to call platform event/pageUpdateBatch endpoint in WBStackPageUpdateHandler: ' . $status->getStatusValue());
                }
            });
        }
    }
}

// https://www.mediawiki.org/wiki/Manual:Hooks/PageSaveComplete
$wgHooks['PageSaveComplete'][] = function ( \WikiPage $wikiPage, \MediaWiki\User\UserIdentity $user, string $summary, int $flags, \MediaWiki\Revision\RevisionRecord $revisionRecord, \MediaWiki\Storage\EditResult $editResult  ) {
    WBStackPageUpdateHandler::registerUpdate( $wikiPage->getTitle() );
};

// https://www.mediawiki.org/wiki/Manual:Hooks/PageDeleteComplete
$wgHooks['PageDeleteComplete'][] = function ( $page, $deleter, $reason, $id, $revision, $logEntry, $archivedRevisionCount ) {
    WBStackPageUpdateHandler::registerUpdate( $page );
};

// https://www.mediawiki.org/wiki/Manual:Hooks/PageMoveComplete
$wgHooks['PageMoveComplete'][] = function ( $title, $newTitle, $user, $oldid, $newid, $reason, $revision ) {
    WBStackPageUpdateHandler::registerUpdate( $title );
    WBStackPageUpdateHandler::registerUpdate( $newTitle );
};

// https://www.mediawiki.org/wiki/Manual:Hooks/PageUndeleteComplete
$wgHooks['PageUndeleteComplete'][] = function ( $page, $restorer, $reason, $revision, $logEntry, $restoredRevisionCount, $created, $restoredPageIds ) {
    WBStackPageUpdateHandler::registerUpdate( $page );
};

//// CUSTOM User account login and creation logs
class WBStackUserAccountLogging {
    public static function log( $type, $user ) {
        global $wgServer;
        $ip = RequestContext::getMain()->getRequest()->getIP();
        $name = $user->getName();
        $email = $user->getEmail();
        $dnsBlackListed = \MediaWiki\MediaWikiServices::getInstance()->getBlockManager()->isDnsBlacklisted( $ip, false );
        wfDebugLog( 'WBSTACK', "WBStackUserAccountLogging: $type $wgServer $ip $name $email dns:$dnsBlackListed" );
    }
}

$wgHooks['LocalUserCreated'][] = function ( $user, $autocreated ) {
    WBStackUserAccountLogging::log( 'create', $user );
};
$wgHooks['UserLoggedIn'][] = function ( $user ) {
    WBStackUserAccountLogging::log( 'login', $user );
};

