<?php
defined( 'ABSPATH' ) || exit;

add_action( 'admin_menu', function () { add_submenu_page( 'evpower', 'Elementor & plugins', 'Elementor & plugins', 'manage_options', 'evpower-elementor', 'evpower_elementor_admin' ); } );

function evpower_elementor_edit_url( $id ) {
    if ( class_exists( '\Elementor\Plugin' ) ) { $document = \Elementor\Plugin::$instance->documents->get( $id ); if ( $document ) { return $document->get_edit_url(); } }
    return get_edit_post_link( $id, 'raw' );
}
function evpower_elementor_action_form( $action, $label, $id = 0, $class = 'button' ) {
    echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" style="display:inline-block;margin:4px 8px 4px 0"><input type="hidden" name="action" value="evpower_elementor_action"><input type="hidden" name="task" value="' . esc_attr( $action ) . '"><input type="hidden" name="post_id" value="' . absint( $id ) . '">';
    wp_nonce_field( 'evpower_elementor_action' );
    echo '<button type="submit" class="' . esc_attr( $class ) . '">' . esc_html( $label ) . '</button></form>';
}
function evpower_elementor_admin() {
    if ( ! current_user_can( 'manage_options' ) ) { return; }
    $active = class_exists( '\Elementor\Plugin' ); $pro = function_exists( 'elementor_theme_do_location' );
    $layouts = get_option( 'evpower_elementor_layouts', array() );
    echo '<div class="wrap" style="max-width:1100px"><h1>Your Evpower website — Elementor &amp; plugins</h1>';
    echo '<p>Evpower Core ' . esc_html( EVPOWER_CORE_VERSION ) . ' · Elementor ' . esc_html( defined( 'ELEMENTOR_VERSION' ) ? ELEMENTOR_VERSION : 'inactive' ) . ' · Pro ' . esc_html( defined( 'ELEMENTOR_PRO_VERSION' ) ? ELEMENTOR_PRO_VERSION : 'inactive' ) . ' · PHP ' . esc_html( PHP_VERSION ) . '</p>';
    if ( isset( $_GET['done'] ) ) { echo '<div class="notice notice-success"><p>Settings saved. Existing Elementor designs are kept. Clear your page cache to see the latest design.</p></div>'; }
    echo '<p>Edit page content, text, images, buttons, sections, and mobile layouts with Elementor. Use the controls below for a single header and footer across the site.</p>';
    if ( ! $active ) { echo '<div class="notice notice-warning"><p>Install and activate Elementor below before preparing the editor.</p></div>'; }
    if ( ! $pro ) { echo '<div class="notice notice-info"><p>Elementor Pro is not active. You can edit Evpower pages, headers and footers with Elementor now. To use your Pro Theme Builder, upload the official Elementor Pro ZIP in Plugins → Add New → Upload Plugin, activate it, and connect your licence privately in WordPress. No additional header/footer plugin is needed.</p></div>'; }
    else { echo '<p><strong>Elementor Pro Theme Builder is available.</strong> Use Templates → Theme Builder for Header, Footer, Single, Archive and WooCommerce layouts. The theme honours the display conditions you publish there.</p>'; }
    echo '<h2>1. Prepare editing</h2><p>This converts the existing Evpower content into individual Elementor widgets and creates editable header/footer templates. Existing Elementor pages/templates are not overwritten. A copy of the original WordPress blocks is kept for restoration. Products, customers, orders, and payment settings are not changed.</p>';
    if ( $active ) { evpower_elementor_action_form( 'prepare', 'Prepare Elementor editing', 0, 'button button-primary' ); }
    echo '<p>If the starter pages are missing, first run <a href="' . esc_url( admin_url( 'admin.php?page=evpower' ) ) . '">Evpower → Setup &amp; help</a>.</p>';
    echo '<h2>2. Header, footer &amp; navigation</h2>';
    foreach ( array( 'header', 'footer' ) as $area ) {
        echo '<p><strong>' . esc_html( ucfirst( $area ) ) . ':</strong> ';
        $id = absint( $layouts[ $area ] ?? 0 );
        if ( $id && get_post( $id ) ) { echo '<a class="button" href="' . esc_url( evpower_elementor_edit_url( $id ) ) . '">Edit ' . esc_html( $area ) . ' with Elementor</a> <a href="' . esc_url( get_edit_post_link( $id ) ) . '">Template status/settings</a>'; }
        else { echo 'Prepare editing above to create this template.'; }
        echo '</p>';
    }
    echo '<p><a class="button" href="' . esc_url( admin_url( 'nav-menus.php' ) ) . '">Edit navigation links</a> — change names, destinations and order here; change their appearance in the Elementor Navigation widget.</p>';
    if ( $layouts ) {
        evpower_elementor_action_form( 'layouts-elementor', 'Use Elementor header & footer' );
        evpower_elementor_action_form( 'layouts-wordpress', 'Use WordPress header & footer' );
    }
    echo '<p>Site Identity and Account &amp; Cart widgets are under the Evpower category in Elementor. Each account/cart control includes its own icon and optional label, so you have one of each.</p><h2>3. Your pages</h2><table class="widefat striped"><thead><tr><th>Page</th><th>Editor</th><th>Actions</th></tr></thead><tbody>';
    $commerce = array_filter( array_map( 'absint', array( get_option( 'woocommerce_shop_page_id' ), get_option( 'woocommerce_cart_page_id' ), get_option( 'woocommerce_checkout_page_id' ), get_option( 'woocommerce_myaccount_page_id' ) ) ) );
    foreach ( get_posts( array( 'post_type' => 'page', 'post_status' => array( 'publish', 'draft', 'private' ), 'numberposts' => 100, 'orderby' => 'title', 'order' => 'ASC' ) ) as $page ) {
        echo '<tr><td>' . esc_html( $page->post_title ) . '</td><td>' . ( evpower_has_elementor_data( $page->ID ) ? ( $active ? 'Elementor' : 'Elementor — activate the plugin' ) : 'WordPress' ) . '</td><td>';
        if ( in_array( $page->ID, $commerce, true ) ) { echo '<a href="' . esc_url( get_edit_post_link( $page->ID ) ) . '">Edit WooCommerce page</a> — products, shipping and orders remain in WooCommerce. Use Pro Theme Builder for product/archive layouts.'; }
        elseif ( $active ) {
            if ( evpower_is_elementor_page( $page->ID ) ) { echo '<a class="button" href="' . esc_url( evpower_elementor_edit_url( $page->ID ) ) . '">Edit with Elementor</a> '; }
            else { evpower_elementor_action_form( 'page', 'Enable Elementor', $page->ID ); }
        }
        if ( ! in_array( $page->ID, $commerce, true ) && get_post_meta( $page->ID, '_evpower_before_elementor', true ) && evpower_has_elementor_data( $page->ID ) ) { evpower_elementor_action_form( 'restore', 'Restore original WordPress blocks', $page->ID ); }
        echo '</td></tr>';
    }
    echo '</tbody></table><h2>4. Focused plugin list</h2><p>Use one plugin for each job. These buttons use WordPress’s official installer; configure each service after activation.</p><table class="widefat striped"><thead><tr><th>Plugin</th><th>Purpose</th><th>Status / action</th></tr></thead><tbody>';
    $plugins = array(
        array( 'Elementor', 'Visual page editing — required for the builder.', 'elementor', 'elementor/elementor.php' ),
        array( 'WooCommerce', 'Products, inventory, cart, checkout, customers and orders.', 'woocommerce', 'woocommerce/woocommerce.php' ),
        array( 'Yoast SEO', 'Optional search previews, metadata and SEO tools. Use one SEO plugin.', 'wordpress-seo', 'wordpress-seo/wp-seo.php' ),
        array( 'WP Mail SMTP', 'Optional authenticated email delivery for enquiries and order email.', 'wp-mail-smtp', 'wp-mail-smtp/wp_mail_smtp.php' ),
        array( 'LiteSpeed Cache', 'Optional caching on compatible Hostinger/LiteSpeed hosting. Avoid a second page-cache plugin.', 'litespeed-cache', 'litespeed-cache/litespeed-cache.php' ),
    );
    foreach ( $plugins as list( $title, $purpose, $slug, $file ) ) {
        echo '<tr><td><strong>' . esc_html( $title ) . '</strong></td><td>' . esc_html( $purpose ) . '</td><td>';
        if ( is_plugin_active( $file ) ) { echo 'Active'; }
        elseif ( file_exists( WP_PLUGIN_DIR . '/' . $file ) ) { echo '<a class="button" href="' . esc_url( wp_nonce_url( admin_url( 'plugins.php?action=activate&plugin=' . rawurlencode( $file ) ), 'activate-plugin_' . $file ) ) . '">Activate</a>'; }
        elseif ( current_user_can( 'install_plugins' ) ) { echo '<a class="button" href="' . esc_url( wp_nonce_url( self_admin_url( 'update.php?action=install-plugin&plugin=' . $slug ), 'install-plugin_' . $slug ) ) . '">Install from WordPress</a>'; }
        echo '</td></tr>';
    }
    echo '</tbody></table><p>Install Elementor Pro from your own Elementor account ZIP. Licence keys, SMTP credentials and Chapa keys belong in their private WordPress settings, not page content.</p></div>';
}

