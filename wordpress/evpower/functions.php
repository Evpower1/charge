<?php
/** Evpower block theme. */
defined( 'ABSPATH' ) || exit;

add_action( 'after_setup_theme', function () {
    add_theme_support( 'woocommerce' );
    add_theme_support( 'wc-product-gallery-zoom' );
    add_theme_support( 'wc-product-gallery-lightbox' );
    add_theme_support( 'wc-product-gallery-slider' );
    add_theme_support( 'editor-styles' );
    add_editor_style( 'assets/theme.css' );
    add_editor_style( 'assets/simple-layout.css' );
    add_editor_style( 'assets/services.css' );
    load_theme_textdomain( 'evpower', get_template_directory() . '/languages' );
} );

add_action( 'wp_enqueue_scripts', function () {
    wp_enqueue_style( 'evpower', get_theme_file_uri( 'assets/theme.css' ), array(), '1.3.0' );
} );

// Load the layout defaults after Elementor's defaults; individual editor controls win.
add_action( 'wp_enqueue_scripts', function () {
    $dependencies = array( 'evpower' );
    if ( wp_style_is( 'evpower-elementor', 'enqueued' ) ) { $dependencies[] = 'evpower-elementor'; }
    wp_enqueue_style( 'evpower-simple-layout', get_theme_file_uri( 'assets/simple-layout.css' ), $dependencies, '1.3.0' );
}, 30 );

function evpower_simple_wordmark( $title, $accent = 'power', $mark = true ) {
    $html = $mark ? '<span class="ep-brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M13.3 2.8a1.5 1.5 0 0 0-2.5-.4L4.4 10a1.5 1.5 0 0 0 1.1 2.5h4l-1.3 6.7a1.5 1.5 0 0 0 2.5 1.4l8.9-9a1.5 1.5 0 0 0-1.1-2.6h-5.8l.6-6.2Z"/></svg></span>' : '';
    $text = esc_html( $title );
    if ( $accent && strlen( $title ) > strlen( $accent ) && str_ends_with( strtolower( $title ), strtolower( $accent ) ) ) {
        $text = esc_html( substr( $title, 0, -strlen( $accent ) ) ) . '<span class="ep-brand-accent">' . esc_html( substr( $title, -strlen( $accent ) ) ) . '</span>';
    }
    return $html . '<span class="ep-brand-name">' . $text . '</span>';
}

add_filter( 'render_block_core/site-title', function ( $html, $block ) {
    if ( ! str_contains( $block['attrs']['className'] ?? '', 'ep-wordmark-simple' ) ) { return $html; }
    $wordmark = evpower_simple_wordmark( get_bloginfo( 'name' ) );
    // Keep native heading level, link choices and the owner's block styles/attributes.
    $pattern = str_contains( $html, '<a ' ) ? '/(<a\b[^>]*>).*?(<\/a>)/s' : '/(^<[^>]+>).*?(<\/[^>]+>$)/s';
    return preg_replace_callback( $pattern, function ( $match ) use ( $wordmark ) { return $match[1] . $wordmark . $match[2]; }, $html, 1 );
}, 10, 2 );

