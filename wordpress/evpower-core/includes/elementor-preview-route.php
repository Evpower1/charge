<?php
defined( 'ABSPATH' ) || exit;

function evpower_elementor_layout_document( $id ) {
    if ( ! $id || 'elementor_library' !== get_post_type( $id ) ) { return false; }
    $saved = get_option( 'evpower_elementor_layouts', array() );
    return ( is_array( $saved ) && in_array( (int) $id, array_map( 'absint', $saved ), true ) ) || in_array( get_post_meta( $id, '_elementor_template_type', true ), array( 'header', 'footer' ), true );
}

function evpower_elementor_signed_preview_url( $id, $original = '' ) {
    if ( 'evpower' !== get_template() || ! class_exists( '\Elementor\Plugin' ) || ! evpower_elementor_layout_document( $id ) || ! \Elementor\User::is_current_user_can_edit( $id ) ) { return ''; }
    $document = \Elementor\Plugin::$instance->documents->get( $id );
    if ( ! $document || ! $document->is_editable_by_current_user() ) { return ''; }
    $args = array();
    if ( $original ) {
        wp_parse_str( wp_parse_url( $original, PHP_URL_QUERY ) ?: '', $source );
        foreach ( array( 'p', 'page_id', 'post_type', 'elementor_library', 'preview_id', 'preview', 'preview_nonce', 's', 'taxonomy', 'term', 'cat', 'tag', 'ver' ) as $key ) {
            if ( isset( $source[ $key ] ) && is_scalar( $source[ $key ] ) ) { $args[ $key ] = $source[ $key ]; }
        }
    }
    if ( ! array_intersect( array_keys( $args ), array( 'p', 'page_id', 'post_type', 'elementor_library', 's', 'taxonomy', 'term' ) ) ) { $args += array( 'post_type' => 'elementor_library', 'p' => $id ); }
    $args['elementor-preview'] = $id;
    $args['evpower-layout-preview'] = $id;
    $args['ep_preview_nonce'] = wp_create_nonce( 'evpower_layout_preview_' . $id );
    $args['ep_preview_version'] = EVPOWER_CORE_VERSION;
    return add_query_arg( $args, site_url( 'index.php', 'admin' ) );
}

add_filter( 'elementor/document/config', function ( $config, $id ) {
    $id = absint( $id );
    if ( ! evpower_elementor_layout_document( $id ) || ! class_exists( '\Elementor\Plugin' ) ) { return $config; }
    $document = \Elementor\Plugin::$instance->documents->get( $id );
    $original = $config['urls']['preview'] ?? ( $document ? $document->get_preview_url() : '' );
    $url = evpower_elementor_signed_preview_url( $id, $original );
    if ( $url ) { $config['urls']['preview'] = $url; }
    return $config;
}, PHP_INT_MAX, 2 );

// Document subclasses may replace their URL after the parent document filter runs.
// This one-argument hook applies to the completed editor configuration in Elementor 4.3.
add_filter( 'elementor/editor/localize_settings', function ( $settings ) {
    foreach ( array( 'initial_document', 'document' ) as $key ) {
        if ( empty( $settings[ $key ]['id'] ) ) { continue; }
        $id = absint( $settings[ $key ]['id'] );
        $url = evpower_elementor_signed_preview_url( $id, $settings[ $key ]['urls']['preview'] ?? '' );
        if ( $url ) { $settings[ $key ]['urls']['preview'] = $url; }
    }
    return $settings;
}, PHP_INT_MAX, 1 );

function evpower_elementor_direct_preview_id() {
    if ( 'evpower' !== get_template() || ! class_exists( '\Elementor\Plugin' ) || ! isset( $_GET['evpower-layout-preview'], $_GET['ep_preview_nonce'] ) || ! is_scalar( $_GET['evpower-layout-preview'] ) || ! is_scalar( $_GET['ep_preview_nonce'] ) ) { return 0; }
    $id = absint( wp_unslash( $_GET['evpower-layout-preview'] ) );
    if ( ! evpower_elementor_layout_document( $id ) || ! \Elementor\User::is_current_user_can_edit( $id ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_GET['ep_preview_nonce'] ) ), 'evpower_layout_preview_' . $id ) ) { return 0; }
    $document = \Elementor\Plugin::$instance->documents->get( $id );
    return $document && $document->is_editable_by_current_user() ? $id : 0;
}

add_action( 'template_redirect', function () {
    if ( ! isset( $_GET['evpower-layout-preview'] ) ) { return; }
    $id = evpower_elementor_direct_preview_id();
    if ( ! $id ) { wp_die( 'Preview session unavailable or expired. Sign in and reopen the editor.', 'Evpower preview', array( 'response' => 403 ) ); }
    $_GET['elementor-preview'] = (string) $id;
    if ( ! defined( 'DONOTCACHEPAGE' ) ) { define( 'DONOTCACHEPAGE', true ); }
    nocache_headers();
    header( 'X-Evpower-Preview-Request: authorized' );
}, -100 );

// Run after Elementor initializes, before canonical redirects and template dispatchers.
add_action( 'template_redirect', function () {
    if ( ! isset( $_GET['evpower-layout-preview'] ) ) { return; }
    $id = evpower_elementor_direct_preview_id();
    if ( ! $id ) { wp_die( 'Preview session unavailable or expired. Sign in and reopen the editor.', 'Evpower preview', array( 'response' => 403 ) ); }
    $_GET['elementor-preview'] = (string) $id;
    status_header( 200 );
    header( 'X-Evpower-Layout-Preview: ' . EVPOWER_CORE_VERSION . '; document=' . $id );
    require EVPOWER_CORE_PATH . 'templates/elementor-preview.php';
    exit;
}, 2 );
