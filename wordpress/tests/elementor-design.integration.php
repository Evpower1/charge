<?php
if ( 'local' !== wp_get_environment_type() || 'http://localhost:8094' !== home_url() ) { throw new RuntimeException( 'Disposable local runtime required.' ); }
function ev_design_check( $condition, $message ) {
    if ( ! $condition ) { throw new RuntimeException( $message ); }
    echo 'PASS: ' . $message . "\n";
}
wp_set_current_user( get_user_by( 'login', 'evpower-test-admin' )->ID );
$layouts = get_option( 'evpower_elementor_layouts' );
$before = evpower_elementor_design_snapshot( $layouts );
$history = get_option( 'evpower_elementor_design_backups', array() );
$pages_before = array();
foreach ( get_option( 'evpower_pages' ) as $id ) { $pages_before[ $id ] = array( get_post_field( 'post_content', $id, 'raw' ), get_post_meta( $id, '_elementor_data', true ) ); }
$metadata = array();
foreach ( $layouts as $id ) { $metadata[ $id ] = array( get_post_status( $id ), get_post_meta( $id, '_elementor_template_type', true ), get_post_meta( $id, '_elementor_conditions', true ) ); }
$old_menu = absint( get_option( 'evpower_elementor_menu' ) );
$old_menu_items = $old_menu ? wp_json_encode( wp_get_nav_menu_items( $old_menu ) ) : '';
$locations = get_theme_mod( 'nav_menu_locations' );
try {
    $title = render_block( array( 'blockName' => 'core/site-title', 'attrs' => array( 'className' => 'ep-wordmark-simple', 'level' => 2, 'isLink' => false, 'style' => array( 'typography' => array( 'fontSize' => '28px' ) ) ), 'innerBlocks' => array(), 'innerHTML' => '', 'innerContent' => array() ) );
    ev_design_check( str_contains( $title, '<h2' ) && str_contains( $title, 'font-size:' ) && str_contains( $title, '28px' ) && ! str_contains( $title, '<a ' ) && str_contains( $title, 'ep-brand-mark' ), 'The block wordmark preserves native heading, typography and link choices' );
    wp_set_current_user( 0 );
    ev_design_check( is_wp_error( evpower_elementor_apply_simple_design() ), 'Anonymous visitors cannot replace header/footer designs' );
    wp_set_current_user( get_user_by( 'login', 'evpower-test-admin' )->ID );
    $fail = function ( $document ) use ( $layouts ) { if ( (int) $document->get_main_id() === (int) $layouts['footer'] ) { throw new RuntimeException( 'LOCAL_DESIGN_SAVE_FAILURE' ); } };
    add_action( 'elementor/document/after_save', $fail );
    try { $result = evpower_elementor_apply_simple_design(); }
    finally { remove_action( 'elementor/document/after_save', $fail ); }
    ev_design_check( is_wp_error( $result ) && str_contains( $result->get_error_message(), 'LOCAL_DESIGN_SAVE_FAILURE' ), 'A late Elementor save exception is reported without a critical error' );
    ev_design_check( $before === evpower_elementor_design_snapshot( $layouts ), 'A partial update rolls back both layouts and their previous rendering mode' );
    ev_design_check( $history === get_option( 'evpower_elementor_design_backups', array() ), 'Failed replacement keeps the previous backup history' );

    $result = evpower_elementor_apply_simple_design();
    ev_design_check( ! is_wp_error( $result ), 'The owner can explicitly apply the simple header and light footer' );
    ev_design_check( $layouts === get_option( 'evpower_elementor_layouts' ), 'Existing template IDs and editor links remain assigned' );
    foreach ( $layouts as $id ) { ev_design_check( $metadata[ $id ] === array( get_post_status( $id ), get_post_meta( $id, '_elementor_template_type', true ), get_post_meta( $id, '_elementor_conditions', true ) ), 'Template type, status and Pro conditions are preserved for ' . $id ); }
    $header = evpower_elementor_area( 'header' ); $footer = evpower_elementor_area( 'footer' );
    ev_design_check( str_contains( $header, 'ep-header-simple' ) && 1 === substr_count( $header, 'aria-label="Sign in"' ) && 1 === substr_count( $header, 'aria-label="Cart"' ), 'Simple header renders exactly one sign-in and one Cart control' );
    ev_design_check( str_contains( $header, 'Book a charge' ) && str_contains( $header, 'ep-brand-mark' ), 'The booking action and lightning wordmark render from editable widgets' );
    $menu = absint( get_option( 'evpower_elementor_simple_menu' ) );
    ev_design_check( array( 'Services', 'Shop', 'Find stations' ) === wp_list_pluck( wp_get_nav_menu_items( $menu ), 'title' ), 'The dedicated simple menu contains exactly the three real destinations' );
    ev_design_check( $old_menu_items === ( $old_menu ? wp_json_encode( wp_get_nav_menu_items( $old_menu ) ) : '' ) && $locations === get_theme_mod( 'nav_menu_locations' ), 'Existing owner menus and theme menu assignments are preserved' );
    ev_design_check( str_contains( $footer, 'ep-footer-light' ) && str_contains( $footer, 'mailto:info@evpower.et' ) && str_contains( $footer, 'tel:+251911049916' ) && str_contains( $footer, 'https://wa.me/251911049916' ), 'The light footer retains Evpower’s real contact methods' );
    ev_design_check( str_contains( $footer, wc_get_cart_url() ) && str_contains( $footer, wc_get_page_permalink( 'myaccount' ) ), 'Cart and account remain accessible in the footer' );
    foreach ( $pages_before as $id => $data ) { ev_design_check( $data === array( get_post_field( 'post_content', $id, 'raw' ), get_post_meta( $id, '_elementor_data', true ) ), 'Page ' . $id . ' is unchanged by the layout replacement' ); }
    $applied = evpower_elementor_design_snapshot( $layouts );
    evpower_prepare_elementor();
    ev_design_check( $applied === evpower_elementor_design_snapshot( $layouts ), 'Ordinary preparation preserves the applied layout instead of overwriting it' );
    ev_design_check( ! is_wp_error( evpower_elementor_apply_simple_design( true ) ) && $before === evpower_elementor_design_snapshot( $layouts ), 'Restore recovers the previous two layouts and rendering mode exactly' );
} finally {
    wp_set_current_user( get_user_by( 'login', 'evpower-test-admin' )->ID );
    evpower_elementor_restore_design_snapshot( $before );
    update_option( 'evpower_elementor_design_backups', $history, false );
}
echo "Layout replacement, rollback, contact, menu and restoration checks passed.\n";
