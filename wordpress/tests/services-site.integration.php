<?php
/** Run only in the disposable runtime, also with --skip-plugins=woocommerce. */
if ( 'local' !== wp_get_environment_type() || 'http://localhost:8094' !== home_url() ) { throw new RuntimeException( 'Disposable local runtime required.' ); }
function ev_services_check( $condition, $message ) {
    if ( ! $condition ) { throw new RuntimeException( $message ); }
    $GLOBALS['ev_services_checks'] = ( $GLOBALS['ev_services_checks'] ?? 0 ) + 1;
    echo 'PASS: ' . $message . "\n";
}
wp_set_current_user( get_user_by( 'login', 'evpower-test-admin' )->ID );
ev_services_check( function_exists( 'evpower_services_setup' ), 'The services website module is available' );

/** Isolated API contract fixtures; never changes the assigned services documents. */
function ev_services_promotion_contract() {
    if ( ! class_exists( '\Elementor\Plugin' ) ) { return; }
    $manager = \Elementor\Plugin::$instance->documents;
    $original_types = array();
    foreach ( array( 'header', 'footer' ) as $area ) { $original_types[ $area ] = $manager->get_document_type( $area, false ); }
    if ( ! $original_types['header'] ) {
        class Evpower_Services_Test_Header extends \Elementor\Modules\Library\Documents\Section { public static function get_type() { return 'header'; } }
        $manager->register_document_type( 'header', Evpower_Services_Test_Header::class );
    }
    if ( ! $original_types['footer'] ) {
        class Evpower_Services_Test_Footer extends \Elementor\Modules\Library\Documents\Section { public static function get_type() { return 'footer'; } }
        $manager->register_document_type( 'footer', Evpower_Services_Test_Footer::class );
    }
    if ( ! class_exists( '\ElementorPro\Modules\ThemeBuilder\Module' ) ) {
        class Evpower_Services_Test_Conditions {
            public $calls = 0;
            public function save_conditions( $id, $payload ) { $this->calls++; throw new RuntimeException( 'The editor-payload conditions API must not be called.' ); }
        }
        $GLOBALS['evpower_services_test_conditions'] = new Evpower_Services_Test_Conditions();
        eval( 'namespace ElementorPro\\Modules\\ThemeBuilder; class Module { public static function instance() { return new self(); } public function get_conditions_manager() { return $GLOBALS["evpower_services_test_conditions"]; } }' );
    }
    $fixtures = array();
    try {
        foreach ( array( 'header', 'footer' ) as $area ) {
            $document = $manager->create( 'section', array( 'post_title' => 'Isolated services promotion contract ' . $area, 'post_status' => 'draft' ) );
            if ( is_wp_error( $document ) || ! $document ) { throw new RuntimeException( 'Could not create isolated promotion document.' ); }
            $id = $document->get_main_id(); $fixtures[] = $id;
            $document->save( array( 'elements' => array( evpower_element( 'heading', array( 'title' => 'OWNER_DESIGN_' . $area, 'header_size' => 'h2' ) ) ), 'settings' => array( 'background_background' => 'classic', 'background_color' => '#123456' ) ) );
            update_post_meta( $id, '_elementor_template_type', 'section' );
            wp_set_object_terms( $id, 'section', 'elementor_library_type' );
            // Private status is safe for concurrent browsers and must remain private.
            wp_update_post( array( 'ID' => $id, 'post_status' => 'header' === $area ? 'private' : 'draft' ) );
            if ( 'header' === $area ) { update_post_meta( $id, '_elementor_conditions', array( 'include/singular/page/12345', 'exclude/singular/page/67890' ) ); }
            else { delete_post_meta( $id, '_elementor_conditions' ); }
            $before = array( get_post_field( 'post_content', $id, 'raw' ), get_post_meta( $id, '_elementor_data', true ), get_post_meta( $id, '_elementor_page_settings', true ), get_post_status( $id ) );
            $conditions = get_post_meta( $id, '_elementor_conditions', true );
            $terms = wp_get_object_terms( $id, 'elementor_library_type', array( 'fields' => 'ids' ) );
            $fail = function ( $saved ) use ( $id ) { if ( (int) $saved->get_main_id() === (int) $id ) { throw new RuntimeException( 'LOCAL_SERVICES_PROMOTION_FAILURE' ); } };
            add_action( 'elementor/document/after_save', $fail, 100 );
            try { $failed = evpower_services_promote_layout( $id, $area ); }
            finally { remove_action( 'elementor/document/after_save', $fail, 100 ); }
            ev_services_check( is_wp_error( $failed ) && str_contains( $failed->get_error_message(), 'LOCAL_SERVICES_PROMOTION_FAILURE' ), 'A failed ' . $area . ' promotion returns an actionable error' );
            ev_services_check( 'section' === get_post_meta( $id, '_elementor_template_type', true ) && $terms === wp_get_object_terms( $id, 'elementor_library_type', array( 'fields' => 'ids' ) ), 'Failed ' . $area . ' promotion restores its Free document type and taxonomy' );
            ev_services_check( $before === array( get_post_field( 'post_content', $id, 'raw' ), get_post_meta( $id, '_elementor_data', true ), get_post_meta( $id, '_elementor_page_settings', true ), get_post_status( $id ) ) && $conditions === get_post_meta( $id, '_elementor_conditions', true ), 'Failed ' . $area . ' promotion preserves owner content, conditions, settings and status' );
            $promoted = evpower_services_promote_layout( $id, $area );
            ev_services_check( ! is_wp_error( $promoted ) && $area === get_post_meta( $id, '_elementor_template_type', true ), 'An existing Free ' . $area . ' upgrades to its Pro document type' );
            ev_services_check( $before === array( get_post_field( 'post_content', $id, 'raw' ), get_post_meta( $id, '_elementor_data', true ), get_post_meta( $id, '_elementor_page_settings', true ), get_post_status( $id ) ), 'Successful ' . $area . ' promotion preserves owner data and publication status' );
            ev_services_check( ( 'header' === $area ? $conditions : array( 'include/general' ) ) === get_post_meta( $id, '_elementor_conditions', true ), 'Promotion preserves existing conditions and defaults only missing ' . $area . ' conditions' );
        }
        if ( isset( $GLOBALS['evpower_services_test_conditions'] ) ) { ev_services_check( 0 === $GLOBALS['evpower_services_test_conditions']->calls, 'Promotion never calls Pro’s incompatible editor-payload conditions saver' ); }
    } finally { foreach ( $fixtures as $id ) { wp_delete_post( $id, true ); } }
    echo "Services promotion API contract fixtures completed; licensed Pro end-to-end testing is separate.\n";
}

