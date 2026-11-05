<?php
defined( 'ABSPATH' ) || exit;

function evpower_element( $type, $settings = array(), $children = array() ) {
    if ( 'container' !== $type && ! isset( $settings['_margin'] ) ) { $settings['_margin'] = array( 'top' => '0', 'right' => '0', 'bottom' => '0', 'left' => '0', 'unit' => 'px', 'isLinked' => true ); }
    $element = array( 'id' => substr( str_replace( '-', '', wp_generate_uuid4() ), 0, 8 ), 'elType' => 'widget', 'widgetType' => $type, 'settings' => $settings, 'elements' => $children );
    if ( 'container' === $type ) {
        $element['elType'] = 'container'; unset( $element['widgetType'] ); $element['isInner'] = false;
        if ( isset( $element['settings']['_css_classes'] ) ) { $element['settings']['css_classes'] = $element['settings']['_css_classes']; unset( $element['settings']['_css_classes'] ); }
    }
    return $element;
}

function evpower_html_node( $html, $tag ) {
    $dom = new DOMDocument( '1.0', 'UTF-8' );
    $dom->loadHTML( '<meta charset="utf-8">' . $html, LIBXML_NOERROR | LIBXML_NOWARNING | LIBXML_NONET );
    return array( $dom, $dom->getElementsByTagName( $tag )->item( 0 ) );
}
function evpower_node_html( $dom, $node ) {
    $html = ''; if ( $node ) { foreach ( $node->childNodes as $child ) { $html .= $dom->saveHTML( $child ); } } return $html;
}

/** Put bundled theme photos in the owner's Media Library without remote requests. */
function evpower_elementor_image( $url, $alt, $id = 0 ) {
    if ( $id && 'attachment' === get_post_type( $id ) ) { return array( 'id' => (int) $id, 'url' => $url ); }
    $prefix = trailingslashit( get_theme_file_uri( 'assets/images' ) );
    if ( ! str_starts_with( $url, $prefix ) ) { return array( 'id' => 0, 'url' => $url ); }
    $existing = get_posts( array( 'post_type' => 'attachment', 'post_status' => 'inherit', 'numberposts' => 1, 'meta_key' => '_evpower_source_image', 'meta_value' => $url ) );
    if ( $existing ) { return array( 'id' => $existing[0]->ID, 'url' => wp_get_attachment_url( $existing[0]->ID ) ); }
    $filename = basename( wp_parse_url( $url, PHP_URL_PATH ) );
    $path = get_theme_file_path( 'assets/images/' . $filename );
    if ( ! is_file( $path ) || ! in_array( strtolower( pathinfo( $filename, PATHINFO_EXTENSION ) ), array( 'jpg', 'jpeg', 'png', 'webp' ), true ) ) { return array( 'id' => 0, 'url' => $url ); }
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';
    $temporary = wp_tempnam( $filename );
    if ( ! $temporary || ! copy( $path, $temporary ) ) { return array( 'id' => 0, 'url' => $url ); }
    $attachment = media_handle_sideload( array( 'name' => 'evpower-' . $filename, 'tmp_name' => $temporary ), 0 );
    if ( is_wp_error( $attachment ) ) { @unlink( $temporary ); return array( 'id' => 0, 'url' => $url ); }
    update_post_meta( $attachment, '_wp_attachment_image_alt', sanitize_text_field( $alt ) );
    update_post_meta( $attachment, '_evpower_source_image', $url );
    return array( 'id' => $attachment, 'url' => wp_get_attachment_url( $attachment ) );
}

