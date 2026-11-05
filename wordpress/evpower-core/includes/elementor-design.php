<?php
defined( 'ABSPATH' ) || exit;

/** Explicit owner action only: plugin updates and Prepare never replace a design. */
function evpower_elementor_design_snapshot( $layouts ) {
    $snapshot = array( 'mode' => get_option( 'evpower_header_footer_mode', 'elementor' ), 'layouts' => array() );
    foreach ( array( 'header', 'footer' ) as $area ) {
        $id = absint( $layouts[ $area ] ?? 0 );
        if ( ! $id || 'elementor_library' !== get_post_type( $id ) || ! current_user_can( 'edit_post', $id ) ) { return new WP_Error( 'layout', 'Prepare Elementor editing first so both assigned header and footer templates are available.' ); }
        $meta = array();
        foreach ( array( '_elementor_data', '_elementor_edit_mode', '_elementor_page_settings' ) as $key ) {
            $meta[ $key ] = array( 'exists' => metadata_exists( 'post', $id, $key ), 'value' => get_post_meta( $id, $key, true ) );
        }
        $snapshot['layouts'][ $area ] = array( 'id' => $id, 'content' => get_post_field( 'post_content', $id, 'raw' ), 'meta' => $meta );
    }
    if ( $snapshot['layouts']['header']['id'] === $snapshot['layouts']['footer']['id'] ) { return new WP_Error( 'layout', 'Assign separate header and footer templates before applying the design.' ); }
    return $snapshot;
}

function evpower_elementor_restore_design_snapshot( $snapshot ) {
    foreach ( $snapshot['layouts'] as $layout ) {
        foreach ( $layout['meta'] as $key => $entry ) {
            if ( $entry['exists'] ) { update_post_meta( $layout['id'], $key, wp_slash( $entry['value'] ) ); }
            else { delete_post_meta( $layout['id'], $key ); }
        }
        $saved = wp_update_post( array( 'ID' => $layout['id'], 'post_content' => wp_slash( $layout['content'] ) ), true );
        if ( is_wp_error( $saved ) ) { return $saved; }
    }
    update_option( 'evpower_header_footer_mode', $snapshot['mode'], false );
    \Elementor\Plugin::$instance->files_manager->clear_cache();
    return true;
}

function evpower_elementor_apply_simple_design( $restore = false ) {
    if ( ! current_user_can( 'manage_options' ) || ! class_exists( '\Elementor\Plugin' ) || 'evpower' !== get_template() ) { return new WP_Error( 'elementor', 'Activate Elementor and the Evpower theme and sign in as an administrator first.' ); }
    if ( ! class_exists( 'DOMDocument' ) ) { return new WP_Error( 'php_dom', 'Enable the PHP DOM/XML extension before applying the design.' ); }
    $layouts = get_option( 'evpower_elementor_layouts', array() );
    $before = evpower_elementor_design_snapshot( is_array( $layouts ) ? $layouts : array() );
    if ( is_wp_error( $before ) ) { return $before; }
    $history = get_option( 'evpower_elementor_design_backups', array() );
    $history = is_array( $history ) ? $history : array();
    try {
        if ( $restore ) {
            $backup = end( $history );
            if ( ! $backup || array_column( $backup['layouts'], 'id' ) !== array_column( $before['layouts'], 'id' ) ) { return new WP_Error( 'backup', 'No backup matches the currently assigned header and footer. Existing templates are unchanged.' ); }
            $result = evpower_elementor_restore_design_snapshot( $backup );
            if ( is_wp_error( $result ) ) { throw new \RuntimeException( $result->get_error_message() ); }
            array_pop( $history );
            update_option( 'evpower_elementor_design_backups', $history, false );
            return true;
        }
        $elements = array();
        foreach ( array( 'header', 'footer' ) as $area ) {
            $pattern = WP_Block_Patterns_Registry::get_instance()->get_registered( 'evpower/' . $area );
            if ( ! $pattern || ! str_contains( $pattern['content'], 'header' === $area ? 'ep-header-simple' : 'ep-footer-light' ) ) { return new WP_Error( 'theme_version', 'Upload Evpower theme 1.2.0 or newer before applying the simple header and footer.' ); }
            $elements[ $area ] = evpower_blocks_to_elementor( parse_blocks( $pattern['content'] ), $area );
        }
        // Keep five owner-triggered replacements; the newest can be restored here.
        $backups = array_slice( array_merge( $history, array( $before ) ), -5 );
        if ( ! update_option( 'evpower_elementor_design_backups', $backups, false ) && get_option( 'evpower_elementor_design_backups' ) !== $backups ) { return new WP_Error( 'backup', 'Could not save a layout backup. The design was not replaced.' ); }
        foreach ( $elements as $area => $data ) {
            $document = \Elementor\Plugin::$instance->documents->get( $layouts[ $area ] );
            if ( ! $document || ! $document->save( array( 'elements' => $data ) ) ) { throw new \RuntimeException( 'Could not save the ' . $area . ' design.' ); }
        }
        // Same document IDs, types, statuses and Pro display conditions are retained.
        update_option( 'evpower_header_footer_mode', 'elementor', false );
        \Elementor\Plugin::$instance->files_manager->clear_cache();
        return true;
    } catch ( \Throwable $error ) {
        try {
            $rollback = evpower_elementor_restore_design_snapshot( $before );
            if ( is_wp_error( $rollback ) ) { throw new \RuntimeException( $rollback->get_error_message() ); }
            update_option( 'evpower_elementor_design_backups', $history, false );
        }
        catch ( \Throwable $rollback_error ) { return new WP_Error( 'design_restore', 'The layout update stopped. Your layout backup is retained; contact support with: ' . $rollback_error->getMessage() ); }
        return new WP_Error( 'design', 'The layout update stopped and your previous design was restored: ' . $error->getMessage() );
    }
}
