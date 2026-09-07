<?php

namespace WBStack\Internal;

/**
 * This API can be used to shell out to update.php
 * 
 * WARNING: It has a timeout of 5 mins, so could fail?
 * TODO the timout should be passed by the caller? (and have a default max timeout of something big?)
 * TODO allow other maint scripts too?
 */

class PreApiWbStackUpdate {
    public function execute() {
        @set_time_limit( 60*60 ); // 60 mins maybe D:
		@ini_set( 'memory_limit', '-1' ); // also try to disable the memory limit? Is this even a good idea?

		// Run update.php
		$commandResult = MaintenanceCommand::run( 'maintenance/update.php', [ '--quick' ] );
		$out = $commandResult['output'];
		$return = $commandResult['return'];

		// Return appropriate result
		$res = [
			'script' => 'maintenance/update.php',
			'return' => $return,
			'output' => $out,
		];
		echo json_encode(['wbstackUpdate' => $res]);
    }
}

