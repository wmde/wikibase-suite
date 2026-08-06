<?php

foreach ( glob( '/var/www/html/LocalSettings.d/*.php' ) as $filename ) {
	include $filename;
}