// Focused validation leaves current browser fixtures, settings and assignments intact.
if ( defined( 'EVPOWER_SERVICES_PROMOTION_TEST_ONLY' ) && EVPOWER_SERVICES_PROMOTION_TEST_ONLY ) {
    ev_services_promotion_contract();
    echo 'Completed ' . $GLOBALS['ev_services_checks'] . " focused promotion checks.\n";
    return;
}

// Reset only this feature's generated fixtures in the disposable local database.
foreach ( array( 'evpower_services_pages', 'evpower_services_native_layouts', 'evpower_services_elementor_layouts' ) as $key ) {
    $ids = get_option( $key, array() );
    foreach ( is_array( $ids ) ? $ids : array() as $id ) { if ( get_post_meta( $id, '_evpower_services_key', true ) || get_post_meta( $id, '_evpower_services_layout', true ) ) { wp_delete_post( $id, true ); } }
    delete_option( $key );
}
$menu = absint( get_option( 'evpower_services_menu' ) ); if ( $menu && wp_get_nav_menu_object( $menu ) ) { wp_delete_nav_menu( $menu ); }
foreach ( array( 'evpower_services_menu', 'evpower_services_backups', 'evpower_services_active' ) as $key ) { delete_option( $key ); }

$legacy = get_page_by_path( 'services' );
if ( ! $legacy ) { $legacy = get_post( wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'publish', 'post_name' => 'services', 'post_title' => 'Existing owner services', 'post_content' => '<!-- wp:paragraph --><p>OWNER_CONTENT_KEEP</p><!-- /wp:paragraph -->' ) ) ); }
$legacy_content = get_post_field( 'post_content', $legacy->ID, 'raw' );
$legacy_data = get_post_meta( $legacy->ID, '_elementor_data', true );
$owner_menu = wp_create_nav_menu( 'Owner navigation fixture ' . wp_generate_password( 6, false, false ) );
wp_update_nav_menu_item( $owner_menu, 0, array( 'menu-item-title' => 'Owner custom link', 'menu-item-url' => home_url( '/owner-link/' ), 'menu-item-type' => 'custom', 'menu-item-status' => 'publish' ) );
update_option( 'evpower_elementor_menu', $owner_menu, false );
$owner_menu_before = wp_json_encode( wp_get_nav_menu_items( $owner_menu ) );
$owner_locations = get_theme_mod( 'nav_menu_locations', array() ); $owner_locations['evpower-primary'] = (int) $owner_menu; set_theme_mod( 'nav_menu_locations', $owner_locations );
$owner_layouts = array(); $owner_metadata = array();
foreach ( array( 'header', 'footer' ) as $area ) {
    $id = wp_insert_post( array( 'post_type' => 'elementor_library', 'post_status' => 'publish', 'post_title' => 'Owner ' . $area . ' fixture', 'post_content' => 'OWNER_' . $area ) );
    update_post_meta( $id, '_elementor_template_type', $area );
    update_post_meta( $id, '_elementor_conditions', array( 'include/general', 'exclude/singular/page/' . $legacy->ID ) );
    $owner_layouts[ $area ] = $id;
    $owner_metadata[ $id ] = array( get_post_field( 'post_content', $id, 'raw' ), get_post_meta( $id, '_elementor_conditions', true ) );
}
update_option( 'evpower_elementor_layouts', $owner_layouts, false );
update_option( 'evpower_header_footer_mode', 'wordpress', false );
update_option( 'page_on_front', $legacy->ID, false ); update_option( 'show_on_front', 'page', false );
$old_pages = get_option( 'evpower_pages' );
$woo_settings = array();
foreach ( array( 'woocommerce_shop_page_id', 'woocommerce_cart_page_id', 'woocommerce_checkout_page_id', 'woocommerce_myaccount_page_id', 'woocommerce_evpower_chapa_settings' ) as $key ) { $woo_settings[ $key ] = get_option( $key ); }

