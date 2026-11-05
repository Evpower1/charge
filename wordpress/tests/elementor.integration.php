<?php
if ( 'local' !== wp_get_environment_type() || 'http://localhost:8094' !== home_url() ) { throw new RuntimeException( 'Disposable local runtime required.' ); }
if ( ! class_exists( '\Elementor\Plugin' ) ) { throw new RuntimeException( 'Elementor must be active.' ); }
$checks = 0;
function ev_builder_check( $condition, $message ) { if ( ! $condition ) { throw new RuntimeException( $message ); } $GLOBALS['ev_builder_checks'] = ( $GLOBALS['ev_builder_checks'] ?? 0 ) + 1; echo 'PASS: ' . $message . "\n"; }
wp_set_current_user( get_user_by( 'login', 'evpower-test-admin' )->ID );
update_option( 'woocommerce_hooked_blocks_version', '11.2.1' );
$result = evpower_prepare_elementor();
ev_builder_check( ! is_wp_error( $result ), 'Existing content converts successfully into Elementor documents' );
$image = evpower_elementor_image( get_theme_file_uri( 'assets/images/charging.webp' ), 'Editable Evpower photo' );
ev_builder_check( $image['id'] > 0 && 'attachment' === get_post_type( $image['id'] ), 'Bundled theme photos become owner-managed Media Library attachments' );
$again = evpower_elementor_image( get_theme_file_uri( 'assets/images/charging.webp' ), 'Do not overwrite an existing alt description' );
ev_builder_check( $again['id'] === $image['id'], 'Repeated conversion reuses the image instead of duplicating media' );
update_option( 'evpower_header_footer_mode', 'elementor' );
$pages = get_option( 'evpower_pages' );
$layouts = get_option( 'evpower_elementor_layouts' );
foreach ( array( 'home', 'services', 'locations', 'about', 'contact', 'booking', 'faq' ) as $key ) {
    ev_builder_check( evpower_is_elementor_page( $pages[ $key ] ) && is_array( get_post_meta( $pages[ $key ], '_evpower_before_elementor', true ) ), $key . ' has editable Elementor data and preserved WordPress blocks' );
}
$widgets = \Elementor\Plugin::$instance->widgets_manager->get_widget_types();
foreach ( array( 'evpower-identity', 'evpower-navigation', 'evpower-shop-actions', 'evpower-block' ) as $name ) { ev_builder_check( isset( $widgets[ $name ] ), $name . ' is a registered native Elementor widget' ); }

update_option( 'evpower_header_footer_mode', 'wordpress' );
$header = do_blocks( '<!-- wp:template-part {"slug":"header","tagName":"header"} /-->' );
ev_builder_check( ! str_contains( $header, 'wp-block-woocommerce-customer-account' ) && ! str_contains( $header, 'wp-block-woocommerce-mini-cart' ), 'WooCommerce automatic header insertion does not add a second Account or Cart' );
update_option( 'evpower_header_footer_mode', 'elementor' );
$header = evpower_elementor_area( 'header' );
ev_builder_check( 1 === substr_count( $header, 'aria-label="Account"' ) && 1 === substr_count( $header, 'aria-label="Cart"' ), 'Elementor header contains exactly one Account and one Cart control' );
ev_builder_check( str_contains( evpower_elementor_area( 'footer' ), 'info@evpower.et' ), 'Footer renders the editable Elementor template' );

$home_id = $pages['home'];
$document = \Elementor\Plugin::$instance->documents->get( $home_id );
$elements = json_decode( get_post_meta( $home_id, '_elementor_data', true ), true );
$before = $elements;
$edit = function ( &$items ) use ( &$edit ) {
    foreach ( $items as &$item ) { if ( 'heading' === ( $item['widgetType'] ?? '' ) && 'h1' === ( $item['settings']['header_size'] ?? '' ) ) { $item['settings']['title'] = 'ELEMENTOR_OWNER_EDIT_PRESERVED'; return true; } if ( $edit( $item['elements'] ) ) { return true; } } return false;
};
ev_builder_check( $edit( $elements ), 'Homepage contains a real editable heading widget' );
$document->save( array( 'elements' => $elements ) );
$saved = get_post_meta( $home_id, '_elementor_data', true );
evpower_prepare_elementor();
ev_builder_check( $saved === get_post_meta( $home_id, '_elementor_data', true ), 'Repeated preparation preserves the owner’s Elementor edits' );
$document->save( array( 'elements' => $before ) );

