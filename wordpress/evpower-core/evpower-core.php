<?php
/**
 * Plugin Name: Evpower Core
 * Description: Evpower starter pages, charging locations, private booking requests and enquiries, and an optional Chapa gateway for WooCommerce.
 * Version: 1.0.0
 * Update URI: https://github.com/Evpower1/charge/tree/main/wordpress/evpower-core
 * Requires at least: 6.7
 * Requires PHP: 8.1
 * Author: Evpower
 * License: GPL-2.0-or-later
 * Text Domain: evpower-core
 */
defined( 'ABSPATH' ) || exit;

define( 'EVPOWER_CORE_VERSION', '1.0.0' );
define( 'EVPOWER_CORE_PATH', plugin_dir_path( __FILE__ ) );
define( 'EVPOWER_CORE_URL', plugin_dir_url( __FILE__ ) );
require_once EVPOWER_CORE_PATH . 'includes/admin.php';
require_once EVPOWER_CORE_PATH . 'includes/forms.php';
require_once EVPOWER_CORE_PATH . 'includes/locations.php';
require_once EVPOWER_CORE_PATH . 'includes/commerce.php';

function evpower_private_caps( $create = false ) {
    $caps = array_fill_keys( array( 'edit_post', 'read_post', 'delete_post', 'edit_posts', 'edit_others_posts', 'publish_posts', 'read_private_posts', 'delete_posts', 'delete_private_posts', 'delete_published_posts', 'delete_others_posts', 'edit_private_posts', 'edit_published_posts' ), 'manage_options' );
    $caps['create_posts'] = $create ? 'manage_options' : 'do_not_allow';
    return $caps;
}

function evpower_register_records() {
    register_post_type( 'ev_station', array(
        'labels' => array( 'name' => 'Charging locations', 'singular_name' => 'Charging location', 'add_new_item' => 'Add charging location' ),
        'public' => false, 'show_ui' => true, 'show_in_menu' => 'evpower', 'show_in_rest' => true,
        'supports' => array( 'title', 'editor', 'revisions' ), 'capabilities' => evpower_private_caps( true ), 'map_meta_cap' => false,
    ) );
    foreach ( array( 'ev_booking' => array( 'Charging requests', 'Charging request' ), 'ev_enquiry' => array( 'Enquiries', 'Enquiry' ) ) as $type => $labels ) {
        register_post_type( $type, array(
            'labels' => array( 'name' => $labels[0], 'singular_name' => $labels[1] ),
            'public' => false, 'show_ui' => true, 'show_in_menu' => 'evpower', 'show_in_rest' => false,
            'supports' => array( 'title' ), 'capabilities' => evpower_private_caps(), 'map_meta_cap' => false,
        ) );
    }
    add_rewrite_endpoint( 'charging-requests', EP_ROOT | EP_PAGES );
}
add_action( 'init', 'evpower_register_records' );
register_activation_hook( __FILE__, function () { evpower_register_records(); flush_rewrite_rules(); } );
register_deactivation_hook( __FILE__, 'flush_rewrite_rules' );

function evpower_assets() {
    wp_enqueue_style( 'evpower-core', EVPOWER_CORE_URL . 'assets/core.css', array(), EVPOWER_CORE_VERSION );
}

function evpower_page_url( $key ) {
    $pages = get_option( 'evpower_pages', array() );
    if ( ! empty( $pages[ $key ] ) && 'publish' === get_post_status( $pages[ $key ] ) ) {
        return get_permalink( $pages[ $key ] );
    }
    return home_url( '/' . ( 'booking' === $key ? 'book-charging' : $key ) . '/' );
}

add_action( 'wp_head', function () {
    if ( is_singular() && apply_filters( 'evpower_output_meta_description', true ) && ! defined( 'WPSEO_VERSION' ) && ! defined( 'RANK_MATH_VERSION' ) && ! defined( 'AIOSEO_VERSION' ) ) {
        $description = get_post_meta( get_queried_object_id(), '_evpower_description', true );
        if ( $description ) {
            echo '<meta name="description" content="' . esc_attr( $description ) . '" />' . "\n";
        }
    }
}, 1 );

// Register with WooCommerce's supported order storage API; no direct order SQL.
add_action( 'before_woocommerce_init', function () {
    if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', __FILE__, false );
    }
} );
