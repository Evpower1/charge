<?php
/**
 * Plugin Name: Evpower Emblem Preloader
 * Description: A lightweight page preloader using the approved Evpower charging emblem.
 * Version: 1.0.0
 * Requires at least: 6.3
 * Requires PHP: 7.4
 * Author: Evpower
 * License: GPL-2.0-or-later
 * Text Domain: evpower-emblem-preloader
 */

defined( 'ABSPATH' ) || exit;

function evp_loader_options() {
    $saved = get_option( 'evp_loader_options', array() );
    return wp_parse_args( is_array( $saved ) ? $saved : array(), array(
        'enabled'      => true,
        'session_only' => true,
        'caption'      => 'Powering your journey',
    ) );
}

/** Decorative loading never covers editors, previews or customer transactions. */
function evp_loader_should_show() {
    $options = evp_loader_options();
    if ( empty( $options['enabled'] ) || is_admin() || wp_doing_ajax() || is_feed() || is_embed() || is_preview() || is_customize_preview() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
        return false;
    }
    foreach ( array( 'preview', 'elementor-preview', 'evpower-layout-preview', 'wp_customize', 'customize_changeset_uuid' ) as $key ) {
        if ( isset( $_GET[ $key ] ) ) { return false; }
    }
    if ( is_singular( 'elementor_library' ) ) { return false; }
    if ( isset( $_GET['action'] ) && is_string( $_GET['action'] ) && 'elementor' === wp_unslash( $_GET['action'] ) ) { return false; }
    if ( class_exists( '\Elementor\Plugin' ) ) {
        try {
            $elementor = \Elementor\Plugin::$instance;
            if ( $elementor && ( $elementor->editor->is_edit_mode() || $elementor->preview->is_preview_mode() ) ) { return false; }
        } catch ( \Throwable $error ) {
            // A partially initialized editor must not be obstructed by a preloader.
            return false;
        }
    }
    foreach ( array( 'is_cart', 'is_checkout', 'is_account_page' ) as $callback ) {
        if ( function_exists( $callback ) && $callback() ) { return false; }
    }
    return true;
}

add_action( 'wp_enqueue_scripts', function () {
    if ( ! evp_loader_should_show() ) { return; }
    $base = plugin_dir_url( __FILE__ );
    $options = evp_loader_options();
    wp_enqueue_style( 'evpower-emblem-preloader', $base . 'assets/preloader.css', array(), '1.0.0' );
    // The early script decides whether to show the overlay before body rendering.
    wp_enqueue_script( 'evpower-emblem-preloader', $base . 'assets/preloader.js', array(), '1.0.0', false );
    wp_add_inline_script( 'evpower-emblem-preloader', 'window.evpPreloaderConfig = ' . wp_json_encode( array(
        'sessionOnly' => ! empty( $options['session_only'] ),
        'maxWait'     => 6000,
    ) ) . ';', 'before' );
}, 20 );

function evp_loader_render() {
    static $rendered = false;
    if ( $rendered || ! evp_loader_should_show() ) { return; }
    $rendered = true;
    $options = evp_loader_options();
    ?>
    <div id="evp-preloader" class="evp-preloader" data-evp-preloader role="status" aria-label="<?php echo esc_attr__( 'Loading Evpower', 'evpower-emblem-preloader' ); ?>" aria-live="polite">
        <div class="evp-preloader__inner">
            <div class="evp-preloader__emblem">
                <img class="evp-preloader__image" src="<?php echo esc_url( plugin_dir_url( __FILE__ ) . 'assets/emblem.png' ); ?>" alt="" width="1254" height="1254" loading="eager" decoding="async" fetchpriority="high">
                <svg class="evp-preloader__pulse" viewBox="0 0 1254 1254" aria-hidden="true" focusable="false">
                    <path d="M 340 710 H 560 Q 595 710 610 680 L 687 535 L 724 784 L 780 670 Q 793 646 820 646 H 943"/>
                </svg>
            </div>
            <div class="evp-preloader__track" aria-hidden="true"><span></span></div>
            <?php if ( '' !== trim( $options['caption'] ) ) : ?>
                <p class="evp-preloader__caption"><?php echo esc_html( $options['caption'] ); ?></p>
            <?php endif; ?>
        </div>
        <button type="button" class="evp-preloader__skip" data-evp-skip>Skip animation</button>
    </div>
    <?php
}
add_action( 'wp_body_open', 'evp_loader_render', 5 );
add_action( 'wp_footer', 'evp_loader_render', 5 );

add_action( 'admin_init', function () {
    register_setting( 'evp_loader_settings', 'evp_loader_options', array(
        'type'              => 'array',
        'show_in_rest'      => false,
        'sanitize_callback' => function ( $input ) {
            $input = is_array( $input ) ? $input : array();
            return array(
                'enabled'      => ! empty( $input['enabled'] ),
                'session_only' => ! empty( $input['session_only'] ),
                'caption'      => wp_html_excerpt( sanitize_text_field( is_scalar( $input['caption'] ?? null ) ? $input['caption'] : '' ), 80, '' ),
            );
        },
    ) );
} );

add_action( 'admin_menu', function () {
    add_theme_page( 'Evpower Preloader', 'Evpower Preloader', 'manage_options', 'evpower-emblem-preloader', 'evp_loader_settings_page' );
} );

function evp_loader_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) { return; }
    $options = evp_loader_options();
    ?>
    <div class="wrap" style="max-width:850px">
        <h1>Evpower Preloader</h1>
        <p>Show the Evpower charging emblem while a page loads. The animation dismisses when the page is ready, with a six-second fallback.</p>
        <form method="post" action="options.php">
            <?php settings_fields( 'evp_loader_settings' ); ?>
            <table class="form-table" role="presentation">
                <tr><th scope="row">Preloader</th><td><label><input type="checkbox" name="evp_loader_options[enabled]" value="1" <?php checked( ! empty( $options['enabled'] ) ); ?>> Enable the Evpower emblem preloader</label></td></tr>
                <tr><th scope="row">Frequency</th><td><label><input type="checkbox" name="evp_loader_options[session_only]" value="1" <?php checked( ! empty( $options['session_only'] ) ); ?>> Show once per browser tab session</label><p class="description">Recommended. Uncheck to show it on each eligible page load.</p></td></tr>
                <tr><th scope="row"><label for="evp-loader-caption">Loading caption</label></th><td><input id="evp-loader-caption" class="regular-text" type="text" name="evp_loader_options[caption]" maxlength="80" value="<?php echo esc_attr( $options['caption'] ); ?>"><p class="description">Leave blank to show only the emblem and charging animation.</p></td></tr>
            </table>
            <?php submit_button(); ?>
        </form>
        <p>For Evolta, turn off the theme’s own preloader in its Theme Options before enabling this one. Clear your page cache after changing the settings.</p>
        <p>WordPress and Elementor editing, previews, Cart, Checkout and My Account are excluded. Visitors can skip the animation or press Escape. Visitors who request reduced motion receive the still emblem without looping movement.</p>
    </div>
    <?php
}
