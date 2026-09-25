<?php

declare( strict_types = 1 );

use MediaWiki\Context\DerivativeContext;
use MediaWiki\Context\RequestContext;
use MediaWiki\Deferred\DeferredUpdates;
use MediaWiki\Maintenance\Maintenance;
use MediaWiki\MediaWikiServices;
use Wikibase\Lib\Store\LookupConstants;
use Wikibase\Repo\Store\Store;
use Wikibase\Repo\WikibaseRepo;
use Wikimedia\Rdbms\RawSQLValue;

/**
 * Experimental, single-writer bootstrap importer. Run through maintenance/run.php.
 * Uses Wikibase edit services for entities; only the numeric allocator is advanced
 * directly, to reserve preserved source IDs before any entities are created.
 */
class WbsImportEntities extends Maintenance {
    public function __construct() {
        parent::__construct();
        $this->addDescription( 'Import a prepared Q/P JSON bundle into an empty local Wikibase.' );
        $this->addOption( 'bundle', 'Prepared bundle directory', true, true );
        $this->addOption( 'state', 'Durable checkpoint path; reuse to resume', true, true );
        $this->addOption( 'user', 'Existing local account for revision attribution', true, true );
        $this->addOption( 'checkpoint-every', 'Checkpoint and report every N entities (default 100)', false, true );
        $this->addOption( 'commit-every', 'Commit and run deferred updates every N entities (default 1)', false, true );
        $this->addOption( 'limit', 'Process at most N entities in this invocation, then pause', false, true );
        $this->addOption( 'save-mode', 'edit-entity (default) or entity-store (fresh, locked bootstrap only)', false, true );
        $this->addOption( 'bootstrap', 'Mark revisions silent for an isolated initial load; rebuild derived indexes separately' );
        $this->addOption( 'validate-only', 'Deserialize the entire bundle without writing to Wikibase' );
    }

    private function readJson( string $path ): array {
        $data = file_get_contents( $path );
        if ( $data === false ) {
            throw new RuntimeException( "Cannot read $path" );
        }
        $value = json_decode( $data, true, 512, JSON_THROW_ON_ERROR );
        if ( !is_array( $value ) ) {
            throw new RuntimeException( "Expected a JSON object in $path" );
        }
        return $value;
    }

    private function checkpoint( string $path, array $state ): void {
        // The old checkpoint remains intact if writing or renaming fails.
        $temporary = $path . '.tmp';
        $stream = fopen( $temporary, 'wb' );
        if ( $stream === false ) {
            throw new RuntimeException( "Cannot create $temporary" );
        }
        try {
            $data = json_encode( $state, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT ) . "\n";
            if ( fwrite( $stream, $data ) !== strlen( $data ) || !fflush( $stream ) || !fsync( $stream ) ) {
                throw new RuntimeException( "Could not persist $temporary" );
            }
        } finally {
            fclose( $stream );
        }
        if ( !rename( $temporary, $path ) ) {
            throw new RuntimeException( "Cannot replace $path" );
        }
    }