$original = get_post( $layouts['header'] );
wp_update_post( array( 'ID' => $original->ID, 'post_status' => 'draft' ) );
ev_builder_check( null === evpower_elementor_area( 'header' ), 'Unpublished header templates fall back to the WordPress header' );
wp_update_post( array( 'ID' => $original->ID, 'post_status' => 'publish' ) );
$layout_ids = get_option( 'evpower_elementor_layouts' );
wp_set_current_user( 0 );
ev_builder_check( is_wp_error( evpower_prepare_elementor() ) && $layout_ids === get_option( 'evpower_elementor_layouts' ), 'Anonymous users cannot convert pages or replace site layouts' );
wp_set_current_user( get_user_by( 'login', 'evpower-test-admin' )->ID );

$original_query = $GLOBALS['wp_query'];
$original_preview = $_GET['elementor-preview'] ?? null;
try {
    $GLOBALS['wp_query'] = new WP_Query( array( 'post_type' => 'elementor_library', 'p' => $layouts['header'] ) );
    $_GET['elementor-preview'] = (string) $layouts['header'];
    ev_builder_check( EVPOWER_CORE_PATH . 'templates/elementor-preview.php' === evpower_elementor_layout_preview( 'original-template.php' ), 'Authenticated layout editing uses the dedicated the_content preview' );
    wp_set_current_user( 0 );
    ev_builder_check( 'original-template.php' === evpower_elementor_layout_preview( 'original-template.php' ), 'Anonymous layout requests keep the normal site template' );
    wp_set_current_user( get_user_by( 'login', 'evpower-test-admin' )->ID );
    $_GET['elementor-preview'] = (string) $layouts['footer'];
    ev_builder_check( 'original-template.php' === evpower_elementor_layout_preview( 'original-template.php' ), 'A mismatched preview ID cannot replace the queried template' );
    unset( $_GET['elementor-preview'] );
    ev_builder_check( 'original-template.php' === evpower_elementor_layout_preview( 'original-template.php' ), 'Normal library views keep the original site template' );
    $GLOBALS['wp_query'] = new WP_Query( array( 'page_id' => $home_id ) );
    $_GET['elementor-preview'] = (string) $home_id;
    ev_builder_check( 'original-template.php' === evpower_elementor_layout_preview( 'original-template.php' ), 'Ordinary Elementor page editing keeps its selected layout' );
} finally {
    $GLOBALS['wp_query'] = $original_query;
    if ( null === $original_preview ) { unset( $_GET['elementor-preview'] ); } else { $_GET['elementor-preview'] = $original_preview; }
    wp_set_current_user( get_user_by( 'login', 'evpower-test-admin' )->ID );
}

// API contract only: Pro is a licensed upload, not bundled in this repository.
if ( ! function_exists( 'elementor_theme_do_location' ) ) {
    function elementor_theme_do_location( $area ) { if ( ( $GLOBALS['evpower_test_pro_area'] ?? '' ) === $area ) { echo '<header>PRO_LOCATION_TEST</header>'; return true; } return false; }
    $GLOBALS['evpower_test_pro_area'] = 'header';
    ev_builder_check( '<header>PRO_LOCATION_TEST</header>' === evpower_elementor_area( 'header' ), 'A matching Pro Theme Builder location takes precedence over the fallback header' );
    unset( $GLOBALS['evpower_test_pro_area'] );
    $original_type = get_post_meta( $layouts['header'], '_elementor_template_type', true );
    try {
        update_post_meta( $layouts['header'], '_elementor_template_type', 'header' );
        ev_builder_check( null === evpower_elementor_area( 'header' ), 'A Pro header excluded by its display conditions falls back to WordPress instead of bypassing those conditions' );
    } finally { update_post_meta( $layouts['header'], '_elementor_template_type', $original_type ); }
    update_option( 'evpower_header_footer_mode', 'wordpress' );
    ev_builder_check( null === evpower_elementor_area( 'header' ), 'The owner can explicitly switch back to WordPress layouts' );
    update_option( 'evpower_header_footer_mode', 'elementor' ); unset( $GLOBALS['evpower_test_pro_area'] );
}
file_put_contents( '/tmp/evpower-elementor-fixtures.json', wp_json_encode( array( 'pages' => $pages, 'layouts' => $layouts, 'header_editor' => evpower_elementor_edit_url( $layouts['header'] ), 'footer_editor' => evpower_elementor_edit_url( $layouts['footer'] ) ) ) );
echo 'Completed ' . $GLOBALS['ev_builder_checks'] . " Elementor integration checks. Pro location behaviour was contract-tested, not tested with a licensed Pro ZIP.\n";
