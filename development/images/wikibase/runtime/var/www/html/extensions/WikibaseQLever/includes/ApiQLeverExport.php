<?php

declare( strict_types = 1 );

namespace MediaWiki\Extension\WikibaseQLever;

use MediaWiki\Api\ApiBase;
use MediaWiki\MediaWikiServices;
use Wikibase\DataModel\Entity\EntityRedirect;
use Wikibase\Lib\Store\LookupConstants;
use Wikibase\Lib\Store\RedirectRevision;
use Wikibase\Lib\Store\RevisionedUnresolvedRedirectException;
use Wikibase\Repo\WikibaseRepo;
use Wikimedia\ParamValidator\ParamValidator;
use Wikimedia\ParamValidator\TypeDef\IntegerDef;

/**
 * A bounded, authenticated RDF export for the QLever integration.
 *
 * The page ID cursor makes chunks restartable without holding server-side
 * state. RDF is produced with Wikibase's EntityDataSerializationService, the
 * same service behind Special:EntityData, but avoids one HTTP request per
 * entity during a full index build.
 */
class ApiQLeverExport extends ApiBase {
	private const MAX_LIMIT = 500;

	public function execute(): void {
		$this->assertAuthorized();
		$params = $this->extractRequestParams();
		$after = (int)$params['after'];
		$limit = min( (int)$params['limit'], self::MAX_LIMIT );

		$namespaceLookup = WikibaseRepo::getEntityNamespaceLookup();
		$namespaces = array_values( $namespaceLookup->getEntityNamespaces() );
		if ( $namespaces === [] ) {
			$this->getResult()->addValue( null, $this->getModuleName(), [
				'entities' => [], 'next' => null, 'complete' => '1',
			] );
			return;
		}

		$database = MediaWikiServices::getInstance()->getConnectionProvider()->getReplicaDatabase();
		$result = $database->newSelectQueryBuilder()
			->select( [ 'page_id', 'page_namespace', 'page_title' ] )
			->from( 'page' )
			->where( [
				$database->expr( 'page_id', '>', $after ),
				'page_namespace' => $namespaces,
			] )
			->orderBy( 'page_id' )
			->limit( $limit + 1 )
			->caller( __METHOD__ )
			->fetchResultSet();

		// Read one additional row solely to tell the client whether its cursor
		// can advance. That keeps every returned page at or below `limit`.
		$rows = iterator_to_array( $result );
		$hasMore = count( $rows ) > $limit;
		if ( $hasMore ) array_pop( $rows );

		$titleFactory = MediaWikiServices::getInstance()->getTitleFactory();
		$idLookup = WikibaseRepo::getEntityIdLookup();
		$serializer = WikibaseRepo::getEntityDataSerializationService();
		$entities = [];
		$lastPageId = $after;
		foreach ( $rows as $row ) {
			$lastPageId = (int)$row->page_id;
			$title = $titleFactory->makeTitleSafe( (int)$row->page_namespace, $row->page_title );
			if ( $title === null ) continue;
			$entityId = $idLookup->getEntityIdForTitle( $title );
			if ( $entityId === null ) continue;
			// Serialization is intentionally delegated to Wikibase rather than
			// recreated here: incremental and full indexing need the same RDF.
			[ $revision, $followedRedirect ] = $this->getEntityRevision( $entityId );
			if ( $revision === null ) continue;
			$incomingRedirects = WikibaseRepo::getStore()->getEntityRedirectLookup()->getRedirectIds( $entityId );
			[ $rdf ] = $serializer->getSerializedData( 'nt', $revision, $followedRedirect, $incomingRedirects );
			$entities[] = [
				'id' => $entityId->getSerialization(),
				'rdf' => $rdf,
			];
		}

		$this->getResult()->addValue( null, $this->getModuleName(), [
			'entities' => $entities,
			'next' => $hasMore ? $lastPageId : null,
			// ApiResult represents boolean flags as empty strings. Use an
			// explicit wire value so non-MediaWiki clients can distinguish both
			// states reliably.
			'complete' => $hasMore ? '0' : '1',
		] );
	}

	public function getAllowedParams(): array {
		return [
			'after' => [
				ParamValidator::PARAM_TYPE => 'integer',
				ParamValidator::PARAM_DEFAULT => 0,
				IntegerDef::PARAM_MIN => 0,
			],
			'limit' => [
				ParamValidator::PARAM_TYPE => 'integer',
				ParamValidator::PARAM_DEFAULT => 100,
				IntegerDef::PARAM_MIN => 1,
				IntegerDef::PARAM_MAX => self::MAX_LIMIT,
			],
		];
	}

	public function isWriteMode(): bool {
		return false;
	}

	/**
	 * Match Special:EntityData's redirect behavior, including RDF about the
	 * redirect rather than silently omitting redirect pages from a full export.
	 */
	private function getEntityRevision( $entityId ): array {
		$lookup = WikibaseRepo::getEntityRevisionLookup();
		try {
			return [ $lookup->getEntityRevision(
				$entityId,
				0,
				LookupConstants::LATEST_FROM_REPLICA_WITH_FALLBACK
			), null ];
		} catch ( RevisionedUnresolvedRedirectException $exception ) {
			$redirect = new RedirectRevision(
				new EntityRedirect( $entityId, $exception->getRedirectTargetId() ),
				$exception->getRevisionId(),
				$exception->getRevisionTimestamp()
			);
			[ $revision ] = $this->getEntityRevision( $exception->getRedirectTargetId() );
			return [ $revision, $redirect ];
		}
	}

	private function assertAuthorized(): void {
		global $wgQleverExportTokenFile;
		$tokenFile = $wgQleverExportTokenFile ?: getenv( 'QLEVER_EXPORT_TOKEN_FILE' );
		$expected = is_string( $tokenFile ) && is_readable( $tokenFile ) ? trim( (string)file_get_contents( $tokenFile ) ) : '';
		// Do not use Authorization: the bundled OAuth extension consumes that
		// header before this API module can authenticate the internal request.
		$provided = trim( (string)$this->getRequest()->getHeader( 'X-Wikibase-QLever-Export-Token' ) );
		if ( $expected === '' || $provided === '' || !hash_equals( $expected, $provided ) ) {
			$this->dieWithError( [ 'apierror-permissiondenied' ], 'qleverexport-unauthorized', null, 403 );
		}
	}
}
