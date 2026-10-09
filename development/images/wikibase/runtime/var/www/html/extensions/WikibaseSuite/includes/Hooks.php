<?php

namespace MediaWiki\Extension\WikibaseSuite;

use ExtensionRegistry;
use MediaWiki\Actions\ActionEntryPoint;
use MediaWiki\Extension\WikibaseBootstrap\BootstrapService;
use MediaWiki\Extension\WikibaseSuite\Utils;
use MediaWiki\MediaWikiServices;
use MediaWiki\Output\OutputPage;
use MediaWiki\Request\WebRequest;
use MediaWiki\Skin\Skin;
use MediaWiki\SpecialPage\SpecialPage;
use MediaWiki\Title\Title;
use MediaWiki\User\User;

class Hooks {

	public static function onTestCanonicalRedirect(
		WebRequest $request,
		Title $title,
		OutputPage $output
	): bool {
		if ( self::redirectRootToDashboard( $request, $title, $output ) ) {
			// We've set our own redirect, so skip core's redirect to /wiki/Main_Page.
			return false;
		}
		return true;
	}

	public static function onBeforeInitialize(
		Title $title,
		$unused,
		OutputPage $output,
		User $user,
		WebRequest $request,
		ActionEntryPoint $mediaWiki
	) {
		self::redirectRootToDashboard( $request, $title, $output );
	}

	/**
	 * @return bool true if a redirect to the dashboard was set
	 */
	private static function redirectRootToDashboard(
		WebRequest $request,
		Title $title,
		OutputPage $output
	): bool {
		if ( !$title->isMainPage() ) {
			return false;
		}

		// Only redirect the domain root, not an explicit /wiki/Main_Page URL.
		if ( parse_url( $request->getRequestURL(), PHP_URL_PATH ) !== '/' ) {
			return false;
		}

		if ( $request->getVal( 'redirect' ) === 'no' ) {
			return false;
		}

		if ( !self::isWikibaseEmpty() ) {
			return false;
		}

		$output->redirect( SpecialPage::getTitleFor( 'WikibaseDashboard' )->getLocalURL() );
		return true;
	}

	private static function isWikibaseEmpty(): bool {
		[ $itemCount, $propertyCount ] = Utils::getEntityCounts();
		return $itemCount === 0 && $propertyCount === 0;
	}

	public static function onRegistration(): void {
		if ( !ExtensionRegistry::getInstance()->isLoaded( 'WikibaseManifest' ) ) {
			return;
		}

		global $wgWbManifestExternalServiceMapping;
		$quickStatementsUrl = self::environmentUrl( 'QUICKSTATEMENTS_PUBLIC_URL' );
		if ( $quickStatementsUrl !== null ) {
			$wgWbManifestExternalServiceMapping['quickstatements'] = $quickStatementsUrl;
		}

		$queryServiceEndpoint = self::environmentUrl( 'WDQS_PUBLIC_ENDPOINT_URL' );
		if ( $queryServiceEndpoint !== null ) {
			$wgWbManifestExternalServiceMapping['queryservice'] = $queryServiceEndpoint;
		}

		$queryServiceFrontend = self::environmentUrl( 'WDQS_PUBLIC_FRONTEND_URL' );
		if ( $queryServiceFrontend !== null ) {
			$wgWbManifestExternalServiceMapping['queryservice_ui'] = $queryServiceFrontend;
		}
	}

	public static function onBeforePageDisplay( OutputPage $out, Skin $skin ): void {
		if ( $skin->getSkinName() !== 'vector-2022' ) {
			return;
		}

		$out->addModules( 'ext.wikibasesuite.vector2022' );
		if ( !$skin->getUser()->isRegistered() ) {
			$out->addModules( 'ext.wikibasesuite.pinAnonymousMainMenu' );
		}
	}

	public static function onSoftwareInfo( &$software ): bool {
		$wikibaseImageVersion = getenv( 'WIKIBASE_IMAGE_VERSION' );
		if ( $wikibaseImageVersion === false || trim( (string)$wikibaseImageVersion ) === '' ) {
			$wikibaseImageVersion = 'unknown';
		}

		$software['[https://www.mediawiki.org/wiki/Wikibase/Suite Wikibase Suite Docker Image]'] = trim(
			(string)$wikibaseImageVersion
		);

		$wbsVersion = getenv( 'WBS_VERSION' );
		if ( $wbsVersion !== false && trim( (string)$wbsVersion ) !== '' ) {
			$software['[https://www.mediawiki.org/wiki/Wikibase/Suite Wikibase Suite]'] = trim(
				(string)$wbsVersion
			);
		}

		$wbsToolsImage = getenv( 'WBS_TOOLS_IMAGE' );
		if ( $wbsToolsImage !== false && trim( (string)$wbsToolsImage ) !== '' ) {
			$software['[https://www.mediawiki.org/wiki/Wikibase/Suite Wikibase Suite Tools]'] = trim(
				(string)$wbsToolsImage
			);
		}

		return true;
	}