function evpower_elementor_menu( $block ) {
    $simple = str_contains( $block['attrs']['className'] ?? '', 'ep-navigation-simple' );
    $option = $simple ? 'evpower_elementor_simple_menu' : 'evpower_elementor_menu';
    $title = $simple ? 'Evpower simple menu' : 'Evpower main menu';
    $stored = absint( get_option( $option ) );
    if ( $stored && wp_get_nav_menu_object( $stored ) ) { return $stored; }
    $menu = wp_create_nav_menu( $title );
    if ( is_wp_error( $menu ) ) { $existing = wp_get_nav_menu_object( $title ); $menu = $existing ? $existing->term_id : 0; if ( $menu ) { update_option( $option, (int) $menu, false ); return (int) $menu; } }
    if ( ! $menu ) { return 0; }
    $items = $block['innerBlocks'] ?? array();
    if ( ! empty( $block['attrs']['ref'] ) ) { $post = get_post( $block['attrs']['ref'] ); $items = $post ? parse_blocks( $post->post_content ) : $items; }
    $walk = function ( $blocks, $parent = 0 ) use ( &$walk, $menu ) {
        foreach ( $blocks as $entry ) {
            if ( ! in_array( $entry['blockName'], array( 'core/navigation-link', 'core/navigation-submenu' ), true ) ) { continue; }
            $attrs = $entry['attrs'];
            $url = $attrs['url'] ?? '';
            if ( function_exists( 'wc_get_page_permalink' ) && in_array( untrailingslashit( $url ), array( untrailingslashit( wc_get_page_permalink( 'myaccount' ) ), untrailingslashit( wc_get_cart_url() ) ), true ) ) { continue; }
            $id = wp_update_nav_menu_item( $menu, 0, array( 'menu-item-title' => wp_strip_all_tags( $attrs['label'] ?? '' ), 'menu-item-url' => esc_url_raw( $url ), 'menu-item-status' => 'publish', 'menu-item-type' => 'custom', 'menu-item-parent-id' => $parent, 'menu-item-target' => ! empty( $attrs['opensInNewTab'] ) ? '_blank' : '' ) );
            if ( ! is_wp_error( $id ) ) { $walk( $entry['innerBlocks'] ?? array(), $id ); }
        }
    };
    $walk( $items );
    update_option( $option, (int) $menu, false );
    if ( ! $simple ) { $locations = get_theme_mod( 'nav_menu_locations', array() ); $locations['evpower-primary'] = (int) $menu; set_theme_mod( 'nav_menu_locations', $locations ); }
    return (int) $menu;
}

