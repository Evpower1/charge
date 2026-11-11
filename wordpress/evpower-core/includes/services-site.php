<?php
/** Owner-controlled, non-destructive services website setup. */
defined( 'ABSPATH' ) || exit;

function evpower_services_definitions() {
    return array(
        'home' => array( 'Evpower Home', 'home', 'services-home', 'Mobile EV charging, charger supply, installation and maintenance from Evpower in Ethiopia.' ),
        'services' => array( 'Our Services', 'services', 'services-overview', 'Explore mobile EV charging, charger supply, installation and maintenance.' ),
        'mobile' => array( 'Mobile EV Charging', 'mobile-ev-charging', 'service-mobile', 'Request mobile EV charging. Evpower confirms location, vehicle compatibility and availability with you.' ),
        'supply' => array( 'Charger Supply', 'charger-supply', 'service-supply', 'Choose EV charging equipment with guidance on compatibility and your charging needs.' ),
        'installation' => array( 'Charger Installation', 'charger-installation', 'service-installation', 'Discuss an EV charger installation and arrange a site assessment with Evpower.' ),
        'maintenance' => array( 'Charger Maintenance', 'charger-maintenance', 'service-maintenance', 'Request inspection, servicing and support for your EV charging equipment.' ),
        'about' => array( 'About Evpower', 'about', 'services-about', 'Meet Evpower, supporting electric mobility in Ethiopia.' ),
        'contact' => array( 'Contact Us', 'contact', 'services-contact', 'Contact Evpower on +251 911 049 916, toll-free 8890 or info@evpower.et.' ),
        'quote' => array( 'Request a Quote', 'request-a-quote', 'services-quote', 'Tell Evpower what you need and request a charging service or equipment quote.' ),
        'privacy' => array( 'Privacy Policy — review draft', 'privacy', 'services-privacy', '' ),
    );
}

/** Stable destinations, including when an older website already owns a slug. */
function evpower_services_page_url( $key ) {
    $pages = get_option( 'evpower_services_pages', array() );
    $id = absint( is_array( $pages ) ? ( $pages[ $key ] ?? 0 ) : 0 );
    if ( $id && 'page' === get_post_type( $id ) && 'trash' !== get_post_status( $id ) ) { return get_permalink( $id ); }
    $definitions = evpower_services_definitions();
    return isset( $definitions[ $key ] ) ? home_url( '/evpower-' . $definitions[ $key ][1] . '/' ) : home_url( '/' );
}

function evpower_services_access() {
    if ( ! current_user_can( 'manage_options' ) ) { return new WP_Error( 'forbidden', 'Administrator access required.' ); }
    if ( 'evpower' !== get_template() ) { return new WP_Error( 'theme', 'Activate the Evpower theme before preparing the services website.' ); }
    return true;
}

/** Re-render only known bundled patterns after page IDs have been allocated. */
function evpower_services_pattern_content( $name ) {
    $allowed = array_merge( array_column( evpower_services_definitions(), 2 ), array( 'services-header', 'services-footer' ) );
    if ( ! in_array( $name, $allowed, true ) || ! WP_Block_Patterns_Registry::get_instance()->get_registered( 'evpower/' . $name ) ) { return new WP_Error( 'pattern', 'Upload the matching Evpower services theme before preparing this website. Missing pattern: ' . $name ); }
    $file = get_theme_file_path( 'patterns/' . $name . '.php' );
    if ( ! is_file( $file ) ) { return new WP_Error( 'pattern', 'The Evpower services pattern file is missing: ' . $name ); }
    ob_start();
    try { include $file; return ob_get_clean(); }
    catch ( \Throwable $error ) { ob_end_clean(); return new WP_Error( 'pattern', 'Could not prepare the services pattern: ' . $error->getMessage() ); }
}

/** Native block images also belong to the owner's Media Library. */
function evpower_services_import_images( $blocks ) {
    foreach ( $blocks as &$block ) {
        if ( ! empty( $block['innerBlocks'] ) ) { $block['innerBlocks'] = evpower_services_import_images( $block['innerBlocks'] ); }
        if ( 'core/image' !== ( $block['blockName'] ?? '' ) || ! class_exists( 'WP_HTML_Tag_Processor' ) ) { continue; }
        $image = new WP_HTML_Tag_Processor( $block['innerHTML'] );
        if ( ! $image->next_tag( 'IMG' ) ) { continue; }
        $media = evpower_elementor_image( (string) $image->get_attribute( 'src' ), (string) $image->get_attribute( 'alt' ), $block['attrs']['id'] ?? 0 );
        if ( empty( $media['id'] ) ) { continue; }
        $block['attrs']['id'] = (int) $media['id'];
        $image->set_attribute( 'src', $media['url'] );
        $image->add_class( 'wp-image-' . $media['id'] );
        $block['innerHTML'] = $image->get_updated_html();
        $block['innerContent'] = array( $block['innerHTML'] );
    }
    unset( $block );
    return $blocks;
}