	public static function onSidebarBeforeOutput( Skin $skin, array &$sidebar ): void {
		if ( !defined( 'WB_NS_ITEM' ) ) {
			return;
		}

		$wikibaseLinks = [
			[
				'text' => $skin->msg( 'wikibasedashboard' )->text(),
				'href' => SpecialPage::getTitleFor( 'WikibaseDashboard' )->getLocalURL(),
				'id'   => 'n-wbs-link-one',
			],
			[
				'text' => $skin->msg( 'wikibasesuite-sidebar-link-create-item' )->text(),
				'href' => SpecialPage::getTitleFor( 'NewItem' )->getLocalURL(),
				'id'   => 'n-wbs-link-one',
			],
			[
				'text' => $skin->msg( 'wikibasesuite-sidebar-link-create-property' )->text(),
				'href' => SpecialPage::getTitleFor( 'NewProperty' )->getLocalURL(),
				'id'   => 'n-wbs-link-two',
			],
			[
				'text' => $skin->msg( 'wikibasesuite-sidebar-link-all-items' )->text(),
				'href' => SpecialPage::getTitleFor( 'AllPages' )->getLocalURL( [
					'namespace' => WB_NS_ITEM,
				] ),
				'id'   => 'n-wbs-link-three',
			],
			[
				'text' => $skin->msg( 'wikibasesuite-sidebar-link-all-properties' )->text(),
				'href' => SpecialPage::getTitleFor( 'ListProperties' )->getLocalURL(),
				'id'   => 'n-wbs-link-four',
			],
		];

		$quickStatementsUrl = self::environmentUrl( 'QUICKSTATEMENTS_PUBLIC_URL' );
		if ( $quickStatementsUrl !== null ) {
			$wikibaseLinks[] = [
				'text' => $skin->msg( 'wikibasesuite-sidebar-link-quickstatements' )->text(),
				'href' => $quickStatementsUrl,
				'id'   => 'n-wbs-link-five',
			];
		}

		$queryServiceUrl = self::environmentUrl( 'WDQS_PUBLIC_FRONTEND_URL' );
		if ( $queryServiceUrl !== null ) {
			$wikibaseLinks[] = [
				'text' => $skin->msg( 'wikibasesuite-sidebar-link-sparql-query-service' )->text(),
				'href' => $queryServiceUrl,
				'id'   => 'n-wbs-link-six',
			];
		}

		$ontologyBootstrapUrl = self::ontologyBootstrapUrlFor( $skin->getUser() );
		if ( $ontologyBootstrapUrl !== null ) {
			$wikibaseLinks[] = [
				'text' => $skin->msg( 'ontologybootstrap' )->text(),
				'href' => $ontologyBootstrapUrl,
				'id' => 'n-ontology-bootstrap',
				'active' => false,
			];
		}

		self::insertBeforeToolbox( $sidebar, [
			'wikibase-suite-sidebar' => $wikibaseLinks,
		] );
	}

	public static function ontologyBootstrapUrlFor( User $user ): ?string {
		if ( !ExtensionRegistry::getInstance()->isLoaded( 'WikibaseBootstrap' ) ||
			!MediaWikiServices::getInstance()
				->getSpecialPageFactory()
				->exists( 'OntologyBootstrap' ) ||
			!BootstrapService::newFromConfig()->isAvailableTo( $user )
		) {
			return null;
		}

		return SpecialPage::getTitleFor( 'OntologyBootstrap' )->getLocalURL();
	}

	private static function insertBeforeToolbox( array &$sidebar, array $sections ): void {
		$toolboxPosition = array_search( 'TOOLBOX', array_keys( $sidebar ), true );
		if ( $toolboxPosition === false ) {
			$sidebar += $sections;
			return;
		}

		$sidebar = array_slice( $sidebar, 0, $toolboxPosition, true )
			+ $sections
			+ array_slice( $sidebar, $toolboxPosition, null, true );
	}

	private static function environmentUrl( string $name ): ?string {
		$value = getenv( $name );
		if ( $value === false || trim( (string)$value ) === '' ) {
			return null;
		}

		return trim( (string)$value );
	}
}
