<?php

# Load things that are needed on all requests, and right at the start
# This is called in the shims

const WBSTACK_INFO_GLOBAL = 'WBStackInfo';

require_once __DIR__ . '/Info/WBStackInfo.php';
require_once __DIR__ . '/Info/GlobalSet.php';