wp_set_current_user( 0 );
ev_services_check( is_wp_error( evpower_services_setup() ) && is_wp_error( evpower_services_activate() ) && is_wp_error( evpower_services_restore() ), 'Anonymous visitors cannot prepare, activate or restore the website' );
$die_handler = function () { return function ( $message, $title, $args ) { throw new RuntimeException( 'EXPECTED_ADMIN_DENIAL' ); }; };
add_filter( 'wp_die_handler', $die_handler );
try {
    $denied = false; try { evpower_services_handle_action(); } catch ( RuntimeException $error ) { $denied = 'EXPECTED_ADMIN_DENIAL' === $error->getMessage(); }
    ev_services_check( $denied, 'The setup endpoint checks administrator permission before performing actions' );
    wp_set_current_user( get_user_by( 'login', 'evpower-test-admin' )->ID );
    $_POST['task'] = 'setup'; $_REQUEST['_wpnonce'] = 'invalid-test-nonce';
    $denied = false; try { evpower_services_handle_action(); } catch ( RuntimeException $error ) { $denied = 'EXPECTED_ADMIN_DENIAL' === $error->getMessage(); }
    ev_services_check( $denied && ! get_option( 'evpower_services_pages' ), 'An invalid nonce cannot create pages or change the live website' );
} finally { remove_filter( 'wp_die_handler', $die_handler ); unset( $_POST['task'], $_REQUEST['_wpnonce'] ); wp_set_current_user( get_user_by( 'login', 'evpower-test-admin' )->ID ); }

