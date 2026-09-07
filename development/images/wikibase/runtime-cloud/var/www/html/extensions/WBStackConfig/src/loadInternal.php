<?php

if ( getenv( 'WBSTACK_LOAD_MW_INTERNAL' ) !== 'yes' ) {
	echo 'no!';
	die( 1 );
}

wfLoadExtension( 'WBStackInternal' );