function evpower_services_menu() {
    $stored = absint( get_option( 'evpower_services_menu' ) );
    if ( $stored && wp_get_nav_menu_object( $stored ) ) { return $stored; }
    $menu = wp_create_nav_menu( 'Evpower services navigation ' . wp_generate_password( 5, false, false ) );
    if ( is_wp_error( $menu ) ) { return $menu; }
    foreach ( array( 'home' => 'Home', 'services' => 'Services', 'about' => 'About', 'contact' => 'Contact' ) as $key => $label ) {
        $id = wp_update_nav_menu_item( $menu, 0, array( 'menu-item-title' => $label, 'menu-item-url' => esc_url_raw( evpower_services_page_url( $key ) ), 'menu-item-type' => 'custom', 'menu-item-status' => 'publish' ) );
        if ( is_wp_error( $id ) ) { wp_delete_nav_menu( $menu ); return $id; }
    }
    update_option( 'evpower_services_menu', (int) $menu, false );
    return (int) $menu;
}

/** Keep existing owner menus and their option values entirely untouched. */
function evpower_services_elementor_data( $content, $context = '' ) {
    $menu = evpower_services_menu();
    if ( is_wp_error( $menu ) ) { return $menu; }
    $replace = function ( $blocks ) use ( &$replace ) {
        foreach ( $blocks as &$block ) {
            if ( 'core/navigation' === ( $block['blockName'] ?? '' ) ) { $block = array( 'blockName' => 'core/shortcode', 'attrs' => array(), 'innerBlocks' => array(), 'innerHTML' => '[evpower_services_internal_menu]', 'innerContent' => array( '[evpower_services_internal_menu]' ) ); }
            elseif ( ! empty( $block['innerBlocks'] ) ) { $block['innerBlocks'] = $replace( $block['innerBlocks'] ); }
        }
        unset( $block ); return $blocks;
    };
    $data = evpower_blocks_to_elementor( $replace( parse_blocks( $content ) ), $context );
    $finish = function ( &$items ) use ( &$finish, $menu ) {
        foreach ( $items as &$item ) {
            // New documents inherit responsive defaults; later owner margins stay untouched.
            unset( $item['settings']['_margin'] );
            if ( 'shortcode' === ( $item['widgetType'] ?? '' ) && '[evpower_services_internal_menu]' === ( $item['settings']['shortcode'] ?? '' ) ) { $item = evpower_element( 'evpower-navigation', array( 'menu' => (string) $menu, '_css_classes' => 'evs-navigation', '_margin' => array() ) ); }
            foreach ( array( 'button_text_color', 'title_color', 'text_color', 'background_color', 'border_color', 'content_color' ) as $key ) {
                if ( ! isset( $item['settings'][ $key ] ) ) { continue; }
                $colors = array( '#c4f06b' => '#0757e6', '#a4ea20' => '#0757e6', '#183330' => '#102d4d', '#10292e' => '#102d4d', '#737e79' => '#52657a', '#dce2d7' => '#dbe6ef' );
                $item['settings'][ $key ] = $colors[ $item['settings'][ $key ] ] ?? $item['settings'][ $key ];
            }
            if ( 'button' === ( $item['widgetType'] ?? '' ) && '#0757e6' === ( $item['settings']['background_color'] ?? '' ) ) { $item['settings']['button_text_color'] = '#ffffff'; }
            if ( ! empty( $item['elements'] ) ) { $finish( $item['elements'] ); }
        }
        unset( $item );
    };
    $finish( $data );
    return $data;
}