$before = evpower_services_snapshot();
$pages = evpower_services_setup();
ev_services_check( ! is_wp_error( $pages ) && count( $pages ) === 10, 'One setup creates all ten service-focused editable pages' );
ev_services_check( ! function_exists( 'WC' ) || is_array( $pages ), function_exists( 'WC' ) ? 'Service setup has no required WooCommerce configuration' : 'Service setup works with WooCommerce completely absent' );
foreach ( $pages as $key => $id ) { ev_services_check( 'draft' === get_post_status( $id ), $key . ' starts as a draft for owner review' ); }
ev_services_check( (int) $pages['services'] !== (int) $legacy->ID && str_starts_with( get_post_field( 'post_name', $pages['services'] ), 'evpower-services' ), 'A conflicting existing services slug receives a new Evpower-prefixed page' );
ev_services_check( $legacy_content === get_post_field( 'post_content', $legacy->ID, 'raw' ) && $legacy_data === get_post_meta( $legacy->ID, '_elementor_data', true ), 'Existing WordPress and Elementor page content is unchanged' );
ev_services_check( (int) $legacy->ID === (int) get_option( 'page_on_front' ) && ! get_option( 'evpower_services_active' ) && $owner_layouts === get_option( 'evpower_elementor_layouts' ), 'Draft preparation leaves the live homepage and assigned layouts unchanged' );
ev_services_check( $old_pages === get_option( 'evpower_pages' ) && $owner_menu_before === wp_json_encode( wp_get_nav_menu_items( $owner_menu ) ) && $owner_locations === get_theme_mod( 'nav_menu_locations' ) && (int) $owner_menu === (int) get_option( 'evpower_elementor_menu' ), 'Legacy page mappings, menus and menu assignments are preserved' );
foreach ( $woo_settings as $key => $value ) { ev_services_check( $value === get_option( $key ), $key . ' is unchanged' ); }
$service_menu = get_option( 'evpower_services_menu' );
ev_services_check( array( 'Home', 'Services', 'About', 'Contact' ) === wp_list_pluck( wp_get_nav_menu_items( $service_menu ), 'title' ), 'Services navigation is a separate four-link owner-editable menu' );
ev_services_check( get_permalink( $pages['installation'] ) === evpower_services_page_url( 'installation' ), 'Service links use the allocated page instead of assuming a legacy slug' );
$native = get_option( 'evpower_services_native_layouts' );
foreach ( $native as $id ) { ev_services_check( 'draft' === get_post_status( $id ) && 'wp_template_part' === get_post_type( $id ), 'Native services layouts are separate draft Site Editor documents' ); }

$about_before = get_post_field( 'post_content', $pages['about'], 'raw' );
wp_update_post( array( 'ID' => $pages['about'], 'post_content' => wp_slash( $about_before . '<!-- wp:paragraph --><p>OWNER_SERVICE_BLOCK_EDIT</p><!-- /wp:paragraph -->' ) ) );
$elementor_before = ''; $home_elements = null;
if ( class_exists( '\Elementor\Plugin' ) ) {
    foreach ( $pages as $key => $id ) { ev_services_check( evpower_has_elementor_data( $id ) && get_post_meta( $id, '_evpower_before_elementor', true ), $key . ' contains native Elementor widgets and recoverable original blocks' ); }
    $home_elements = json_decode( get_post_meta( $pages['home'], '_elementor_data', true ), true );
    $kinds = array(); $images = array();
    $walk = function ( $items ) use ( &$walk, &$kinds, &$images ) { foreach ( $items as $item ) { if ( isset( $item['widgetType'] ) ) { $kinds[] = $item['widgetType']; } if ( 'image' === ( $item['widgetType'] ?? '' ) ) { $images[] = $item['settings']['image']['id'] ?? 0; } $walk( $item['elements'] ?? array() ); } };
    $walk( $home_elements );
    ev_services_check( ! array_diff( array( 'heading', 'text-editor', 'button', 'image' ), $kinds ), 'Homepage headings, copy, buttons and images are individual editable Elementor widgets' );
    ev_services_check( $images && ! in_array( 0, $images, true ), 'All bundled homepage image widgets use owner-managed Media Library attachments' );
    $changed = $home_elements;
    $edit = function ( &$items ) use ( &$edit ) { foreach ( $items as &$item ) { if ( 'heading' === ( $item['widgetType'] ?? '' ) ) { $item['settings']['title'] = 'OWNER_SERVICE_ELEMENTOR_EDIT'; return true; } if ( $edit( $item['elements'] ) ) { return true; } } return false; };
    ev_services_check( $edit( $changed ), 'A real Elementor heading can be changed through the document API' );
    \Elementor\Plugin::$instance->documents->get( $pages['home'] )->save( array( 'elements' => $changed ) );
    $elementor_before = get_post_meta( $pages['home'], '_elementor_data', true );
}
$ids = $pages; $menu_items = wp_json_encode( wp_get_nav_menu_items( $service_menu ) );
$again = evpower_services_setup();
ev_services_check( ! is_wp_error( $again ) && $ids === $again && $menu_items === wp_json_encode( wp_get_nav_menu_items( $service_menu ) ), 'Repeated setup creates no duplicate pages and keeps the services menu unchanged' );
ev_services_check( str_contains( get_post_field( 'post_content', $pages['about'], 'raw' ), 'OWNER_SERVICE_BLOCK_EDIT' ), 'Repeated setup preserves native block edits' );
if ( class_exists( '\Elementor\Plugin' ) ) { ev_services_check( $elementor_before === get_post_meta( $pages['home'], '_elementor_data', true ), 'Repeated setup preserves Elementor edits byte for byte' ); \Elementor\Plugin::$instance->documents->get( $pages['home'] )->save( array( 'elements' => $home_elements ) ); }
wp_update_post( array( 'ID' => $pages['about'], 'post_content' => wp_slash( $about_before ) ) );