    public function execute() {
        $started = microtime( true );
        $bundle = rtrim( $this->getOption( 'bundle' ), '/' );
        $path = $this->getOption( 'state' );
        $interval = filter_var( $this->getOption( 'checkpoint-every', 100 ), FILTER_VALIDATE_INT );
        $commitEvery = filter_var( $this->getOption( 'commit-every', 1 ), FILTER_VALIDATE_INT );
        $limit = filter_var( $this->getOption( 'limit', PHP_INT_MAX ), FILTER_VALIDATE_INT );
        $saveMode = $this->getOption( 'save-mode', 'edit-entity' );
        $bootstrap = $this->hasOption( 'bootstrap' );
        if ( !$interval || $interval < 1 || !$commitEvery || $commitEvery < 1 || !$limit || $limit < 1 ) {
            $this->fatalError( 'checkpoint-every, commit-every and limit must be positive integers' );
        }
        if ( !in_array( $saveMode, [ 'edit-entity', 'entity-store' ], true ) ) {
            $this->fatalError( 'save-mode must be edit-entity or entity-store' );
        }
        $services = MediaWikiServices::getInstance();
        $db = $services->getConnectionProvider()->getPrimaryDatabase();
        $lock = 'wbs-bulk-import';
        if ( !$db->lock( $lock, __METHOD__, 0 ) ) {
            $this->fatalError( 'Another bulk importer holds the wiki import lock' );
        }
        $state = null;
        $processed = $created = $recovered = 0;
        $loopStarted = null;
        $entityProcessingSeconds = $deserializationSeconds = $saveSeconds = $postSaveSeconds = 0.0;
        $events = $path . '.' . gmdate( 'Ymd\THis' ) . '-' . bin2hex( random_bytes( 4 ) ) . '.events.ndjson';
        $report = function ( string $phase, ?string $error = null ) use (
            $events, $started, &$state, &$processed, &$created, &$recovered,
            &$loopStarted, &$entityProcessingSeconds, &$deserializationSeconds,
            &$saveSeconds, &$postSaveSeconds, $saveMode, $bootstrap, $commitEvery
        ): void {
            $elapsed = microtime( true ) - $started;
            $loopElapsed = $loopStarted === null ? 0.0 : microtime( true ) - $loopStarted;
            $row = [
                'format' => 'wbs-bulk-import-run/v1',
                'phase' => $phase,
                'timestamp' => gmdate( 'c' ),
                'elapsed_seconds' => $elapsed,
                'processed_this_run' => $processed,
                'created_this_run' => $created,
                'recovered_this_run' => $recovered,
                'save_mode' => $saveMode,
                'bootstrap' => $bootstrap,
                'commit_every' => $commitEvery,
                'created_per_second' => $created / max( $elapsed, 0.000001 ),
                // This excludes manifest/checksum/resume/ID-reservation setup.
                // It still deliberately includes per-entity Wikibase saves,
                // commits and deferred updates: the meaningful importer path.
                'entity_save_loop_seconds' => $loopElapsed,
                'entity_save_loop_created_per_second' => $created / max( $loopElapsed, 0.000001 ),
                'entity_processing_seconds' => $entityProcessingSeconds,
                'deserialization_seconds' => $deserializationSeconds,
                'save_attempt_seconds' => $saveSeconds,
                'commit_and_deferred_seconds' => $postSaveSeconds,
                'setup_seconds' => $loopStarted === null ? $elapsed : $loopStarted - $started,
                'php_peak_bytes' => memory_get_peak_usage( true ),
                'completed_entities' => $state['completed_entities'] ?? 0,
                'last_id' => $state['last_id'] ?? null,
                'source_sha256' => $state['source_sha256'] ?? null,
                // Saving revisions does not establish search/updater readiness.
                'search_ready' => null,
                'query_service_ready' => null,
                'error' => $error,
            ];
            $line = json_encode( $row, JSON_THROW_ON_ERROR ) . "\n";
            if ( file_put_contents( $events, $line, FILE_APPEND | LOCK_EX ) !== strlen( $line ) ) {
                throw new RuntimeException( "Cannot write metrics to $events" );
            }
            $this->output( $line );
        };
        try {
            $manifest = $this->readJson( $bundle . '/manifest.json' );
            if ( ( $manifest['format'] ?? null ) !== 'wbs-bulk-import/v1' ||
                ( $manifest['entities_file'] ?? null ) !== 'entities.ndjson' ||
                ( $manifest['id_policy'] ?? null ) !== 'preserve-in-empty-wiki'
            ) {
                throw new RuntimeException( 'Unsupported prepared input contract' );
            }
            $source = $bundle . '/entities.ndjson';
            if ( hash_file( 'sha256', $source ) !== $manifest['sha256'] ) {
                throw new RuntimeException( 'Input checksum mismatch; refusing import/resume' );
            }
            $deserializer = WikibaseRepo::getAllTypesEntityDeserializer();
            if ( $this->hasOption( 'validate-only' ) ) {
                $stream = fopen( $source, 'rb' );
                while ( ( $line = fgets( $stream ) ) !== false ) {
                    $deserializer->deserialize( json_decode( $line, true, 512, JSON_THROW_ON_ERROR ) );
                    $processed++;
                }
                fclose( $stream );
                $report( 'deserialized-only' );
                return;
            }
            if ( $db->getType() !== 'mysql' ) {
                throw new RuntimeException( 'This prototype requires MariaDB/MySQL' );
            }
            $user = $services->getUserFactory()->newFromName( $this->getOption( 'user' ) );
            if ( !$user || !$user->isRegistered() ) {
                throw new RuntimeException( 'user must identify an existing local account' );
            }
            $context = new DerivativeContext( RequestContext::getMain() );
            $context->setUser( $user );
            $identity = [
                'wiki' => $db->getDomainID(),
                'server' => $services->getMainConfig()->get( 'Server' ),
                'mediawiki' => MW_VERSION,
                'image_version' => getenv( 'WIKIBASE_IMAGE_VERSION' ),
                'importer_sha256' => hash_file( 'sha256', __FILE__ ),
                'user_id' => $user->getId(),
                'save_mode' => $saveMode,
                'bootstrap' => $bootstrap,
                'commit_every' => $commitEvery,
            ];
            $lookup = WikibaseRepo::getStore()->getEntityRevisionLookup( Store::LOOKUP_CACHING_DISABLED );
            if ( file_exists( $path ) ) {
                $state = $this->readJson( $path );
                if ( ( $state['format'] ?? null ) !== 'wbs-bulk-import-checkpoint/v1' ||
                    $state['identity'] !== $identity || $state['source_sha256'] !== $manifest['sha256']
                ) {
                    throw new RuntimeException( 'Checkpoint belongs to a different input, wiki, user or software version' );
                }
                if ( $state['last_id'] !== null ) {
                    $last = $lookup->getEntityRevision(
                        WikibaseRepo::getEntityIdParser()->parse( $state['last_id'] ),
                        0, LookupConstants::LATEST_FROM_MASTER
                    );
                    if ( !$last || $last->getRevisionId() !== $state['last_revision'] ) {
                        throw new RuntimeException( 'Last checkpoint revision changed or disappeared; refusing resume' );
                    }
                    $lastRecord = $services->getRevisionStore()->getRevisionById( $last->getRevisionId() );
                    if ( $lastRecord->getComment()->text !== 'WBS bulk import ' . $state['run_id'] ||
                        $lastRecord->getUser()->getId() !== $user->getId()
                    ) {
                        throw new RuntimeException( 'Last checkpoint revision does not belong to this import session' );
                    }
                }
            } else {
                $models = WikibaseRepo::getEntityContentFactory()->getEntityContentModels();
                if ( $db->newSelectQueryBuilder()->select( 'page_id' )->from( 'page' )
                    ->where( [ 'page_content_model' => $models ] )->caller( __METHOD__ )->fetchField() !== false
                ) {
                    throw new RuntimeException( 'Initial import requires a wiki without entities; resume with its original checkpoint' );
                }
                $state = [
                    'format' => 'wbs-bulk-import-checkpoint/v1',
                    'identity' => $identity,
                    'source_sha256' => $manifest['sha256'],
                    'run_id' => bin2hex( random_bytes( 16 ) ),
                    'offset' => 0,
                    'completed_entities' => 0,
                    'last_id' => null,
                    'last_revision' => null,
                ];
                $this->checkpoint( $path, $state );
            }
            // Reserve the complete ID range, including after an interrupted reservation.
            // Entity content, revisions, terms and changes still use Wikibase's services.
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
            $summary = 'WBS bulk import ' . $state['run_id'];
            $flags = EDIT_NEW | EDIT_FORCE_BOT | ( $bootstrap ? EDIT_SILENT : 0 );
            $pendingWrites = 0;
            $flushPendingWrites = function () use ( &$pendingWrites, &$postSaveSeconds, $services ): void {
                if ( $pendingWrites === 0 ) {
                    return;
                }
                $flushStarted = microtime( true );
                $services->getDBLoadBalancerFactory()->commitPrimaryChanges( __METHOD__ );
                DeferredUpdates::doUpdates();
                $services->getDBLoadBalancerFactory()->commitPrimaryChanges( __METHOD__ );
                $postSaveSeconds += microtime( true ) - $flushStarted;
                $pendingWrites = 0;
            };
            $stream = fopen( $source, 'rb' );
            if ( !$stream || fseek( $stream, $state['offset'] ) !== 0 ) {
                throw new RuntimeException( 'Cannot seek to checkpoint' );
            }
            try {
                $loopStarted = microtime( true );
                while ( $processed < $limit && ( $line = fgets( $stream ) ) !== false ) {
                    $entityStarted = microtime( true );
                    $deserializationStarted = microtime( true );
                    $entity = $deserializer->deserialize( json_decode( $line, true, 512, JSON_THROW_ON_ERROR ) );
                    $deserializationSeconds += microtime( true ) - $deserializationStarted;
                    $id = $entity->getId();
                    if ( !$id || !in_array( $entity->getType(), [ 'item', 'property' ], true ) ||
                        (int)substr( $id->getSerialization(), 1 ) > $manifest['max_ids'][$entity->getType()]
                    ) {
                        throw new RuntimeException( 'Entity falls outside the prepared ID range' );
                    }
                    $existing = $lookup->getEntityRevision( $id, 0, LookupConstants::LATEST_FROM_MASTER );
                    if ( $existing ) {
                        // A save may have committed before its checkpoint. Only recover
                        // unchanged revisions created by this exact import session.
                        $revision = $services->getRevisionStore()->getRevisionById( $existing->getRevisionId() );
                        if ( !$existing->getEntity()->equals( $entity ) ||
                            $revision->getComment()->text !== $summary ||
                            $revision->getUser()->getId() !== $user->getId()
                        ) {
                            throw new RuntimeException( 'Conflicting existing entity: ' . $id->getSerialization() );
                        }
                        $revisionId = $existing->getRevisionId();
                        $recovered++;
                    } else {
                        $saveStarted = microtime( true );
                        if ( $saveMode === 'entity-store' ) {
                            // Still creates a normal MediaWiki page/revision and emits
                            // EntityStore's entityUpdated event. This only avoids the
                            // request-edit wrapper, for a fresh importer-owned wiki.
                            $saved = WikibaseRepo::getEntityStore()->saveEntity(
                                $entity, $summary, $user, $flags
                            );
                            $status = null;
                        } else {
                            $edit = WikibaseRepo::getEditEntityFactory()->newEditEntity( $context, $id );
                            $status = $edit->attemptSave( $entity, $summary, $flags, false, false );
                            $saved = null;
                        }
                        $saveSeconds += microtime( true ) - $saveStarted;
                        if ( $status !== null && !$status->isOK() ) {
                            throw new RuntimeException( $id->getSerialization() . ': ' . $status->getMessage()->text() );
                        }
                        if ( $saved === null ) {
                            $saved = $lookup->getEntityRevision( $id, 0, LookupConstants::LATEST_FROM_MASTER );
                        }
                        $revisionId = $saved->getRevisionId();
                        $created++;
                        $pendingWrites++;
                    }
                    $processed++;
                    $state['completed_entities']++;
                    $state['last_id'] = $id->getSerialization();
                    $state['last_revision'] = $revisionId;
                    $state['offset'] = ftell( $stream );
                    $entityProcessingSeconds += microtime( true ) - $entityStarted;
                    $checkpointDue = $processed % $interval === 0;
                    if ( $pendingWrites >= $commitEvery || $checkpointDue ) {
                        $flushPendingWrites();
                    }
                    if ( $checkpointDue ) {
                        $this->checkpoint( $path, $state );
                        $report( 'loading' );
                        $services->getLinkCache()->clear();
                    }
                }
                $flushPendingWrites();
                $complete = $state['offset'] === filesize( $source );
                if ( $complete && $state['completed_entities'] !== $manifest['counts']['item'] + $manifest['counts']['property'] ) {
                    throw new RuntimeException( 'Final entity count differs from manifest' );
                }
                $this->checkpoint( $path, $state );
                $report( $complete ? 'revisions-loaded' : 'paused' );
            } finally {
                fclose( $stream );
            }
        } catch ( Throwable $error ) {
            $report( 'failed', $error->getMessage() );
            $this->fatalError( $error->getMessage() );
        } finally {
            $db->unlock( $lock, __METHOD__ );
        }
    }
}

return WbsImportEntities::class;