/** Convert supported content into actual Elementor widgets, not one HTML embed. */
function evpower_blocks_to_elementor( $blocks, $context = '', $palette = '' ) {
    $result = array();
    foreach ( $blocks as $block ) {
        $name = $block['blockName']; $attrs = $block['attrs'] ?? array(); $classes = $attrs['className'] ?? '';
        if ( ! $name && ! trim( $block['innerHTML'] ?? '' ) ) { continue; }
        if ( 'core/pattern' === $name ) {
            $pattern = WP_Block_Patterns_Registry::get_instance()->get_registered( $attrs['slug'] ?? '' );
            if ( $pattern ) { $result = array_merge( $result, evpower_blocks_to_elementor( parse_blocks( $pattern['content'] ), $context, $palette ) ); } continue;
        }
        if ( in_array( $name, array( 'woocommerce/customer-account', 'woocommerce/mini-cart' ), true ) && 'header' === $context ) { continue; }
        if ( 'core/group' === $name && preg_match( '/\bep-brand\b/', $classes ) ) { $result[] = evpower_element( 'evpower-identity', str_contains( $classes, 'ep-brand-simple' ) ? array( 'show_mark' => 'yes', 'accent_tail' => 'power' ) : array() ); continue; }
        if ( 'core/site-title' === $name || 'core/site-logo' === $name ) {
            if ( 'core/site-title' === $name ) { $result[] = evpower_element( 'evpower-identity' ); } continue;
        }
        if ( 'core/navigation' === $name ) { $result[] = evpower_element( 'evpower-navigation', array( 'menu' => (string) evpower_elementor_menu( $block ) ) ); continue; }
        if ( 'core/paragraph' === $name && str_contains( $classes, 'ep-account-links' ) ) { $result[] = evpower_element( 'evpower-shop-actions' ); continue; }
        if ( 'core/paragraph' === $name && str_contains( $classes, 'ep-signin' ) ) { $result[] = evpower_element( 'evpower-shop-actions', array( 'account_label' => 'Sign in', 'account_icon' => 'signin', 'show_cart' => 'yes', 'cart_show_label' => '', '_css_classes' => 'ep-signin' ) ); continue; }
        $settings = $classes ? array( '_css_classes' => $classes ) : array();
        if ( ! empty( $attrs['anchor'] ) ) { $settings['_element_id'] = $attrs['anchor']; }
        if ( 'core/group' === $name || 'core/buttons' === $name || 'core/columns' === $name || 'core/column' === $name ) {
            $next_palette = str_contains( $classes, 'ep-footer-light' ) ? 'light' : ( preg_match( '/(?:^|\s)(ep-hero|ep-dark|ep-footer|ep-topbar)(?:\s|$)/', $classes ) ? 'dark' : ( str_contains( $classes, 'ep-cta' ) && ! str_contains( $classes, 'ep-cta-copy' ) && ! str_contains( $classes, 'ep-cta-inner' ) ? 'cta' : $palette ) );
            $settings += array( 'content_width' => 'full', 'flex_direction' => 'column', 'flex_gap' => array( 'column' => '0', 'row' => '0', 'unit' => 'px', 'isLinked' => true ), 'padding' => array( 'top' => '0', 'right' => '0', 'bottom' => '0', 'left' => '0', 'unit' => 'px', 'isLinked' => true ) );
            if ( ! empty( $attrs['tagName'] ) && in_array( $attrs['tagName'], array( 'section', 'article', 'main', 'aside', 'div' ), true ) ) { $settings['html_tag'] = $attrs['tagName']; }
            $grids = array( 'ep-services-grid' => 4, 'ep-three-columns' => 3, 'ep-two-columns' => 2, 'ep-footer-grid' => 4 );
            foreach ( $grids as $class => $count ) {
                if ( str_contains( $classes, $class ) ) {
                    $settings['container_type'] = 'grid';
                    $settings['grid_columns_grid'] = array( 'unit' => 'fr', 'size' => $count );
                    $settings['grid_columns_grid_tablet'] = array( 'unit' => 'fr', 'size' => min( 2, $count ) );
                    $settings['grid_columns_grid_mobile'] = array( 'unit' => 'fr', 'size' => in_array( $class, array( 'ep-services-grid', 'ep-footer-grid' ), true ) ? 2 : 1 );
                    $settings['grid_rows_grid'] = array( 'unit' => 'custom', 'size' => 'auto' );
                    $settings['grid_gaps'] = array( 'column' => '24', 'row' => '24', 'unit' => 'px' );
                }
            }
            if ( 'core/buttons' === $name || preg_match( '/\b(ep-header-inner|ep-header-actions|ep-top-inner|ep-footer-bottom|ep-cta-inner|ep-hero-bottom|ep-compatibility)\b/', $classes ) ) {
                $settings['flex_direction'] = 'row'; $settings['flex_align_items'] = 'center'; $settings['flex_justify_content'] = 'space-between';
                $settings['flex_gap'] = array( 'column' => '16', 'row' => '16', 'unit' => 'px' );
            }
            $result[] = evpower_element( 'container', $settings, evpower_blocks_to_elementor( $block['innerBlocks'], $context, $next_palette ) ); continue;
        }
        if ( 'core/heading' === $name ) {
            $tag = 'h' . ( $attrs['level'] ?? 2 ); list( $dom, $node ) = evpower_html_node( $block['innerHTML'], $tag );
            if ( 'dark' === $palette ) { $settings['title_color'] = '#ffffff'; }
            if ( 'light' === $palette ) { $settings['title_color'] = '#101e31'; }
            $result[] = evpower_element( 'heading', $settings + array( 'title' => evpower_node_html( $dom, $node ), 'header_size' => $tag ) ); continue;
        }
        if ( 'core/paragraph' === $name || 'core/list' === $name || 'core/html' === $name || null === $name ) {
            $html = serialize_block( $block ); $html = preg_replace( '/<!--.*?-->/s', '', $html );
            if ( 'core/paragraph' === $name && $classes ) {
                list( $dom, $paragraph ) = evpower_html_node( $html, 'p' );
                if ( $paragraph ) {
                    $left = array_diff( preg_split( '/\s+/', $paragraph->getAttribute( 'class' ) ), preg_split( '/\s+/', $classes ) );
                    if ( array_filter( $left ) ) { $paragraph->setAttribute( 'class', implode( ' ', $left ) ); } else { $paragraph->removeAttribute( 'class' ); }
                    $html = $dom->saveHTML( $paragraph );
                }
            }
            if ( 'dark' === $palette ) { $settings['text_color'] = str_contains( $classes, 'ep-eyebrow' ) ? '#c4f06b' : '#ffffffb3'; }
            if ( 'light' === $palette ) { $settings['text_color'] = '#526379'; }
            $result[] = evpower_element( 'text-editor', $settings + array( 'editor' => $html ) ); continue;
        }
        if ( 'core/image' === $name ) {
            list( $dom, $img ) = evpower_html_node( $block['innerHTML'], 'img' );
            $result[] = evpower_element( 'image', $settings + array( 'image' => evpower_elementor_image( $img ? $img->getAttribute( 'src' ) : '', $img ? $img->getAttribute( 'alt' ) : '', $attrs['id'] ?? 0 ), 'image_size' => 'full' ) ); continue;
        }
        if ( 'core/button' === $name ) {
            list( $dom, $link ) = evpower_html_node( $block['innerHTML'], 'a' );
            $settings += array( 'text' => $link ? $link->textContent : 'Learn more', 'link' => array( 'url' => $link ? $link->getAttribute( 'href' ) : home_url( '/' ) ), 'button_text_color' => '#10292e', 'background_color' => '#c4f06b', 'typography_typography' => 'custom', 'typography_font_size' => array( 'unit' => 'px', 'size' => 13 ), 'border_radius' => array( 'top' => '7', 'right' => '7', 'bottom' => '7', 'left' => '7', 'unit' => 'px', 'isLinked' => true ) );
            if ( 'cta' === $palette || 'header' === $context ) { $settings['background_color'] = '#10292e'; $settings['button_text_color'] = '#ffffff'; }
            if ( str_contains( $classes, 'ep-book-simple' ) ) { unset( $settings['typography_font_size'] ); $settings['background_color'] = '#a4ea20'; $settings['button_text_color'] = '#101e31'; $settings['border_radius'] = array( 'top' => '14', 'right' => '14', 'bottom' => '14', 'left' => '14', 'unit' => 'px', 'isLinked' => true ); }
            if ( str_contains( $classes, 'outline' ) ) { $settings['background_color'] = '#00000000'; $settings['button_text_color'] = 'dark' === $palette ? '#ffffff' : '#183330'; $settings['border_color'] = 'dark' === $palette ? '#ffffff88' : '#18333066'; $settings['border_border'] = 'solid'; $settings['border_width'] = array( 'top' => '1', 'right' => '1', 'bottom' => '1', 'left' => '1', 'unit' => 'px', 'isLinked' => true ); }
            $result[] = evpower_element( 'button', $settings ); continue;
        }
        if ( 'core/shortcode' === $name ) { $result[] = evpower_element( 'shortcode', array( 'shortcode' => trim( $block['innerHTML'] ) ) ); continue; }
        if ( 'core/details' === $name ) {
            list( $dom, $summary ) = evpower_html_node( $block['innerHTML'], 'summary' );
            $body = ''; foreach ( $block['innerBlocks'] as $child ) { $body .= render_block( $child ); }
            $result[] = evpower_element( 'accordion', array( 'tabs' => array( array( '_id' => wp_generate_password( 7, false ), 'tab_title' => $summary ? $summary->textContent : 'Question', 'tab_content' => $body ) ), 'title_color' => '#183330', 'content_color' => '#737e79', 'border_color' => '#dce2d7' ) ); continue;
        }
        // Preserve dynamic/plugin blocks in a dedicated widget; never discard content.
        $result[] = evpower_element( 'evpower-block', array( 'content' => serialize_block( $block ) ) );
    }
    return $result;
}