$activation_before = evpower_services_snapshot(); $backups_before = get_option( 'evpower_services_backups', array() );
$fail = function () { throw new RuntimeException( 'LOCAL_SERVICES_ACTIVATION_FAILURE' ); };
add_action( 'evpower_services_activation_checkpoint', $fail );
try { $failed = evpower_services_activate(); } finally { remove_action( 'evpower_services_activation_checkpoint', $fail ); }
ev_services_check( is_wp_error( $failed ) && str_contains( $failed->get_error_message(), 'LOCAL_SERVICES_ACTIVATION_FAILURE' ), 'A late activation failure is reported without a critical error' );
ev_services_check( $activation_before === evpower_services_snapshot() && $backups_before === get_option( 'evpower_services_backups', array() ), 'Failed activation rolls back all page/layout statuses, homepage selections and backup history' );

$activated = evpower_services_activate();
ev_services_check( ! is_wp_error( $activated ) && get_option( 'evpower_services_active' ) && (int) $pages['home'] === (int) get_option( 'page_on_front' ) && 'page' === get_option( 'show_on_front' ), 'Explicit activation publishes and selects the new services homepage' );
foreach ( $pages as $key => $id ) { ev_services_check( ( 'privacy' === $key ? 'draft' : 'publish' ) === get_post_status( $id ), $key . ' has the intended publication status after activation' ); }
foreach ( $owner_layouts as $id ) { ev_services_check( $owner_metadata[ $id ] === array( get_post_field( 'post_content', $id, 'raw' ), get_post_meta( $id, '_elementor_conditions', true ) ), 'Old layout content and Pro conditions are preserved for ' . $id ); }
ev_services_check( $owner_menu_before === wp_json_encode( wp_get_nav_menu_items( $owner_menu ) ) && $owner_locations === get_theme_mod( 'nav_menu_locations' ), 'Activating does not replace the owner’s menus or menu assignments' );
update_option( 'evpower_header_footer_mode', 'wordpress', false );
$block = apply_filters( 'render_block_data', array( 'blockName' => 'core/template-part', 'attrs' => array( 'slug' => 'header' ) ), array(), null );
ev_services_check( get_post_field( 'post_name', $native['header'] ) === $block['attrs']['slug'], 'Native mode selects the separate services header without overwriting the previous template part' );
if ( class_exists( '\Elementor\Plugin' ) ) { update_option( 'evpower_header_footer_mode', 'elementor', false ); }
$home_content = get_post_field( 'post_content', $pages['home'], 'raw' );
wp_update_post( array( 'ID' => $pages['home'], 'post_content' => wp_slash( $home_content . '<!-- wp:paragraph --><p>OWNER_KEEP_AFTER_RESTORE</p><!-- /wp:paragraph -->' ) ) );
ev_services_check( ! is_wp_error( evpower_services_restore() ) && (int) $legacy->ID === (int) get_option( 'page_on_front' ) && $owner_layouts === get_option( 'evpower_elementor_layouts' ) && ! get_option( 'evpower_services_active' ), 'Restore recovers the exact previous homepage, layout IDs and active state' );
ev_services_check( 'publish' === get_post_status( $pages['home'] ) && str_contains( get_post_field( 'post_content', $pages['home'], 'raw' ), 'OWNER_KEEP_AFTER_RESTORE' ), 'Restore keeps newly published pages and the owner’s later content edits' );
foreach ( $owner_layouts as $id ) { ev_services_check( 'publish' === get_post_status( $id ), 'Restore recovers the previous Pro layout publication status' ); }
wp_update_post( array( 'ID' => $pages['home'], 'post_content' => wp_slash( $home_content ) ) );
ev_services_check( ! is_wp_error( evpower_services_activate() ), 'The owner can reactivate the services design after restoration' );
$layouts = get_option( 'evpower_services_elementor_layouts', array() );
file_put_contents( '/tmp/evpower-services-fixtures.json', wp_json_encode( array( 'pages' => $pages, 'layouts' => $layouts, 'native_layouts' => $native, 'menu' => $service_menu ) ) );
ev_services_promotion_contract();
echo 'Completed ' . $GLOBALS['ev_services_checks'] . ' services website integration checks. WooCommerce ' . ( function_exists( 'WC' ) ? 'present' : 'absent' ) . ". No live website was changed.\n";
