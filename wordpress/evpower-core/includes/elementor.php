<?php
defined( 'ABSPATH' ) || exit;
require_once EVPOWER_CORE_PATH . 'includes/elementor-convert.php';
require_once EVPOWER_CORE_PATH . 'includes/elementor-design.php';
require_once EVPOWER_CORE_PATH . 'includes/elementor-admin.php';
require_once EVPOWER_CORE_PATH . 'includes/elementor-preview-route.php';
require_once EVPOWER_CORE_PATH . 'includes/elementor-diagnostics.php';

add_action( 'init', function () { add_post_type_support( 'page', 'elementor' ); }, 20 );
add_action( 'elementor/elements/categories_registered', function ( $manager ) {
    $manager->add_category( 'evpower', array( 'title' => 'Evpower', 'icon' => 'fa fa-bolt' ) );
} );
add_action( 'elementor/widgets/register', function ( $manager ) {
    require_once EVPOWER_CORE_PATH . 'includes/elementor-widgets.php';
    $manager->register( new Evpower_Elementor_Identity() );
    $manager->register( new Evpower_Elementor_Navigation() );
    $manager->register( new Evpower_Elementor_Shop_Actions() );
    $manager->register( new Evpower_Elementor_Block() );
} );

// Standard Elementor Pro Theme Builder locations, including WooCommerce layouts.
add_action( 'elementor/theme/register_locations', function ( $manager ) { $manager->register_all_core_location(); } );
add_action( 'elementor/page_templates/header-footer/before_content', function () { if ( 'evpower' === get_template() ) { echo '<main id="content" class="ep-main">'; } } );
add_action( 'elementor/page_templates/header-footer/after_content', function () { if ( 'evpower' === get_template() ) { echo '</main>'; } } );

/** The edited document can differ from Pro's selected preview page. */
function evpower_elementor_layout_preview_id() {
    if ( 'evpower' !== get_template() || ! class_exists( '\Elementor\Plugin' ) || ! isset( $_GET['elementor-preview'] ) || ! is_scalar( $_GET['elementor-preview'] ) ) { return 0; }
    $id = absint( wp_unslash( $_GET['elementor-preview'] ) );
    if ( ! $id || 'elementor_library' !== get_post_type( $id ) || ! \Elementor\Plugin::$instance->preview->is_preview_mode( $id ) ) { return 0; }
    $saved = get_option( 'evpower_elementor_layouts', array() );
    $layouts = is_array( $saved ) ? array_map( 'absint', $saved ) : array();
    $type = get_post_meta( $id, '_elementor_template_type', true );
    return in_array( $id, $layouts, true ) || in_array( $type, array( 'header', 'footer' ), true ) ? $id : 0;
}
function evpower_elementor_layout_preview( $template ) {
    return evpower_elementor_layout_preview_id() ? EVPOWER_CORE_PATH . 'templates/elementor-preview.php' : $template;
}
add_filter( 'template_include', 'evpower_elementor_layout_preview', 100 );

function evpower_is_elementor_page( $id = null ) {
    $id = $id ?: get_queried_object_id();
    return class_exists( '\Elementor\Plugin' ) && evpower_has_elementor_data( $id );
}
function evpower_has_elementor_data( $id ) { return 'builder' === get_post_meta( $id, '_elementor_edit_mode', true ) && (bool) json_decode( get_post_meta( $id, '_elementor_data', true ) ?: '[]', true ); }

/** Pro conditions take precedence. Assigned fallback templates also work without Pro. */
function evpower_elementor_area( $area ) {
    static $rendering = array();
    if ( 'wordpress' === get_option( 'evpower_header_footer_mode' ) ) { return null; }
    if ( ! in_array( $area, array( 'header', 'footer' ), true ) || ! class_exists( '\Elementor\Plugin' ) || isset( $rendering[ $area ] ) ) { return null; }
    if ( is_singular( 'elementor_library' ) ) { return ''; }
    $rendering[ $area ] = true;
    try {
        if ( function_exists( 'elementor_theme_do_location' ) ) {
            ob_start(); $done = elementor_theme_do_location( $area ); $html = ob_get_clean();
            if ( $done ) { return $html; }
        }
        $layouts = get_option( 'evpower_elementor_layouts', array() );
        $id = absint( $layouts[ $area ] ?? 0 );
        if ( ! $id || 'elementor_library' !== get_post_type( $id ) || 'publish' !== get_post_status( $id ) || ! evpower_is_elementor_page( $id ) ) { return null; }
        $type = get_post_meta( $id, '_elementor_template_type', true );
        // A genuine Pro template must match its conditions, even when assigned here.
        if ( function_exists( 'elementor_theme_do_location' ) && in_array( $type, array( 'header', 'footer' ), true ) ) { return null; }
        $html = \Elementor\Plugin::$instance->frontend->get_builder_content_for_display( $id );
        if ( ! $html ) { return null; }
        return in_array( $type, array( 'header', 'footer' ), true ) ? $html : '<' . $area . ' class="ep-elementor-' . $area . '">' . $html . '</' . $area . '>';
    } finally { unset( $rendering[ $area ] ); }
}

add_filter( 'render_block', function ( $html, $block ) {
    if ( 'evpower' !== get_template() ) { return $html; }
    if ( 'core/template-part' === $block['blockName'] && in_array( $block['attrs']['slug'] ?? '', array( 'header', 'footer' ), true ) ) {
        $replacement = evpower_elementor_area( $block['attrs']['slug'] );
        if ( null !== $replacement ) { return $replacement; }
    }
    if ( 'core/group' === $block['blockName'] && str_contains( $block['attrs']['className'] ?? '', 'ep-page-heading' ) && evpower_is_elementor_page() ) { return ''; }
    return $html;
}, 20, 2 );

add_action( 'wp_enqueue_scripts', function () {
    if ( ! class_exists( '\Elementor\Plugin' ) || 'evpower' !== get_template() ) { return; }
    wp_enqueue_style( 'evpower-elementor', EVPOWER_CORE_URL . 'assets/elementor.css', array(), EVPOWER_CORE_VERSION );
    foreach ( get_option( 'evpower_elementor_layouts', array() ) as $id ) {
        if ( 'publish' === get_post_status( $id ) ) { \Elementor\Core\Files\CSS\Post::create( $id )->enqueue(); }
    }
}, 20 );

// Use Pro's selected Single/Archive templates instead of rendering a second layout.
add_filter( 'template_include', function ( $template ) {
    if ( 'evpower' !== get_template() || ! function_exists( 'elementor_theme_do_location' ) || evpower_elementor_layout_preview_id() || is_singular( 'elementor_library' ) || 'elementor_canvas' === get_post_meta( get_queried_object_id(), '_wp_page_template', true ) ) { return $template; }
    $location = is_singular() ? 'single' : ( is_archive() || is_home() || is_search() ? 'archive' : '' );
    if ( ! $location ) { return $template; }
    ob_start(); $done = elementor_theme_do_location( $location ); $html = ob_get_clean();
    if ( ! $done ) { return $template; }
    $GLOBALS['evpower_pro_content'] = $html;
    return EVPOWER_CORE_PATH . 'templates/elementor-pro.php';
}, 99 );

// Both families are bundled by Evpower; do not fetch duplicate Google font files.
add_filter( 'elementor/fonts/additional_fonts', function ( $fonts ) { $fonts['DM Sans'] = 'system'; $fonts['Manrope'] = 'system'; return $fonts; } );
