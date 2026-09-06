<?php

namespace MediaWiki\Extension\WikibaseSuite;

use OutputPage;
use Skin;
use SpecialPage;

class Hooks {
	public static function onRegistration(): void {
		if ( !\ExtensionRegistry::getInstance()->isLoaded( 'WikibaseManifest' ) ) {
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
		// These links target Wikibase Repository special pages and namespaces.
		// A client-only wiki does not define the repository namespace constants.
		if ( !defined( 'WB_NS_ITEM' ) ) {
			return;
		}

		$wikibaseLinks = [
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

		self::insertBeforeToolbox( $sidebar, [
			'wikibase-suite-sidebar' => $wikibaseLinks,
		] );
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