function evpower_enable_elementor_page( $id ) {
    if ( ! class_exists( '\Elementor\Plugin' ) || ! current_user_can( 'edit_post', $id ) || 'page' !== get_post_type( $id ) ) { return new WP_Error( 'elementor', 'Activate Elementor and sign in as an administrator first.' ); }
    if ( evpower_is_elementor_page( $id ) ) { return $id; }
    $post = get_post( $id );
    $backup = array( 'content' => $post->post_content, 'template' => get_post_meta( $id, '_wp_page_template', true ) );
    update_post_meta( $id, '_evpower_before_elementor', $backup );
    $previous = array();
    foreach ( array( '_elementor_edit_mode', '_elementor_data' ) as $key ) { $previous[ $key ] = metadata_exists( 'post', $id, $key ) ? get_post_meta( $id, $key, true ) : null; }
    $failure = null;
    try {
        $elements = evpower_blocks_to_elementor( parse_blocks( $post->post_content ) );
        if ( (int) get_option( 'page_on_front' ) !== (int) $id ) { array_unshift( $elements, evpower_element( 'container', array( '_css_classes' => 'ep-page-heading', 'content_width' => 'full' ), array( evpower_element( 'heading', array( 'title' => esc_html( get_the_title( $id ) ), 'header_size' => 'h1' ) ) ) ) ); }
        update_post_meta( $id, '_elementor_edit_mode', 'builder' );
        $document = \Elementor\Plugin::$instance->documents->get( $id );
        if ( ! $document || ! $document->save( array( 'elements' => $elements ) ) ) { $failure = new WP_Error( 'save', 'Elementor could not save this page. The original content was kept.' ); }
    } catch ( \Throwable $error ) { $failure = evpower_elementor_prepare_error( $error ); }
    if ( $failure ) {
        foreach ( $previous as $key => $value ) { if ( null === $value ) { delete_post_meta( $id, $key ); } else { update_post_meta( $id, $key, wp_slash( $value ) ); } }
        wp_update_post( array( 'ID' => $id, 'post_content' => wp_slash( $backup['content'] ) ) );
        update_post_meta( $id, '_wp_page_template', $backup['template'] );
        return $failure;
    }
    return $id;
}