/** Create separate native header/footer documents, never replace owner parts. */
function evpower_services_native_layouts() {
    $layouts = get_option( 'evpower_services_native_layouts', array() );
    $layouts = is_array( $layouts ) ? $layouts : array();
    foreach ( array( 'header', 'footer' ) as $area ) {
        if ( ! empty( $layouts[ $area ] ) && 'wp_template_part' === get_post_type( $layouts[ $area ] ) && 'trash' !== get_post_status( $layouts[ $area ] ) ) { continue; }
        $content = evpower_services_pattern_content( 'services-' . $area );
        if ( is_wp_error( $content ) ) { return $content; }
        $id = wp_insert_post( array( 'post_type' => 'wp_template_part', 'post_status' => 'draft', 'post_title' => 'Evpower services ' . $area, 'post_name' => wp_unique_post_slug( 'services-' . $area, 0, 'publish', 'wp_template_part', 0 ), 'post_content' => wp_slash( serialize_blocks( evpower_services_import_images( parse_blocks( $content ) ) ) ) ), true );
        if ( is_wp_error( $id ) ) { return $id; }
        wp_set_object_terms( $id, get_stylesheet(), 'wp_theme' );
        wp_set_object_terms( $id, $area, 'wp_template_part_area' );
        update_post_meta( $id, '_evpower_services_layout', $area );
        $layouts[ $area ] = $id;
        update_option( 'evpower_services_native_layouts', $layouts, false );
    }
    return $layouts;
}

/** Promote a Free fallback after Pro is installed without replacing its design. */
function evpower_services_promote_layout( $id, $area ) {
    if ( ! current_user_can( 'manage_options' ) || ! current_user_can( 'edit_post', $id ) || ! class_exists( '\Elementor\Plugin' ) || 'elementor_library' !== get_post_type( $id ) ) { return new WP_Error( 'promotion', 'Activate Elementor and sign in as a layout administrator before upgrading the services templates.' ); }
    if ( ! in_array( $area, array( 'header', 'footer' ), true ) || 'section' !== get_post_meta( $id, '_elementor_template_type', true ) || ! \Elementor\Plugin::$instance->documents->get_document_type( $area, false ) ) { return true; }
    $before = array( 'content' => get_post_field( 'post_content', $id, 'raw' ), 'status' => get_post_status( $id ), 'meta' => array(), 'terms' => wp_get_object_terms( $id, 'elementor_library_type', array( 'fields' => 'ids' ) ) );
    foreach ( array( '_elementor_template_type', '_elementor_data', '_elementor_edit_mode', '_elementor_page_settings', '_elementor_conditions' ) as $key ) { $before['meta'][ $key ] = array( 'exists' => metadata_exists( 'post', $id, $key ), 'value' => get_post_meta( $id, $key, true ) ); }
    $restore = function ( $rollback ) use ( $id, $before ) {
        foreach ( $before['meta'] as $key => $entry ) {
            if ( ! $rollback && '_elementor_template_type' === $key ) { continue; }
            if ( $entry['exists'] ) { update_post_meta( $id, $key, wp_slash( $entry['value'] ) ); }
            else { delete_post_meta( $id, $key ); }
        }
        if ( $before['content'] !== get_post_field( 'post_content', $id, 'raw' ) || $before['status'] !== get_post_status( $id ) ) {
            $saved = wp_update_post( array( 'ID' => $id, 'post_content' => wp_slash( $before['content'] ), 'post_status' => $before['status'] ), true );
            if ( is_wp_error( $saved ) ) { throw new \RuntimeException( $saved->get_error_message() ); }
        }
        if ( $rollback && ! is_wp_error( $before['terms'] ) ) { $terms = wp_set_object_terms( $id, $before['terms'], 'elementor_library_type' ); if ( is_wp_error( $terms ) ) { throw new \RuntimeException( $terms->get_error_message() ); } }
    };
    try {
        update_post_meta( $id, '_elementor_template_type', $area );
        $document = \Elementor\Plugin::$instance->documents->get( $id, false );
        if ( ! $document || ! $document->save( array() ) ) { throw new \RuntimeException( 'Elementor Pro could not prepare the services ' . $area . ' document.' ); }
        // A document upgrade must not alter owner content, widget settings or status.
        $restore( false );
        // Native metadata only; never call Pro's editor-payload conditions saver.
        evpower_elementor_default_conditions( $id );
        return true;
    } catch ( \Throwable $error ) {
        try { $restore( true ); \Elementor\Plugin::$instance->documents->get( $id, false ); }
        catch ( \Throwable $restore_error ) { return new WP_Error( 'promotion_restore', 'The services layout upgrade stopped and automatic restoration could not finish. Keep this template and contact support with: ' . $restore_error->getMessage() ); }
        return evpower_elementor_prepare_error( $error );
    }
}

