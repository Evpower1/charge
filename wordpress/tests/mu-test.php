<?php
/** Local disposable-runtime fixture only. Never include this in an installable ZIP. */
defined( 'ABSPATH' ) || exit;
add_filter( 'pre_wp_mail', '__return_true' );
add_filter( 'pre_http_request', function ( $pre, $args, $url ) {
    if ( isset( $GLOBALS['evpower_test_http'] ) ) { return call_user_func( $GLOBALS['evpower_test_http'], $pre, $args, $url ); }
    return new WP_Error( 'test_external_disabled', 'External requests are disabled in the disposable test runtime.' );
}, 5, 3 );
