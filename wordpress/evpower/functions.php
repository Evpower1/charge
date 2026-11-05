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
    load_theme_textdomain( 'evpower', get_template_directory() . '/languages' );
} );

add_action( 'wp_enqueue_scripts', function () {
    wp_enqueue_style( 'evpower', get_theme_file_uri( 'assets/theme.css' ), array(), '1.1.0' );
} );

// Keep setup guidance in the dashboard; visitors never see installation notices.
add_action( 'admin_notices', function () {
    if ( ! current_user_can( 'manage_options' ) || 'evpower' !== get_stylesheet() || 'evpower' === ( $_GET['page'] ?? '' ) ) { return; }
    $installed = function_exists( 'evpower_setup_content' );
    $pages = get_option( 'evpower_pages', array() );
    $homepage = 'page' === get_option( 'show_on_front' ) && 'publish' === get_post_status( (int) get_option( 'page_on_front' ) );
    $missing = false;
    foreach ( array( 'home', 'services', 'locations', 'about', 'contact', 'booking' ) as $key ) {
        if ( empty( $pages[ $key ] ) || 'publish' !== get_post_status( $pages[ $key ] ) ) { $missing = true; break; }
    }
    if ( $installed && $homepage && ! $missing && get_option( 'permalink_structure' ) ) { return; }
    echo '<div class="notice notice-warning"><h2>Finish setting up your Evpower website</h2>';
    if ( ! $installed ) {
        echo '<p>The theme is active. Install and activate Evpower Core to create the homepage and service pages. Activate WooCommerce for the shop.</p><p><a class="button button-primary" href="https://github.com/Evpower1/charge/raw/refs/heads/main/wordpress/packages/evpower-core.zip">Download Evpower Core</a> <a class="button" href="' . esc_url( admin_url( 'plugin-install.php?tab=upload' ) ) . '">Upload plugin</a></p>';
    } else {
        echo '<p>Open Setup &amp; help, select the homepage and Post name URL options, then create missing starter content. This replaces the default-post homepage with the Evpower page and prepares its menu links.</p><p><a class="button button-primary" href="' . esc_url( admin_url( 'admin.php?page=evpower' ) ) . '">Finish Evpower setup</a></p>';
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