add_action( 'admin_post_evpower_elementor_action', function () {
    if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Administrator access required.', '', array( 'response' => 403 ) ); }
    check_admin_referer( 'evpower_elementor_action' );
    $task = sanitize_key( wp_unslash( $_POST['task'] ?? '' ) ); $id = absint( $_POST['post_id'] ?? 0 );
    if ( 'prepare' === $task ) { $result = evpower_prepare_elementor(); if ( ! is_wp_error( $result ) ) { update_option( 'evpower_header_footer_mode', 'elementor', false ); } }
    elseif ( 'page' === $task ) { $result = evpower_enable_elementor_page( $id ); }
    elseif ( 'restore' === $task && current_user_can( 'edit_post', $id ) && 'page' === get_post_type( $id ) ) {
        $backup = get_post_meta( $id, '_evpower_before_elementor', true );
        if ( ! is_array( $backup ) || ! isset( $backup['content'] ) ) { wp_die( 'Original blocks unavailable.' ); }
        update_post_meta( $id, '_evpower_last_elementor', get_post_meta( $id, '_elementor_data', true ) );
        delete_post_meta( $id, '_elementor_edit_mode' ); delete_post_meta( $id, '_elementor_data' );
        wp_update_post( array( 'ID' => $id, 'post_content' => wp_slash( $backup['content'] ) ) );
        update_post_meta( $id, '_wp_page_template', $backup['template'] );
        if ( class_exists( '\Elementor\Plugin' ) ) { \Elementor\Plugin::$instance->files_manager->clear_cache(); }
    }
    elseif ( in_array( $task, array( 'layouts-elementor', 'layouts-wordpress' ), true ) ) { update_option( 'evpower_header_footer_mode', 'layouts-wordpress' === $task ? 'wordpress' : 'elementor', false ); }
    else { wp_die( 'Invalid editor action.', '', array( 'response' => 400 ) ); }
    if ( isset( $result ) && is_wp_error( $result ) ) { wp_die( '<p>' . esc_html( $result->get_error_message() ) . '</p><p><a href="' . esc_url( admin_url( 'admin.php?page=evpower-elementor' ) ) . '">Return to Evpower editing</a></p>', 'Evpower editor setup', array( 'response' => 400, 'back_link' => true ) ); }
    do_action( 'litespeed_purge_all' );
    wp_safe_redirect( admin_url( 'admin.php?page=evpower-elementor&done=1' ) ); exit;
} );
