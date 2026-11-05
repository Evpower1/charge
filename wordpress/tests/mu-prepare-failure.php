<?php
/** Disposable preparation-button failure injection; never include in a package. */
defined( 'ABSPATH' ) || exit;
if ( 'local' !== wp_get_environment_type() || 'http://localhost:8094' !== home_url() ) { return; }
add_action( 'elementor/document/after_save', function ( $document ) {
    if ( (int) $document->get_main_id() === (int) get_option( 'evpower_test_prepare_failure' ) ) { throw new RuntimeException( 'LOCAL_PREPARATION_BUTTON_FAILURE' ); }
}, 100 );