// Keep setup guidance in the dashboard; visitors never see installation notices.
add_action( 'admin_notices', function () {
    if ( ! current_user_can( 'manage_options' ) || 'evpower' !== get_stylesheet() || 'evpower' === ( $_GET['page'] ?? '' ) ) { return; }
    if ( get_option( 'evpower_services_active' ) || 'evpower-services' === ( $_GET['page'] ?? '' ) ) { return; }
    $installed = function_exists( 'evpower_services_setup' );
    $pages = get_option( 'evpower_pages', array() );
    $homepage = 'page' === get_option( 'show_on_front' ) && 'publish' === get_post_status( (int) get_option( 'page_on_front' ) );
    $missing = false;
    foreach ( array( 'home', 'services', 'locations', 'about', 'contact', 'booking' ) as $key ) {
        if ( empty( $pages[ $key ] ) || 'publish' !== get_post_status( $pages[ $key ] ) ) { $missing = true; break; }
    }
    if ( $installed && $homepage && ! $missing && get_option( 'permalink_structure' ) ) { return; }
    echo '<div class="notice notice-warning"><h2>Finish setting up your Evpower website</h2>';
    if ( ! $installed ) {
        echo '<p>The theme is active. Install or update Evpower Core to version 1.3.0 to prepare the editable service pages. WooCommerce is optional for online sales.</p><p><a class="button button-primary" href="https://github.com/Evpower1/charge/raw/refs/heads/evpower-services-website/wordpress/packages/evpower-core.zip?download=1">Download Evpower Core</a> <a class="button" href="' . esc_url( admin_url( 'plugin-install.php?tab=upload' ) ) . '">Upload plugin</a></p>';
    } else {
        echo '<p>Open Services website to prepare editable pages for mobile charging, charger supply, installation and maintenance. Existing page edits are preserved.</p><p><a class="button button-primary" href="' . esc_url( admin_url( 'admin.php?page=evpower-services' ) ) . '">Prepare services website</a></p>';
    }
    echo '</div>';
} );

add_action( 'init', function () {
    register_block_pattern_category( 'evpower', array( 'label' => __( 'Evpower pages & sections', 'evpower' ) ) );
    register_nav_menus( array( 'evpower-primary' => __( 'Evpower main navigation', 'evpower' ) ) );
} );

// Evpower already provides account/cart controls. Do not auto-insert a second pair.
add_filter( 'hooked_block_types', function ( $types, $position, $anchor, $context ) {
    if ( 'core/navigation' !== $anchor || 'after' !== $position ) { return $types; }
    $header = $context instanceof WP_Block_Template && 'evpower' === $context->theme && 'header' === $context->area;
    $pattern = is_array( $context ) && 'evpower/header' === ( $context['name'] ?? $context['slug'] ?? '' );
    if ( $header || $pattern ) { $types = array_values( array_diff( $types, array( 'woocommerce/customer-account', 'woocommerce/mini-cart' ) ) ); }
    return $types;
}, 20, 4 );

/** Pattern URLs work on subdirectory installs and staging sites. */
function evpower_url( $path = '/' ) {
    $commerce = array( '/shop/' => 'shop', '/account/' => 'myaccount', '/cart/' => 'cart', '/checkout/' => 'checkout' );
    if ( isset( $commerce[ $path ] ) && function_exists( 'wc_get_page_id' ) && wc_get_page_id( $commerce[ $path ] ) > 0 ) {
        return esc_url( get_permalink( wc_get_page_id( $commerce[ $path ] ) ) );
    }
    return esc_url( home_url( $path ) );
}

/** Scoped shared defaults; Elementor's individual controls retain priority. */
add_action( 'wp_enqueue_scripts', function () {
    $id = get_queried_object_id();
    $services = get_option( 'evpower_services_active' ) || get_post_meta( $id, '_evpower_services_key', true ) || get_post_meta( $id, '_evpower_services_layout', true );
    if ( ! $services && isset( $_GET['elementor-preview'] ) && is_scalar( $_GET['elementor-preview'] ) ) {
        $preview = absint( $_GET['elementor-preview'] );
        $services = get_post_meta( $preview, '_evpower_services_key', true ) || get_post_meta( $preview, '_evpower_services_layout', true );
    }
    if ( $services ) { wp_enqueue_style( 'evpower-services', get_theme_file_uri( 'assets/services.css' ), array( 'evpower-simple-layout' ), '1.3.0' ); }
}, 40 );

// Every services pattern already owns its H1, including the native block fallback.
add_filter( 'render_block', function ( $html, $block ) {
    if ( 'core/group' === ( $block['blockName'] ?? '' ) && str_contains( $block['attrs']['className'] ?? '', 'ep-page-heading' ) && get_post_meta( get_queried_object_id(), '_evpower_services_key', true ) ) { return ''; }
    return $html;
}, 21, 2 );
