<?php
defined( 'ABSPATH' ) || exit;

function evpower_elementor_preview_report_config( $id ) {
    $document = class_exists( '\Elementor\Plugin' ) ? \Elementor\Plugin::$instance->documents->get( $id ) : null;
    return array(
        'documentId' => (int) $id,
        'base' => array(
            'Evpower Core' => EVPOWER_CORE_VERSION,
            'Elementor' => defined( 'ELEMENTOR_VERSION' ) ? ELEMENTOR_VERSION : 'inactive',
            'Elementor Pro' => defined( 'ELEMENTOR_PRO_VERSION' ) ? ELEMENTOR_PRO_VERSION : 'inactive',
            'WordPress' => get_bloginfo( 'version' ), 'PHP' => PHP_VERSION,
            'Theme' => get_stylesheet(), 'Requested document' => (int) $id,
            'Document type' => get_post_meta( $id, '_elementor_template_type', true ),
            'Document status' => get_post_status( $id ),
            'Elementor data present' => evpower_has_elementor_data( $id ) ? 'yes' : 'no',
            'Document editable' => $document && $document->is_editable_with_elementor() ? 'yes' : 'no',
        ),
        'siteUrl' => site_url( '/', 'admin' ), 'homeUrl' => home_url( '/' ),
    );
}

function evpower_elementor_enqueue_preview_check( $config ) {
    wp_enqueue_script( 'evpower-preview-check', EVPOWER_CORE_URL . 'assets/elementor-preview-check.js', array(), EVPOWER_CORE_VERSION, true );
    wp_add_inline_script( 'evpower-preview-check', 'window.evpowerPreviewCheck = ' . wp_json_encode( $config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ) . ';', 'before' );
}

function evpower_elementor_preview_check_admin( $id ) {
    if ( ! current_user_can( 'manage_options' ) || ! current_user_can( 'edit_post', $id ) || ! evpower_elementor_layout_document( $id ) ) { wp_die( 'Layout administrator access required.', '', array( 'response' => 403 ) ); }
    check_admin_referer( 'evpower_preview_check_' . $id );
    $config = evpower_elementor_preview_report_config( $id );
    $config['mode'] = 'check';
    $document = class_exists( '\Elementor\Plugin' ) ? \Elementor\Plugin::$instance->documents->get( $id ) : null;
    $config['previewUrl'] = evpower_elementor_signed_preview_url( $id, $document ? $document->get_preview_url() : '' );
    evpower_elementor_enqueue_preview_check( $config );
    echo '<div class="wrap" style="max-width:1000px"><h1>Evpower header/footer preview check</h1><p>This checks the editing area without changing your content. The report includes versions, domains and document IDs. It excludes session tokens, cookies and page content.</p><div id="evpower-preview-status" class="notice notice-info inline" role="status"><p>Checking the preview…</p></div><p><button type="button" class="button" id="evpower-copy-preview-report">Copy report</button></p><textarea id="evpower-preview-report" class="large-text code" rows="18" readonly aria-label="Preview diagnostic report"></textarea><p><a class="button button-primary" href="' . esc_url( add_query_arg( 'ep_editor_check', '1', evpower_elementor_edit_url( $id ) ) ) . '">Open editor with diagnostics</a> <a href="' . esc_url( admin_url( 'admin.php?page=evpower-elementor' ) ) . '">Return to Evpower editing</a></p><p>If the editor still shows an error, use its <strong>Copy Evpower editor report</strong> button. That report checks the actual editor iframe.</p></div>';
}

add_action( 'elementor/editor/after_enqueue_scripts', function () {
    if ( ! current_user_can( 'manage_options' ) || empty( $_GET['ep_editor_check'] ) || ! isset( $_GET['post'] ) || ! is_scalar( $_GET['post'] ) ) { return; }
    $id = absint( wp_unslash( $_GET['post'] ) );
    if ( ! current_user_can( 'edit_post', $id ) || ! evpower_elementor_layout_document( $id ) ) { return; }
    $config = evpower_elementor_preview_report_config( $id ); $config['mode'] = 'editor';
    evpower_elementor_enqueue_preview_check( $config );
} );