function evpower_elementor_prepare_error( \Throwable $error ) {
    return new WP_Error( 'elementor_prepare', 'Elementor preparation stopped: ' . $error->getMessage() . ' (' . wp_basename( $error->getFile() ) . ':' . $error->getLine() . '). Copy these details when requesting support. Original WordPress blocks remain available.' );
}

function evpower_elementor_default_conditions( $id ) {
    // Native metadata uses path strings. Pro's editor handler expects its own payload.
    // Prefill only missing metadata; the owner saves/activates it through Pro's UI.
    if ( ! metadata_exists( 'post', $id, '_elementor_conditions' ) ) { update_post_meta( $id, '_elementor_conditions', array( 'include/general' ) ); }
}

function evpower_prepare_elementor() {
    if ( ! current_user_can( 'manage_options' ) || ! class_exists( '\Elementor\Plugin' ) || 'evpower' !== get_template() ) { return new WP_Error( 'elementor', 'Activate Elementor and the Evpower theme first.' ); }
    if ( ! class_exists( 'DOMDocument' ) ) { return new WP_Error( 'php_dom', 'Elementor preparation needs the PHP DOM/XML extension. Enable it in Hostinger PHP extensions, then retry. No pages were converted.' ); }
    try { return evpower_prepare_elementor_documents(); } catch ( \Throwable $error ) { return evpower_elementor_prepare_error( $error ); }
}

