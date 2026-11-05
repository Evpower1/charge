<?php
/** Disposable regression fixture only; never package as a public plugin. */
defined( 'ABSPATH' ) || exit;
if ( 'local' !== wp_get_environment_type() || 'http://localhost:8094' !== home_url() ) { return; }
add_filter( 'elementor/document/config', function ( $config, $id ) {
    if ( ! in_array( (int) $id, array_map( 'absint', get_option( 'evpower_elementor_layouts', array() ) ), true ) ) { return $config; }
    $config['urls']['preview'] = add_query_arg( array( 'page_id' => get_option( 'page_on_front' ), 'elementor-preview' => (int) $id ), home_url( '/' ) );
    return $config;
}, 1000, 2 );
