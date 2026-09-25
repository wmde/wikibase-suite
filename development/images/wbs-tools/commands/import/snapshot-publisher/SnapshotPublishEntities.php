<?php

declare( strict_types = 1 );

use MediaWiki\Maintenance\Maintenance;
use MediaWiki\MediaWikiServices;
use MediaWiki\Revision\SlotRecord;
use Wikibase\Repo\WikibaseRepo;
use Wikimedia\Rdbms\RawSQLValue;

/**
 * EXPERIMENTAL SNAPSHOT PUBLISHER.
 *
 * This is deliberately not a general importer. It writes the current-state
 * MediaWiki storage rows directly for a fresh, importer-owned wiki and is
 * pinned to the observed MediaWiki schema. It uses Wikibase's deserializer and
 * content handler for canonical entity JSON, but bypasses PageUpdater,
 * RecentChanges, EntityStore watchers and derived-data updates.
 */
class WbsSnapshotPublishEntities extends Maintenance {
    public function __construct() {
        parent::__construct();
        $this->addDescription( 'UNSAFE prototype: batch-publish current Wikibase entity revisions into an empty wiki.' );
        $this->addOption( 'bundle', 'Prepared wbs-bulk-import/v1 bundle directory', true, true );
        $this->addOption( 'user', 'Existing local account for revision attribution', true, true );
        $this->addOption( 'batch-size', 'Rows committed per transaction (default 1000)', false, true );
        $this->addOption( 'rebuild-terms', 'Populate normalized Wikibase term tables with the official term-store writers' );
        $this->addOption( 'report', 'New JSON report path for the completed publication', false, true );
        $this->addOption( 'expected-mediawiki', 'Required exact MW_VERSION safety gate', true, true );
        $this->addOption( 'allow-unsafe-snapshot-prototype', 'Required acknowledgement for direct storage writes' );
    }

    private function readJson( string $path ): array {
        $data = file_get_contents( $path );
        if ( $data === false ) {
            throw new RuntimeException( "Cannot read $path" );
        }
        $value = json_decode( $data, true, 512, JSON_THROW_ON_ERROR );
        if ( !is_array( $value ) ) {
            throw new RuntimeException( "Expected JSON object in $path" );
        }
        return $value;
    }

    private function scalar( $db, string $table, string $field, array $where ): int {
        $value = $db->newSelectQueryBuilder()->select( $field )->from( $table )
            ->where( $where )->caller( __METHOD__ )->fetchField();
        if ( $value === false ) {
            throw new RuntimeException( "Required $table row is missing" );
        }
        return (int)$value;
    }

