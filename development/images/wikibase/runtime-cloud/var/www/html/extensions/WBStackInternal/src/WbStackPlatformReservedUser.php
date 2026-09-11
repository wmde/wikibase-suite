<?php

namespace WBStack\Internal;
use MediaWiki\MediaWikiServices;
use MediaWiki\User\UserFactory;

/**
 * This class performs some set of actions as the PlatformReservedUser
 * These functionalities are used by other internal APIs
 */

class WbStackPlatformReservedUser{
    const PLATFORM_RESERVED_USER = 'PlatformReservedUser';
    // TODO the email address should not be hardcoded? Use one from a mediawiki setting?
    const PLATFORM_RESERVED_EMAIL = 'PlatformReservedUser.mediawikiuser.platform@wbstack.com';

    public static function getUser( MediaWikiServices $services = null ) {
        $services = $services ?: MediaWikiServices::getInstance();
        return $services->getUserFactory()->newFromName( self::PLATFORM_RESERVED_USER, UserFactory::RIGOR_VALID );
    }

    public static function createIfNotExists() {
        $services = MediaWikiServices::getInstance();
        $user = self::getUser( $services );

        // Check the user doesn't already exist
        // TODO the user could be renamed, so check if # of users > 0 instead here..
        if($user->idForName() !== 0){
            // null as no action needed
            return null;
        }

        $user->setEmail( self::PLATFORM_RESERVED_EMAIL );

        // Create the user
        // TODO check create status?
        $createStatus = $services->getAuthManager()->autoCreateUser(
            $user,
            \MediaWiki\Auth\AuthManager::AUTOCREATE_SOURCE_MAINT,
            false
        );

        // Mark the e-mail address confirmed.
        $user->confirmEmail();
        $user->saveSettings();

        // Promote the user to platform user??
        $services->getUserGroupManager()->addUserToMultipleGroups($user, [ 'platform', 'bot' ], null, true);

        return true;
    }

    public static function createOauthConsumer($consumerName, $version, $grants, $callbackUrl, $ownerOnly = false) {
        // ### Setup oauth consumer...
        // LOGIC mainly from https://github.com/wikimedia/mediawiki-extensions-OAuth/blob/master/maintenance/createOAuthConsumer.php ?
        // EXECUTION of script from https://github.com/wmde/wikibase-docker/blob/master/wikibase/1.33/bundle/extra-install.sh#L7 ?

        // callbackUrl in docker: $QS_PUBLIC_SCHEME_HOST_AND_PORT/api.php
        $data = [
            'action' => 'propose',
            'name'         => $consumerName,
            'version'      => $version,
            'description'  => $consumerName,
            'callbackUrl'  => $callbackUrl,
            'callbackIsPrefix' => true,
            'grants' => '["' . implode( '","', $grants) . '"]',
            'granttype' => 'normal',
            'ownerOnly' => $ownerOnly,
            'email' => WbStackPlatformReservedUser::PLATFORM_RESERVED_EMAIL,
            'wiki' => '*',
            'rsaKey' => '',
            'agreement' => true,
            'restrictions' => \MWRestrictions::newDefault(),
            'oauthVersion' => 1,
            'oauth2IsConfidential' => true,
            'oauth2GrantTypes' => [ 'authorization_code', 'refresh_token' ]
        ];

        $context = \RequestContext::getMain();
        $context->setUser( self::getUser() );

        $dbw = \MediaWiki\Extension\OAuth\Backend\Utils::getOAuthDB( DB_PRIMARY );
        $control = new \MediaWiki\Extension\OAuth\Control\ConsumerSubmitControl( $context, $data, $dbw );
        $status = $control->submit();

        if ( !$status->isGood() ) {
            // TODO return more info...
            return false;
        }

        $statusValue = $status->getValue();
        $cmr = $statusValue['result']['consumer'];

        $data = [
            'action' => 'approve',
            'consumerKey'  => $cmr->getConsumerKey(),
            'reason'       => 'Approved by platform',
            'changeToken'  => $cmr->getChangeToken( $context ),
        ];
        $control = new \MediaWiki\Extension\OAuth\Control\ConsumerSubmitControl( $context, $data, $dbw );
        $approveStatus = $control->submit();

        if ( !$approveStatus->isOK() ) {
            return false;
        }

        return true;
    }

    public static function getOAuthConsumer($consumerName, $version, $ownerOnly = false) {
        $user = self::getUser();
        // TODO create the oauth consumer on the fly if it doesn't exist (needs grants and callbackurl)

        // Bail if the user not registered..
        if($user->idForName() === 0){
            return false;
        }

        $db = \MediaWiki\Extension\OAuth\Backend\Utils::getOAuthDB( DB_REPLICA );

        // $c is a Consumer
        // https://github.com/wikimedia/mediawiki-extensions-OAuth/blob/master/src/Backend/Consumer.php
        $c = \MediaWiki\Extension\OAuth\Backend\Consumer::newFromNameVersionUser(
            $db,
            $consumerName,
            $version,
            $user->getId()
        );

        if( $c === false ) {
            return false;
        }

        if ($c->getOwnerOnly() !== $ownerOnly) {
            return false;
        }

        $data = [
            'agent' => $c->getName(),
            'consumerKey' => $c->getConsumerKey(),
            'consumerSecret' => \MediaWiki\Extension\OAuth\Backend\Utils::hmacDBSecret( $c->getSecretKey() ),
        ];

        $a = \MediaWiki\Extension\OAuth\Backend\ConsumerAcceptance::newFromUserConsumerWiki(
            $db,
            $user->getId(),
            $c,
            $c->getWiki(),
            \IDBAccessObject::READ_NORMAL,
            $c->getOAuthVersion(),
        );

        if ( $a !== false ) {
            $data['accessKey'] = $a->getAccessToken();
            $data['accessSecret'] = \MediaWiki\Extension\OAuth\Backend\Utils::hmacDBSecret( $a->getAccessSecret() );
        }

        return $data;
    }
}

