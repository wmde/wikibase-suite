<?php

namespace WBStack\Logging;

use Psr\Log\AbstractLogger;
use MediaWiki\Logger\LegacyLogger;

class CustomLogger extends AbstractLogger {

    private $channel;
    private $config;

    public function __construct($channel, $config ) {
        $this->channel = $channel;
        $this->config = $config;
    }

    public function log( $level, $message, array $context = [] ) {
        if(in_array($this->channel, $this->config['logAllInGroup'])) {
            $this->doLog( $level, $message, $context );
            return;
        }
        if(in_array($this->channel, $this->config['logAllInGroupExceptDebug']) && $level !== 'debug') {
            $this->doLog( $level, $message, $context );
            return;
        }

        if(in_array($this->channel, $this->config['ignoreAllInGroup'])) {
            return;
        }
        if(in_array($level, $this->config['ignoreLevels'])) {
            return;
        }

        $this->doLog($level, $message, $context);
    }

    private function doLog( $level, $message, $context ) {
        $payload = false;

        if ( str_contains( $this->channel, 'json' ) ) {
            $decoded = json_decode( $message, true );
            if ( json_last_error() === JSON_ERROR_NONE ) {
                $payload = $decoded;
            }
        }

        if ( !$payload ) {
            $payload = [
                'message' => LegacyLogger::format( $this->channel, $message, $context )
            ];
        }

        /**
         * log levels according to PSR-3: https://www.php-fig.org/psr/psr-3/#11-basics
         * debug, info, notice, warning, error, critical, alert, emergency
         */
        $logLevelsCloudErrorReporting = ['error', 'critical', 'alert', 'emergency'];

        if (in_array($level, $logLevelsCloudErrorReporting)) {
            $payload[ '@type' ] = 'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent';
        }

        $envString = '';
        if ($env = getenv('MW_ENVIRONMENT')) {
            $envString = " ({$env})";
        }

        $payload[ 'severity' ] = $level;
        $payload[ 'serviceContext' ] = [
            'service' => 'WBaaS MediaWiki' . $envString,
            'version' => MW_VERSION,
        ];
        $payload[ 'context' ] = [
            'environment'   => $env ?? '',

            'request_uri'   => $_SERVER['REQUEST_URI'] ?? '',

            // set in /includes/Defines.php
            'mediawiki'     => MW_VERSION,

            // set via \WBStack\Info\GlobalSet::forDomain
            'domain'        => $GLOBALS[WBSTACK_INFO_GLOBAL]->requestDomain,    

            // https://www.php.net/manual/en/function.phpversion.php
            'php'           => phpversion(),

            // https://www.php-fig.org/psr/psr-3/#13-context
            'log_context'       => $context,
        ];

        $output = json_encode( $payload );
        if ( json_last_error() !== JSON_ERROR_NONE ) {
            $output = "[$level] " . LegacyLogger::format( $this->channel, $message, $context );
        }

        fwrite( STDERR, $output . PHP_EOL );
    }

}