function evpower_services_prepare_elementor() {
    $access = evpower_services_access(); if ( is_wp_error( $access ) ) { return $access; }
    if ( ! class_exists( '\Elementor\Plugin' ) || ! class_exists( 'DOMDocument' ) ) { return new WP_Error( 'elementor', 'Activate Elementor and enable the PHP DOM/XML extension to prepare Elementor editing. Native WordPress blocks remain available.' ); }
    $pages = get_option( 'evpower_services_pages', array() );
    if ( ! is_array( $pages ) || ! $pages ) { return new WP_Error( 'pages', 'Prepare the services website pages first.' ); }
    try {
        foreach ( $pages as $id ) {
            if ( 'page' !== get_post_type( $id ) || 'trash' === get_post_status( $id ) || evpower_has_elementor_data( $id ) ) { continue; }
            $content = get_post_field( 'post_content', $id, 'raw' );
            $data = evpower_services_elementor_data( $content );
            if ( is_wp_error( $data ) ) { return $data; }
            $before = array();
            foreach ( array( '_elementor_edit_mode', '_elementor_data' ) as $key ) { $before[ $key ] = array( 'exists' => metadata_exists( 'post', $id, $key ), 'value' => get_post_meta( $id, $key, true ) ); }
            update_post_meta( $id, '_evpower_before_elementor', array( 'content' => $content, 'template' => get_post_meta( $id, '_wp_page_template', true ) ) );
            try {
                update_post_meta( $id, '_elementor_edit_mode', 'builder' );
                $document = \Elementor\Plugin::$instance->documents->get( $id );
                if ( ! $document || ! $document->save( array( 'elements' => $data ) ) ) { throw new \RuntimeException( 'Elementor could not save the services page.' ); }
            } catch ( \Throwable $error ) {
                foreach ( $before as $key => $entry ) { if ( $entry['exists'] ) { update_post_meta( $id, $key, wp_slash( $entry['value'] ) ); } else { delete_post_meta( $id, $key ); } }
                wp_update_post( array( 'ID' => $id, 'post_content' => wp_slash( $content ) ) );
                throw $error;
            }
        }
        $layouts = get_option( 'evpower_services_elementor_layouts', array() );
        $layouts = is_array( $layouts ) ? $layouts : array();
        foreach ( array( 'header', 'footer' ) as $area ) {
            if ( ! empty( $layouts[ $area ] ) && 'elementor_library' === get_post_type( $layouts[ $area ] ) && 'trash' !== get_post_status( $layouts[ $area ] ) ) {
                $promoted = evpower_services_promote_layout( (int) $layouts[ $area ], $area );
                if ( is_wp_error( $promoted ) ) { return $promoted; }
                continue;
            }
            $content = evpower_services_pattern_content( 'services-' . $area );
            if ( is_wp_error( $content ) ) { return $content; }
            $data = evpower_services_elementor_data( $content, $area );
            if ( is_wp_error( $data ) ) { return $data; }
            $type = \Elementor\Plugin::$instance->documents->get_document_type( $area, false ) ? $area : 'section';
            $document = \Elementor\Plugin::$instance->documents->create( $type, array( 'post_title' => 'Evpower services ' . $area, 'post_status' => 'draft' ) );
            if ( is_wp_error( $document ) ) { return $document; }
            if ( ! $document || ! $document->save( array( 'elements' => $data ) ) ) { return new WP_Error( 'save', 'Could not prepare the services ' . $area . '. The live layout was not changed.' ); }
            $id = $document->get_main_id();
            update_post_meta( $id, '_evpower_services_layout', $area );
            update_post_meta( $id, '_evpower_before_elementor', array( 'content' => $content, 'template' => '' ) );
            $layouts[ $area ] = $id;
            update_option( 'evpower_services_elementor_layouts', $layouts, false );
        }
        \Elementor\Plugin::$instance->files_manager->clear_cache();
        return $layouts;
    } catch ( \Throwable $error ) { return evpower_elementor_prepare_error( $error ); }
}

