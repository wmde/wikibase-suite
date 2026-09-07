<?php

class Localization {
    private $extensionMessagesFiles;
    private $messagesDirs;
    private $baseDirectory;
    private $isLocalisationRebuild;

    public function __construct(
        &$extensionMessagesFiles,
        &$messagesDirs,
        $baseDirectory,
        $isLocalisationRebuild
    ) {
        $this->extensionMessagesFiles = &$extensionMessagesFiles;
        $this->messagesDirs = &$messagesDirs;
        $this->baseDirectory = $baseDirectory;
        $this->isLocalisationRebuild = $isLocalisationRebuild;
    }

    private function addLocalization( $path ) {
        if ( !is_file( $path ) ) {
            return;
        }
        $processor = new ExtensionProcessor();
        $processor->extractInfoFromFile( $path );
        $info = $processor->getExtractedInfo();

        if ( isset( $info[ 'globals' ][ 'wgExtensionMessagesFiles' ] ) ) {
            $this->extensionMessagesFiles = array_merge(
                $this->extensionMessagesFiles, $info[ 'globals' ][ 'wgExtensionMessagesFiles' ]
            );
        }
        if ( isset( $info[ 'globals' ][ 'wgMessagesDirs' ] ) ) {
            $this->messagesDirs = array_merge(
                $this->messagesDirs, $info[ 'globals' ][ 'wgMessagesDirs' ]
            );
        }
    }

    public function loadExtension( $name ) {
        if ( $this->isLocalisationRebuild ) {
            self::addLocalization( "$this->baseDirectory/extensions/" . $name . "/extension.json" );
        }
    }
}

