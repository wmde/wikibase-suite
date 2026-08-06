<?php

namespace MediaWiki\Extension\WikibaseSuite;

use MediaWiki\Api\ApiQuery;
use MediaWiki\Api\ApiQueryBase;
use Wikimedia\ParamValidator\ParamValidator;

class ApiQueryWikibaseSuite extends ApiQueryBase {
	public function __construct( ApiQuery $queryModule, $moduleName ) {
		parent::__construct( $queryModule, $moduleName, 'wbs' );
	}

	public function execute() {
		$params = $this->extractRequestParams();
		$props = $params['prop'] ?? [ 'versions' ];
		if ( !is_array( $props ) ) {
			$props = [ (string)$props ];
		}

		$data = [];

		if ( in_array( 'versions', $props, true ) ) {
			$data['versions'] = [
				'wikibase_image_version' => $this->getVersionValue( 'WIKIBASE_IMAGE_VERSION' ),
				'deploy_version' => $this->getVersionValue( 'DEPLOY_VERSION' ),
			];
		}

		if ( in_array( 'publicmetrics', $props, true ) ) {
			$data['publicmetrics'] = $this->getPublicMetrics();
		}

		$this->getResult()->addValue( 'query', $this->getModuleName(), $data );
	}

	public function getAllowedParams() {
		return [
			'prop' => [
				ParamValidator::PARAM_TYPE => [ 'versions', 'publicmetrics' ],
				ParamValidator::PARAM_ISMULTI => true,
				ParamValidator::PARAM_DEFAULT => 'versions',
			],
		];
	}

	private function getVersionValue( string $envVar ): string {
		$value = getenv( $envVar );
		if ( $value === false ) {
			return 'unknown';
		}

		$value = trim( (string)$value );
		if ( $value === '' ) {
			return 'unknown';
		}

		return $value;
	}

	/**
	 * Return aggregate values that are safe to expose without authentication.
	 *
	 * @return array<string,int>
	 */
	private function getPublicMetrics(): array {
		if ( !\ExtensionRegistry::getInstance()->isLoaded( 'WSOAuth' ) ) {
			return [];
		}

		$db = $this->getDB();
		if ( !$db->tableExists( 'wsoauth_multiauth_mappings', __METHOD__ ) ) {
			return [];
		}

		$linkedUserCount = $db->newSelectQueryBuilder()
			->select( 'COUNT(DISTINCT wsoauth_user)' )
			->from( 'wsoauth_multiauth_mappings' )
			->caller( __METHOD__ )
			->fetchField();

		return [ 'wikimedia_linked_user_count' => (int)$linkedUserCount ];
	}
}