/** No WooCommerce dependency. Fresh pages start as drafts unless explicitly activated. */
function evpower_services_setup( $options = array() ) {
    $access = evpower_services_access(); if ( is_wp_error( $access ) ) { return $access; }
    $definitions = evpower_services_definitions();
    foreach ( array_merge( array_column( $definitions, 2 ), array( 'services-header', 'services-footer' ) ) as $name ) { $content = evpower_services_pattern_content( $name ); if ( is_wp_error( $content ) ) { return $content; } }
    $pages = get_option( 'evpower_services_pages', array() ); $pages = is_array( $pages ) ? $pages : array();
    $created = array();
    foreach ( $definitions as $key => $definition ) {
        if ( ! empty( $pages[ $key ] ) && 'page' === get_post_type( $pages[ $key ] ) && 'trash' !== get_post_status( $pages[ $key ] ) ) { continue; }
        $slug = get_page_by_path( $definition[1] ) ? 'evpower-' . $definition[1] : $definition[1];
        $id = wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'draft', 'post_title' => $definition[0], 'post_name' => wp_unique_post_slug( $slug, 0, 'publish', 'page', 0 ), 'post_content' => '' ), true );
        if ( is_wp_error( $id ) ) { return $id; }
        update_post_meta( $id, '_evpower_services_key', $key );
        $pages[ $key ] = $id; $created[] = $id;
        update_option( 'evpower_services_pages', $pages, false );
    }
    foreach ( $definitions as $key => $definition ) {
        $id = $pages[ $key ];
        if ( ! in_array( $id, $created, true ) && ( get_post_field( 'post_content', $id, 'raw' ) || get_post_meta( $id, '_evpower_services_seeded', true ) || evpower_has_elementor_data( $id ) ) ) { continue; }
        $content = evpower_services_pattern_content( $definition[2] ); if ( is_wp_error( $content ) ) { return $content; }
        $saved = wp_update_post( array( 'ID' => $id, 'post_content' => wp_slash( serialize_blocks( evpower_services_import_images( parse_blocks( $content ) ) ) ) ), true );
        if ( is_wp_error( $saved ) ) { return $saved; }
        update_post_meta( $id, '_evpower_services_seeded', 1 );
        if ( $definition[3] ) { update_post_meta( $id, '_evpower_description', $definition[3] ); }
    }
    $native = evpower_services_native_layouts(); if ( is_wp_error( $native ) ) { return $native; }
    $menu = evpower_services_menu(); if ( is_wp_error( $menu ) ) { return $menu; }
    if ( empty( $options['wordpress_only'] ) && class_exists( '\Elementor\Plugin' ) ) { $prepared = evpower_services_prepare_elementor(); if ( is_wp_error( $prepared ) ) { return $prepared; } }
    if ( ! empty( $options['activate'] ) ) { $activated = evpower_services_activate(); if ( is_wp_error( $activated ) ) { return $activated; } }
    return $pages;
}

function evpower_services_snapshot() {
    $snapshot = array( 'options' => array(), 'layouts' => array(), 'pages' => array(), 'menu_locations' => get_theme_mod( 'nav_menu_locations', array() ) );
    foreach ( array( 'show_on_front', 'page_on_front', 'evpower_elementor_layouts', 'evpower_header_footer_mode', 'evpower_services_active' ) as $key ) { $sentinel = new stdClass(); $value = get_option( $key, $sentinel ); $snapshot['options'][ $key ] = array( 'exists' => $value !== $sentinel, 'value' => $value !== $sentinel ? $value : null ); }
    foreach ( array( 'evpower_elementor_layouts', 'evpower_services_elementor_layouts', 'evpower_services_native_layouts' ) as $option ) {
        $layouts = get_option( $option, array() );
        foreach ( is_array( $layouts ) ? $layouts : array() as $id ) { $id = absint( $id ); if ( $id && get_post( $id ) ) { $snapshot['layouts'][ $id ] = get_post_status( $id ); } }
    }
    foreach ( get_option( 'evpower_services_pages', array() ) as $id ) { if ( 'page' === get_post_type( $id ) ) { $snapshot['pages'][ $id ] = get_post_status( $id ); } }
    return $snapshot;
}

function evpower_services_restore_snapshot( $snapshot, $failed_activation = false ) {
    $statuses = $snapshot['layouts'] ?? array();
    if ( $failed_activation ) { $statuses += $snapshot['pages'] ?? array(); }
    foreach ( $statuses as $id => $status ) {
        if ( get_post( $id ) && $status !== get_post_status( $id ) ) { $result = wp_update_post( array( 'ID' => $id, 'post_status' => $status ), true ); if ( is_wp_error( $result ) ) { return $result; } }
    }
    foreach ( $snapshot['options'] ?? array() as $key => $entry ) { if ( $entry['exists'] ) { update_option( $key, $entry['value'], false ); } else { delete_option( $key ); } }
    set_theme_mod( 'nav_menu_locations', $snapshot['menu_locations'] ?? array() );
    if ( class_exists( '\Elementor\Plugin' ) ) { \Elementor\Plugin::$instance->files_manager->clear_cache(); }
    return true;
}

