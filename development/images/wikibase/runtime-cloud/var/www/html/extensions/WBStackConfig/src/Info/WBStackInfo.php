<?php

namespace WBStack\Info;

/**
 * Object holding infomation for a single WBStack Wiki
 * See getSetting
 */
class WBStackInfo
{

    public $requestDomain;
    public $data;
    private $settingsIndex = [];

    /**
     * @param object $data
     */
    public function __construct($data)
    {
        // Create settings index
        foreach ($data->settings as $setting) {
            $this->settingsIndex[$setting->name] = $setting->value;
        }
        // Remove settings from general data
        unset($data->settings);
        // Make the rest of the data accessible
        $this->data = $data;
    }

    /**
     * Construct an info object for use in settings from some JSON string
     * This could be from an API response or from a file
     *
     * @param string $infoJsonString some JSON
     * @param string $requestDomain for the info object
     * @return WBStackInfo|null
     */
    public static function newFromJsonString( $infoJsonString, $requestDomain ) {
        $data = json_decode($infoJsonString);

        // Check if the string we were given was invalid and thus not parsed!
        if ( $data === null ) {
            throw new \Exception('Unexpected malformed payload.');
        }

        // Get the inner data from the response
        $data = $data->data;

        // Data from the api should always be an array with at least an id...
        if (!is_object($data) || !property_exists($data, 'id')) {
            throw new \Exception('Unexpected payload shape.');
        }

        $info = new self($data);
        $info->requestDomain = $requestDomain;
        return $info;
    }

    // Get a setting by name, null if not set..
    // (allows defaults to be in LocalSettings?
    public function getSetting($name)
    {
        if (array_key_exists($name, $this->settingsIndex)) {
            return $this->settingsIndex[$name];
        }
        return null;
    }

    public function __get($name)
    {
        if (property_exists($this->data, $name)) {
            return $this->data->$name;
        }
    }

}

class WBStackLookupFailure
{
    public $statusCode;

    public function __construct($statusCode) {
        $this->statusCode = $statusCode;
    }
}
