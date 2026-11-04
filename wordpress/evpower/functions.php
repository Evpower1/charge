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
    wp_enqueue_style( 'evpower', get_theme_file_uri( 'assets/theme.css' ), array(), '1.0.0' );
} );

add_action( 'init', function () {
    register_block_pattern_category( 'evpower', array( 'label' => __( 'Evpower pages & sections', 'evpower' ) ) );
} );

/** Pattern URLs work on subdirectory installs and staging sites. */
function evpower_url( $path = '/' ) {
    $commerce = array( '/shop/' => 'shop', '/account/' => 'myaccount', '/cart/' => 'cart', '/checkout/' => 'checkout' );
    if ( isset( $commerce[ $path ] ) && function_exists( 'wc_get_page_id' ) && wc_get_page_id( $commerce[ $path ] ) > 0 ) {
        return esc_url( get_permalink( wc_get_page_id( $commerce[ $path ] ) ) );
    }
    return esc_url( home_url( $path ) );
}