function evpower_services_activate() {
    $access = evpower_services_access(); if ( is_wp_error( $access ) ) { return $access; }
    $pages = get_option( 'evpower_services_pages', array() );
    foreach ( evpower_services_definitions() as $key => $definition ) { if ( empty( $pages[ $key ] ) || 'page' !== get_post_type( $pages[ $key ] ) || 'trash' === get_post_status( $pages[ $key ] ) ) { return new WP_Error( 'pages', 'Prepare every services website page before activating the new design.' ); } }
    $native = get_option( 'evpower_services_native_layouts', array() );
    foreach ( array( 'header', 'footer' ) as $area ) { if ( empty( $native[ $area ] ) || 'wp_template_part' !== get_post_type( $native[ $area ] ) ) { return new WP_Error( 'layouts', 'Prepare the services header and footer before activating.' ); } }
    $layouts = get_option( 'evpower_services_elementor_layouts', array() );
    $use_elementor = class_exists( '\Elementor\Plugin' ) && ! empty( $layouts['header'] ) && ! empty( $layouts['footer'] ) && evpower_has_elementor_data( $layouts['header'] ) && evpower_has_elementor_data( $layouts['footer'] );
    if ( get_option( 'evpower_services_active' ) && (int) get_option( 'page_on_front' ) === (int) $pages['home'] && ( ! $use_elementor || $layouts === get_option( 'evpower_elementor_layouts' ) ) ) { return true; }
    $before = evpower_services_snapshot();
    $history = get_option( 'evpower_services_backups', array() ); $history = is_array( $history ) ? $history : array();
    $backups = array_slice( array_merge( $history, array( $before ) ), -5 );
    if ( ! update_option( 'evpower_services_backups', $backups, false ) && get_option( 'evpower_services_backups' ) !== $backups ) { return new WP_Error( 'backup', 'The previous homepage and layout selections could not be backed up. The website was not changed.' ); }
    try {
        foreach ( $pages as $key => $id ) { if ( 'privacy' === $key ) { continue; } $result = wp_update_post( array( 'ID' => $id, 'post_status' => 'publish' ), true ); if ( is_wp_error( $result ) ) { throw new \RuntimeException( $result->get_error_message() ); } }
        foreach ( $native as $id ) { $result = wp_update_post( array( 'ID' => $id, 'post_status' => 'publish' ), true ); if ( is_wp_error( $result ) ) { throw new \RuntimeException( $result->get_error_message() ); } }
        if ( $use_elementor ) {
            foreach ( get_option( 'evpower_elementor_layouts', array() ) as $old_id ) {
                if ( ! in_array( (int) $old_id, array_map( 'intval', $layouts ), true ) && 'elementor_library' === get_post_type( $old_id ) && in_array( get_post_meta( $old_id, '_elementor_template_type', true ), array( 'header', 'footer' ), true ) && 'publish' === get_post_status( $old_id ) ) { $saved = wp_update_post( array( 'ID' => $old_id, 'post_status' => 'draft' ), true ); if ( is_wp_error( $saved ) ) { throw new \RuntimeException( $saved->get_error_message() ); } }
            }
            foreach ( $layouts as $id ) {
                if ( in_array( get_post_meta( $id, '_elementor_template_type', true ), array( 'header', 'footer' ), true ) ) { evpower_elementor_default_conditions( $id ); }
                $saved = wp_update_post( array( 'ID' => $id, 'post_status' => 'publish' ), true ); if ( is_wp_error( $saved ) ) { throw new \RuntimeException( $saved->get_error_message() ); }
            }
            update_option( 'evpower_elementor_layouts', $layouts, false );
        }
        do_action( 'evpower_services_activation_checkpoint', 'layouts' );
        update_option( 'evpower_header_footer_mode', $use_elementor ? 'elementor' : 'wordpress', false );
        update_option( 'page_on_front', (int) $pages['home'], false );
        update_option( 'show_on_front', 'page', false );
        update_option( 'evpower_services_active', 1, false );
        if ( class_exists( '\Elementor\Plugin' ) ) { \Elementor\Plugin::$instance->files_manager->clear_cache(); }
        do_action( 'litespeed_purge_all' );
        return true;
    } catch ( \Throwable $error ) {
        try { $restored = evpower_services_restore_snapshot( $before, true ); if ( is_wp_error( $restored ) ) { throw new \RuntimeException( $restored->get_error_message() ); } update_option( 'evpower_services_backups', $history, false ); }
        catch ( \Throwable $restore_error ) { return new WP_Error( 'restore', 'Activation stopped. Your backup is retained. Restore the previous selection below, or contact support: ' . $restore_error->getMessage() ); }
        return new WP_Error( 'activation', 'Activation stopped and the previous homepage and layout selections were restored: ' . $error->getMessage() );
    }
}

function evpower_services_restore() {
    $access = evpower_services_access(); if ( is_wp_error( $access ) ) { return $access; }
    $history = get_option( 'evpower_services_backups', array() );
    if ( ! is_array( $history ) || ! $history ) { return new WP_Error( 'backup', 'There is no previous services website selection to restore.' ); }
    $snapshot = end( $history );
    $result = evpower_services_restore_snapshot( $snapshot );
    if ( is_wp_error( $result ) ) { return $result; }
    array_pop( $history ); update_option( 'evpower_services_backups', $history, false );
    do_action( 'litespeed_purge_all' );
    return true;
}

