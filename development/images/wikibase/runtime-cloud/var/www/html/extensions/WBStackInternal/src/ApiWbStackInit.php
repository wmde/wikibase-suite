<?php

namespace WBStack\Internal;

use MediaWiki\MediaWikiServices;
use MediaWiki\User\UserFactory;
use MediaWiki\Revision\SlotRecord;
use Wikimedia\ParamValidator\ParamValidator;

/**
 * This API is called when a wiki is first created.
 * It creates a user account.
 * It optionally sets a password.
 * It optionally sets an email.
 * If an email is set and no password is set, then a reset email will be sent.
 *
 * This code is a combination of maintenance/createAndPromote.php and SpecialPasswordReset.php ideas
 */

class ApiWbStackInit extends \ApiBase {
    public function mustBePosted() {return true;}
    public function isWriteMode() {return true;}
    public function isInternal() {return true;}
    public function execute() {
        $this->executeWikiUser();
        WbStackPlatformReservedUser::createIfNotExists();
        $this->initMainPage();
    }
    public function executeWikiUser() {
        $username = $this->getParameter('username');
        $email = $this->getParameter('email');
        $password = $this->getParameter('password');

        $services = MediaWikiServices::getInstance();

        // TODO validation? but our app should always send the right stuff now anyway..

        // Get a user object that we will be interacting with
        $user = $services->getUserFactory()->newFromName( $username, UserFactory::RIGOR_VALID );

        // The user that we want to create should NOT already exist, so bail quickly if it does.
        // TODO the user could be renamed?, so check if # of users > 0 instead here too?
        if($user->idForName() !== 0){
            $this->addFailedNote( 'User already existed: ' . $user->idForName() );
            return;
        }

        // Create the user
        $createStatus = $services->getAuthManager()->autoCreateUser(
            $user,
            \MediaWiki\Auth\AuthManager::AUTOCREATE_SOURCE_MAINT,
            false
        );
        // TODO check the status of $createStatus

        // Mark the e-mail address confirmed.
        if($email){
            $user->setEmail( $email );
            $user->confirmEmail();
            $user->saveSettings();
        }

        // Set a password if needed
        if($password){
            $passwordStatus = $user->changeAuthenticationData([
                'username' => $user->getName(),
                'password' => $password,
                'retype' => $password,
            ]);
            if(!$passwordStatus->isGood()){
                $this->addFailedNote('User password could not be set');
                return;
            }
            // TODO this saveSettings might not be needed...
            $user->saveSettings();
        }

        // Add user to groups
        $promotions = [
            'sysop',
            'bureaucrat',
            //'interface-admin',
            //'bot'
        ];
        $userGroupManager = $services->getUserGroupManager();
        foreach ($promotions as $group) {
            $userGroupManager->addUserToGroup($user, $group, null, true);
        }

        // Send a password reset email (If password not specified)
        $sendResetPasswordEmail = $email && !$password;
        if($sendResetPasswordEmail){
            $services = \MediaWiki\MediaWikiServices::getInstance();
            $passwordReset = $services->getPasswordReset();
            $resetStatus = $passwordReset->execute( $user, $username, $email );
            // TODO check $resetStatus?
        }

        // Update the site stats
        $ssu = \SiteStatsUpdate::factory( [ 'users' => 1 ] );
        $ssu->doUpdate();

        // Return an API Result
        $this->getResult()->addValue(
            null,
            $this->getModuleName(),
            [
                'success' => '1',
                'userId' => $user->getId(),
                'userSet' => $username,
                'emailSet' => (bool)$email,
                'passwordSet' => (bool)$password,
                'emailSent' => $sendResetPasswordEmail,
            ]
        );
    }
    private function addFailedNote( $note ) {
        $this->getResult()->addValue(
            null,
            $this->getModuleName(),
            [
                'success' => '0',
                'note' => $note,
            ]
        );
    }
    public function getAllowedParams() {
        return [
            'username' => [
                ParamValidator::PARAM_TYPE => 'string',
                // Always require a username, always provided by default, and can be provided for sandboxes too?
                ParamValidator::PARAM_REQUIRED => true
            ],
            'email' => [
                ParamValidator::PARAM_TYPE => 'string',
                // Don't require, as for sandboxes we will not have any emails...
                ParamValidator::PARAM_REQUIRED => false
            ],
            'password' => [
                ParamValidator::PARAM_TYPE => 'string',
                // For sandboxes we want to specify a password, but for default behaviour we still want to do password reset emails...
                ParamValidator::PARAM_REQUIRED => false
            ],
        ];
    }

    static public function initMainPage() {
        $user = WbStackPlatformReservedUser::getUser();
        $comment = \CommentStoreComment::newUnsavedComment( '(automated) add default content' );

		$title = MediaWikiServices::getInstance()->getTitleFactory()->newMainPage();
        $page = new \WikiPage( $title );
        $text = ApiWbStackInitMainPage::TEXT;

        $content = \ContentHandler::makeContent( $text, $title );

		$updater = $page->newPageUpdater( $user );
        $updater->setContent( SlotRecord::MAIN, $content );
        $updater->setRcPatrolStatus( \RecentChange::PRC_PATROLLED );
        $updater->saveRevision( $comment, EDIT_NEW | EDIT_FORCE_BOT );
    }
}