    public function execute() {
        if ( !$this->hasOption( 'allow-unsafe-snapshot-prototype' ) ) {
            $this->fatalError( 'Refusing direct storage writes without --allow-unsafe-snapshot-prototype' );
        }
        if ( $this->getOption( 'expected-mediawiki' ) !== MW_VERSION ) {
            $this->fatalError( 'MW_VERSION differs from --expected-mediawiki; refusing schema-dependent write' );
        }
        $batchSize = filter_var( $this->getOption( 'batch-size', 1000 ), FILTER_VALIDATE_INT );
        if ( !$batchSize || $batchSize < 1 ) {
            $this->fatalError( 'batch-size must be positive' );
        }
        $bundle = rtrim( $this->getOption( 'bundle' ), '/' );
        $manifest = $this->readJson( $bundle . '/manifest.json' );
        $source = $bundle . '/entities.ndjson';
        if ( ( $manifest['format'] ?? null ) !== 'wbs-bulk-import/v1' ||
            ( $manifest['id_policy'] ?? null ) !== 'preserve-in-empty-wiki' ||
            !is_file( $source ) || hash_file( 'sha256', $source ) !== ( $manifest['sha256'] ?? null ) ) {
            $this->fatalError( 'Unsupported or modified prepared bundle' );
        }
        $services = MediaWikiServices::getInstance();
        $db = $services->getConnectionProvider()->getPrimaryDatabase();
        if ( $db->getType() !== 'mysql' ) {
            $this->fatalError( 'This prototype is pinned to MariaDB/MySQL' );
        }
        $user = $services->getUserFactory()->newFromName( $this->getOption( 'user' ) );
        if ( !$user || !$user->isRegistered() ) {
            $this->fatalError( 'user must identify an existing local account' );
        }
        $models = WikibaseRepo::getEntityContentFactory()->getEntityContentModels();
        if ( $db->newSelectQueryBuilder()->select( 'page_id' )->from( 'page' )
            ->where( [ 'page_content_model' => $models ] )->caller( __METHOD__ )->fetchField() !== false ) {
            $this->fatalError( 'Snapshot publisher requires a wiki without Wikibase entities' );
        }
        $actorId = $this->scalar( $db, 'actor', 'actor_id', [ 'actor_user' => $user->getId() ] );
        $roleId = $this->scalar( $db, 'slot_roles', 'role_id', [ 'role_name' => SlotRecord::MAIN ] );
        $commentId = $this->scalar( $db, 'comment', 'comment_id', [ 'comment_text' => '' ] );
        $lock = 'wbs-snapshot-publisher';
        if ( !$db->lock( $lock, __METHOD__, 0 ) ) {
            $this->fatalError( 'Another snapshot publisher holds the import lock' );
        }
        $started = microtime( true );
        $termSeconds = 0.0;
        $published = 0;
        $pending = 0;
        $rebuildTerms = $this->hasOption( 'rebuild-terms' );
        try {
            foreach ( [ 'item', 'property' ] as $kind ) {
                $maximum = $manifest['max_ids'][$kind] ?? null;
                if ( !is_int( $maximum ) || $maximum < 0 || $maximum > 2147483647 ) {
                    throw new RuntimeException( 'Invalid maximum entity identifier' );
                }
                if ( $maximum > 0 ) {
                    $db->newInsertQueryBuilder()->insertInto( 'wb_id_counters' )
                        ->row( [ 'id_type' => 'wikibase-' . $kind, 'id_value' => $maximum ] )
                        ->onDuplicateKeyUpdate()->uniqueIndexFields( 'id_type' )
                        ->set( [ 'id_value' => new RawSQLValue( "GREATEST(id_value, $maximum)" ) ] )
                        ->caller( __METHOD__ )->execute();
                }
            }
            $services->getDBLoadBalancerFactory()->commitPrimaryChanges( __METHOD__ );
            $deserializer = WikibaseRepo::getAllTypesEntityDeserializer();
            $factory = WikibaseRepo::getEntityContentFactory();
            $titles = WikibaseRepo::getEntityTitleStoreLookup();
            $itemTermWriter = $rebuildTerms ? WikibaseRepo::getItemTermStoreWriter() : null;
            $propertyTermWriter = $rebuildTerms ? WikibaseRepo::getPropertyTermStoreWriter() : null;
            $modelIds = [];
            $stream = fopen( $source, 'rb' );
            if ( !$stream ) {
                throw new RuntimeException( 'Cannot open prepared entities' );
            }
            try {
                while ( ( $line = fgets( $stream ) ) !== false ) {
                    $entity = $deserializer->deserialize( json_decode( $line, true, 512, JSON_THROW_ON_ERROR ) );
                    $id = $entity->getId();
                    if ( !$id ) {
                        throw new RuntimeException( 'Entity is missing an ID' );
                    }
                    $content = $factory->newFromEntity( $entity );
                    $model = $content->getModel();
                    // A fresh wiki may not have seen the Wikibase content model yet.
                    // Use MediaWiki's name-table service for this small schema lookup.
                    $modelIds[$model] ??= $services->getContentModelStore()->acquireId( $model );
                    $text = $content->getContentHandler()->serializeContent( $content );
                    $title = $titles->getTitleForId( $id );
                    if ( !$title ) {
                        throw new RuntimeException( 'Cannot derive title for ' . $id->getSerialization() );
                    }
                    $now = $db->timestamp();
                    $size = strlen( $text );
                    // TextContentBlobStore uses this address to find old_id.
                    $db->newInsertQueryBuilder()->insertInto( 'text' )->row( [
                        'old_text' => $text,
                        'old_flags' => 'utf-8',
                    ] )->caller( __METHOD__ )->execute();
                    $textId = (int)$db->insertId();
                    $db->newInsertQueryBuilder()->insertInto( 'content' )->row( [
                        'content_size' => $size,
                        'content_sha1' => SlotRecord::base36Sha1( $text ),
                        'content_model' => $modelIds[$model],
                        'content_address' => 'tt:' . $textId,
                    ] )->caller( __METHOD__ )->execute();
                    $contentId = (int)$db->insertId();
                    $db->newInsertQueryBuilder()->insertInto( 'page' )->row( [
                        'page_namespace' => $title->getNamespace(),
                        'page_title' => $title->getDBkey(),
                        'page_is_redirect' => 0,
                        'page_is_new' => 1,
                        'page_random' => mt_rand() / mt_getrandmax(),
                        'page_touched' => $now,
                        'page_links_updated' => $now,
                        'page_latest' => 0,
                        'page_len' => $size,
                        'page_content_model' => $model,
                        'page_lang' => null,
                    ] )->caller( __METHOD__ )->execute();
                    $pageId = (int)$db->insertId();
                    $db->newInsertQueryBuilder()->insertInto( 'revision' )->row( [
                        'rev_page' => $pageId,
                        'rev_comment_id' => $commentId,
                        'rev_actor' => $actorId,
                        'rev_timestamp' => $now,
                        'rev_minor_edit' => 0,
                        'rev_deleted' => 0,
                        'rev_len' => $size,
                        'rev_parent_id' => 0,
                    ] )->caller( __METHOD__ )->execute();
                    $revisionId = (int)$db->insertId();
                    $db->newInsertQueryBuilder()->insertInto( 'slots' )->row( [
                        'slot_revision_id' => $revisionId,
                        'slot_role_id' => $roleId,
                        'slot_content_id' => $contentId,
                        'slot_origin' => $revisionId,
                    ] )->caller( __METHOD__ )->execute();
                    $db->newUpdateQueryBuilder()->update( 'page' )->set( [
                        'page_latest' => $revisionId,
                        'page_touched' => $now,
                    ] )->where( [ 'page_id' => $pageId ] )->caller( __METHOD__ )->execute();
                    if ( $rebuildTerms ) {
                        $termStarted = microtime( true );
                        if ( $entity->getType() === 'item' ) {
                            $termsSaved = $itemTermWriter->saveTermsOfEntity( $entity );
                        } elseif ( $entity->getType() === 'property' ) {
                            $termsSaved = $propertyTermWriter->saveTermsOfEntity( $entity );
                        } else {
                            throw new RuntimeException( 'Unsupported entity type for term rebuild' );
                        }
                        if ( !$termsSaved ) {
                            throw new RuntimeException( 'Wikibase term-store writer rejected entity terms' );
                        }
                        $termSeconds += microtime( true ) - $termStarted;
                    }
                    $published++;
                    $pending++;
                    if ( $pending >= $batchSize ) {
                        $services->getDBLoadBalancerFactory()->commitPrimaryChanges( __METHOD__ );
                        $pending = 0;
                    }
                }
            } finally {
                fclose( $stream );
            }
            $services->getDBLoadBalancerFactory()->commitPrimaryChanges( __METHOD__ );
            if ( $published !== $manifest['counts']['item'] + $manifest['counts']['property'] ) {
                throw new RuntimeException( 'Published entity count differs from manifest' );
            }
            $report = json_encode( [
                'format' => 'wbs-snapshot-publisher-run/v0',
                'phase' => 'current-state-published',
                'published' => $published,
                'seconds' => microtime( true ) - $started,
                'per_second' => $published / max( microtime( true ) - $started, 0.000001 ),
                'mediawiki' => MW_VERSION,
                'derived_services' => false,
                'terms_rebuilt' => $rebuildTerms,
                'term_writer_seconds' => $termSeconds,
            ], JSON_THROW_ON_ERROR ) . "\n";
            if ( $this->hasOption( 'report' ) ) {
                $reportPath = $this->getOption( 'report' );
                $stream = fopen( $reportPath, 'x' );
                if ( $stream === false || fwrite( $stream, $report ) !== strlen( $report ) || !fflush( $stream ) || !fsync( $stream ) ) {
                    throw new RuntimeException( "Cannot write completed report to $reportPath" );
                }
                fclose( $stream );
            }
            $this->output( $report );
        } finally {
            $db->unlock( $lock, __METHOD__ );
        }
    }
}

return WbsSnapshotPublishEntities::class;