function evpower_prepare_elementor_documents() {
    $kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit();
    if ( $kit ) {
        $colors = $kit->get_settings( 'system_colors' );
        $defaults = array( 'primary' => '#6EC1E4', 'secondary' => '#54595F', 'text' => '#7A7A7A', 'accent' => '#61CE70' );
        $untouched = is_array( $colors ) && count( $colors ) === 4;
        foreach ( is_array( $colors ) ? $colors : array() as $color ) { if ( ! isset( $defaults[ $color['_id'] ] ) || 0 !== strcasecmp( $color['color'] ?? '', $defaults[ $color['_id'] ] ) ) { $untouched = false; } }
        $typography = $kit->get_settings( 'system_typography' );
        if ( ! is_array( $typography ) ) { $untouched = false; }
        foreach ( is_array( $typography ) ? $typography : array() as $type ) { if ( ! in_array( $type['typography_font_family'] ?? '', array( 'Roboto', 'Roboto Slab', '' ), true ) ) { $untouched = false; } }
        if ( $untouched ) {
            $kit->save( array( 'settings' => array( 'system_colors' => array(
                array( '_id' => 'primary', 'title' => 'Primary', 'color' => '#183330' ), array( '_id' => 'secondary', 'title' => 'Secondary', 'color' => '#10292e' ), array( '_id' => 'text', 'title' => 'Text', 'color' => '#737e79' ), array( '_id' => 'accent', 'title' => 'Accent', 'color' => '#c4f06b' ),
            ), 'system_typography' => array(
                array( '_id' => 'primary', 'title' => 'Primary', 'typography_typography' => 'custom', 'typography_font_family' => 'Manrope', 'typography_font_weight' => '600' ),
                array( '_id' => 'secondary', 'title' => 'Secondary', 'typography_typography' => 'custom', 'typography_font_family' => 'Manrope', 'typography_font_weight' => '500' ),
                array( '_id' => 'text', 'title' => 'Text', 'typography_typography' => 'custom', 'typography_font_family' => 'DM Sans', 'typography_font_weight' => '400' ),
                array( '_id' => 'accent', 'title' => 'Accent', 'typography_typography' => 'custom', 'typography_font_family' => 'DM Sans', 'typography_font_weight' => '600' ),
            ) ) ) );
        }
    }
    $pages = get_option( 'evpower_pages', array() );
    foreach ( array( 'home', 'services', 'locations', 'about', 'contact', 'booking', 'faq', 'privacy', 'terms' ) as $key ) {
        if ( empty( $pages[ $key ] ) || 'trash' === get_post_status( $pages[ $key ] ) ) { continue; }
        $result = evpower_enable_elementor_page( $pages[ $key ] ); if ( is_wp_error( $result ) ) { return $result; }
    }
    $layouts = get_option( 'evpower_elementor_layouts', array() );
    foreach ( array( 'header', 'footer' ) as $area ) {
        if ( ! empty( $layouts[ $area ] ) && get_post( $layouts[ $area ] ) ) {
            // Promote only our fallback section when Pro becomes available. Keep its design.
            $id = (int) $layouts[ $area ];
            if ( 'section' === get_post_meta( $id, '_elementor_template_type', true ) && \Elementor\Plugin::$instance->documents->get_document_type( $area, false ) ) {
                $conditions = metadata_exists( 'post', $id, '_elementor_conditions' ) ? get_post_meta( $id, '_elementor_conditions', true ) : null;
                $terms = wp_get_object_terms( $id, 'elementor_library_type', array( 'fields' => 'ids' ) );
                try {
                    update_post_meta( $id, '_elementor_template_type', $area );
                    $promoted = \Elementor\Plugin::$instance->documents->get( $id, false );
                    if ( ! $promoted || ! $promoted->save( array() ) ) { throw new \RuntimeException( 'Elementor Pro could not prepare the ' . $area . ' document.' ); }
                    evpower_elementor_default_conditions( $id );
                } catch ( \Throwable $error ) {
                    update_post_meta( $id, '_elementor_template_type', 'section' );
                    if ( null === $conditions ) { delete_post_meta( $id, '_elementor_conditions' ); } else { update_post_meta( $id, '_elementor_conditions', $conditions ); }
                    if ( ! is_wp_error( $terms ) ) { wp_set_object_terms( $id, $terms, 'elementor_library_type' ); }
                    return evpower_elementor_prepare_error( $error );
                }
            }
            continue;
        }
        $template = get_block_template( get_stylesheet() . '//' . $area, 'wp_template_part' );
        if ( ! $template ) { continue; }
        $type = \Elementor\Plugin::$instance->documents->get_document_type( $area, false ) ? $area : 'section';
        $document = \Elementor\Plugin::$instance->documents->create( $type, array( 'post_title' => 'Evpower ' . ucfirst( $area ), 'post_status' => 'draft' ) );
        if ( is_wp_error( $document ) ) { return $document; }
        if ( ! $document || ! $document->save( array( 'elements' => evpower_blocks_to_elementor( parse_blocks( $template->content ), $area ) ) ) ) { return new WP_Error( 'save', 'Could not prepare the Elementor ' . $area . '.' ); }
        $id = $document->get_main_id(); $layouts[ $area ] = $id;
        if ( in_array( $type, array( 'header', 'footer' ), true ) ) { evpower_elementor_default_conditions( $id ); }
        $published = wp_update_post( array( 'ID' => $id, 'post_status' => 'publish' ), true );
        if ( is_wp_error( $published ) ) { return $published; }
        update_option( 'evpower_elementor_layouts', $layouts, false );
    }
    \Elementor\Plugin::$instance->files_manager->clear_cache();
    return $layouts;
}
