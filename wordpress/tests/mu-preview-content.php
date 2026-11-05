<?php
/** Local fixture for content filters that blank or change a layout preview. */
defined( 'ABSPATH' ) || exit;
if ( 'local' !== wp_get_environment_type() || 'http://localhost:8094' !== home_url() ) { return; }
add_filter( 'the_content', function ( $content ) {
    if ( ! isset( $_GET['evpower-layout-preview'] ) ) { return $content; }
    if ( 'context' === get_option( 'evpower_test_preview_content_mode' ) ) {
        $GLOBALS['post'] = get_post( get_option( 'page_on_front' ) );
        setup_postdata( $GLOBALS['post'] );
    }
    return '';
}, PHP_INT_MAX );
