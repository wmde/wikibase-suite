<?php

namespace WBStack\Internal;

/**
 * This should queue ForceSearchIndex.php runs on the requested wiki
 */
class ApiWbStackQueueSearchIndexBatches extends \ApiBase {
    public function mustBePosted() {return true;}
    public function isWriteMode() {return true;}
    public function isInternal() {return true;}
    public function execute() {
        @set_time_limit( 60*5 ); // 5 mins maybe D:
		@ini_set( 'memory_limit', '-1' ); // also try to disable the memory limit? Is this even a good idea?
		
		$commandResult = MaintenanceCommand::run(
			'extensions/CirrusSearch/maintenance/ForceSearchIndex.php',
			[ '--skipLinks', '--indexOnSkip', '--buildChunks', '10000' ],
			true
		);
		$out = $commandResult['output'];
		$return = $commandResult['return'];

		// Return appropriate result
		$res = [
			'script' => 'extensions/CirrusSearch/maintenance/ForceSearchIndex.php',
			'return' => $return,
			'output' => $out,
		];
		$this->getResult()->addValue( null, $this->getModuleName(), $res );
    }
    public function getAllowedParams() {
        return [];
    }
}