/** Native Site Editor parts remain independent from any previous owner header. */
add_filter( 'render_block_data', function ( $block ) {
    if ( 'evpower' !== get_template() || ! get_option( 'evpower_services_active' ) || ( class_exists( '\Elementor\Plugin' ) && 'wordpress' !== get_option( 'evpower_header_footer_mode' ) ) || 'core/template-part' !== ( $block['blockName'] ?? '' ) || ! in_array( $block['attrs']['slug'] ?? '', array( 'header', 'footer' ), true ) ) { return $block; }
    $layouts = get_option( 'evpower_services_native_layouts', array() ); $id = absint( $layouts[ $block['attrs']['slug'] ] ?? 0 );
    if ( $id && 'publish' === get_post_status( $id ) ) { $block['attrs']['slug'] = get_post_field( 'post_name', $id ); $block['attrs']['theme'] = get_stylesheet(); }
    return $block;
}, 15 );

add_action( 'admin_menu', function () { add_submenu_page( 'evpower', 'Services website', 'Services website', 'manage_options', 'evpower-services', 'evpower_services_admin' ); } );

function evpower_services_action_form( $task, $label, $primary = false ) {
    echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" style="display:inline-block;margin:0 12px 12px 0"><input type="hidden" name="action" value="evpower_services_action"><input type="hidden" name="task" value="' . esc_attr( $task ) . '">';
    wp_nonce_field( 'evpower_services_action' );
    echo '<button class="button ' . ( $primary ? 'button-primary' : '' ) . '">' . esc_html( $label ) . '</button></form>';
}

