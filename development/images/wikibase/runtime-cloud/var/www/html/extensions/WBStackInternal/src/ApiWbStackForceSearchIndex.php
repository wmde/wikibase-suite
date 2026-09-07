<?php

namespace WBStack\Internal;

use Wikimedia\ParamValidator\ParamValidator;

/**
 * This should populate the ElasticSearch index for the requested wiki
 */
class ApiWbStackForceSearchIndex extends \ApiBase {
    public function mustBePosted() {return true;}
    public function isWriteMode() {return true;}
    public function isInternal() {return true;}
    public function execute() {
        @set_time_limit( 60*5 ); // 5 mins maybe D:
		@ini_set( 'memory_limit', '-1' ); // also try to disable the memory limit? Is this even a good idea?
		
        $fromId = $this->getParameter('fromId');
        $toId = $this->getParameter('toId');

		$commandResult = MaintenanceCommand::run(
			'extensions/CirrusSearch/maintenance/ForceSearchIndex.php',
			[
				'--skipLinks', '1',
				'--indexOnSkip', '1',
				'--fromId', (string)$fromId,
				'--toId', (string)$toId,
			]
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
        return [
            'fromId' => [
                ParamValidator::PARAM_TYPE => 'integer',
                ParamValidator::PARAM_REQUIRED => true
            ],
            'toId' => [
                ParamValidator::PARAM_TYPE => 'integer',
                ParamValidator::PARAM_REQUIRED => true
            ],
        ];
    }
}