function evpower_services_admin() {
    if ( ! current_user_can( 'manage_options' ) ) { return; }
    $pages = get_option( 'evpower_services_pages', array() ); $active = (bool) get_option( 'evpower_services_active' );
    echo '<div class="wrap" style="max-width:1080px"><h1>Evpower — services website</h1><p>A clean, editable website for Mobile EV Charging, Charger Supply, Installation and Maintenance. WooCommerce is optional. Your existing pages, shop, orders, menus and payment settings are kept.</p>';
    if ( isset( $_GET['done'] ) ) { echo '<div class="notice notice-success"><p>Services website settings saved. Open the pages below to review your content.</p></div>'; }
    echo '<h2>1. Prepare your pages</h2><p>New pages and separate header/footer templates start as drafts. Preparing again preserves your text, photos, Elementor designs and navigation edits. The privacy policy stays a draft for your review.</p><form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="evpower_services_action"><input type="hidden" name="task" value="setup">';
    wp_nonce_field( 'evpower_services_action' );
    echo '<p><label><input type="checkbox" name="activate" value="1"> Publish new pages and use the new homepage and layouts. The previous homepage and layout selections will be backed up for restoration.</label></p><p><button class="button button-primary">Prepare services website</button></p></form>';
    echo '<h2>2. Edit and review</h2><p>Choose WordPress blocks or Elementor. Each image, heading, paragraph and button can be edited individually. Use responsive controls to check tablet and phone layouts.</p><table class="widefat striped"><thead><tr><th>Page</th><th>Status</th><th>Editing and review</th></tr></thead><tbody>';
    foreach ( evpower_services_definitions() as $key => $definition ) {
        $id = absint( $pages[ $key ] ?? 0 ); if ( ! $id || ! get_post( $id ) ) { continue; }
        echo '<tr><td>' . esc_html( get_the_title( $id ) ) . '</td><td>' . esc_html( get_post_status( $id ) ) . '</td><td><a class="button" href="' . esc_url( get_edit_post_link( $id ) ) . '">Edit page</a> ';
        if ( evpower_is_elementor_page( $id ) ) { echo '<a class="button" href="' . esc_url( evpower_elementor_edit_url( $id ) ) . '">Edit with Elementor</a> '; }
        echo '<a href="' . esc_url( 'publish' === get_post_status( $id ) ? get_permalink( $id ) : get_preview_post_link( $id ) ) . '" target="_blank" rel="noopener">Preview</a></td></tr>';
    }
    echo '</tbody></table><p>To replace a photo or the logo in Elementor, select its Image widget, then Choose Image. In WordPress, select the Image block and choose Replace. Your imported photos are in Media → Library.</p><p><strong>Privacy policy:</strong> the starter policy stays a draft, including after activating the services website. Review it for your business, publish it, then add its published URL to your editable footer. A draft policy is not a public page.</p>';
    if ( $pages && class_exists( '\Elementor\Plugin' ) ) { evpower_services_action_form( 'prepare', 'Prepare missing Elementor editing' ); }
    echo '<h3>Header, footer and navigation</h3>';
    $layouts = get_option( 'evpower_services_elementor_layouts', array() ); $native = get_option( 'evpower_services_native_layouts', array() );
    foreach ( array( 'header', 'footer' ) as $area ) {
        echo '<p><strong>' . esc_html( ucfirst( $area ) ) . '</strong> ';
        if ( class_exists( '\Elementor\Plugin' ) && ! empty( $layouts[ $area ] ) ) { echo '<a class="button" href="' . esc_url( evpower_elementor_edit_url( $layouts[ $area ] ) ) . '">Edit with Elementor</a> '; }
        if ( ! empty( $native[ $area ] ) ) { $part = get_post_field( 'post_name', $native[ $area ] ); echo '<a class="button" href="' . esc_url( add_query_arg( array( 'postType' => 'wp_template_part', 'postId' => get_stylesheet() . '//' . $part ), admin_url( 'site-editor.php' ) ) ) . '">Edit WordPress template part</a>'; }
        echo '</p>';
    }
    $menu = absint( get_option( 'evpower_services_menu' ) );
    if ( $menu ) { echo '<p><a class="button" href="' . esc_url( add_query_arg( array( 'action' => 'edit', 'menu' => $menu ), admin_url( 'nav-menus.php' ) ) ) . '">Edit services navigation</a> — this is a separate menu; your previous navigation is kept.</p>'; }
    echo '<p>With Elementor Pro, edit templates in Templates → Theme Builder. If you prepared with Free before installing Pro, prepare missing Elementor editing again to upgrade the existing header/footer documents without replacing their designs. Missing display conditions are initially Entire Site; your later condition edits and publication statuses are preserved.</p><h2>3. Choose the live design</h2><p>Services design: <strong>' . ( $active ? 'active' : 'not active' ) . '</strong>. Activating publishes the new service pages and selects their homepage and header/footer. Restoring recovers the previous selection; it does not delete your new pages or edits.</p>';
    if ( $pages ) { evpower_services_action_form( 'activate', 'Activate services website', true ); }
    if ( get_option( 'evpower_services_backups' ) ) { evpower_services_action_form( 'restore', 'Restore previous homepage and layouts' ); }
    echo '<h2>Enquiries and useful plugins</h2><p>Customer messages are saved privately under Evpower → Enquiries and Bookings. Set your notification email in <a href="' . esc_url( admin_url( 'admin.php?page=evpower' ) ) . '">Setup &amp; help</a>. Configure authenticated email delivery to receive notifications.</p><p>Keep Elementor and your licensed Elementor Pro active for visual editing. Optional: WP Mail SMTP for email, one SEO plugin, and LiteSpeed Cache on compatible Hostinger hosting. WooCommerce is needed only if you choose to add online sales. <a href="' . esc_url( admin_url( 'admin.php?page=evpower-elementor' ) ) . '">Open editing and plugin tools</a>.</p></div>';
}

function evpower_services_handle_action() {
    if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Administrator access required.', '', array( 'response' => 403 ) ); }
    check_admin_referer( 'evpower_services_action' );
    $task = isset( $_POST['task'] ) && is_scalar( $_POST['task'] ) ? sanitize_key( wp_unslash( $_POST['task'] ) ) : '';
    if ( 'setup' === $task ) { $result = evpower_services_setup( array( 'activate' => isset( $_POST['activate'] ) && '1' === $_POST['activate'] ) ); }
    elseif ( 'activate' === $task ) { $result = evpower_services_activate(); }
    elseif ( 'prepare' === $task ) { $result = evpower_services_prepare_elementor(); }
    elseif ( 'restore' === $task ) { $result = evpower_services_restore(); }
    else { $result = new WP_Error( 'task', 'Invalid services website action.' ); }
    if ( is_wp_error( $result ) ) { wp_die( '<p>' . esc_html( $result->get_error_message() ) . '</p><p><a href="' . esc_url( admin_url( 'admin.php?page=evpower-services' ) ) . '">Return to Services website</a></p>', 'Evpower services setup', array( 'response' => 400, 'back_link' => true ) ); }
    wp_safe_redirect( admin_url( 'admin.php?page=evpower-services&done=1' ) ); exit;
}
add_action( 'admin_post_evpower_services_action', 'evpower_services_handle_action' );
