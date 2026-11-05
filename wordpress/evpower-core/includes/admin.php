<?php
defined( 'ABSPATH' ) || exit;

add_action( 'admin_menu', function () {
    add_menu_page( 'Evpower', 'Evpower', 'manage_options', 'evpower', 'evpower_admin_page', 'dashicons-superhero-alt', 26 );
    add_submenu_page( 'evpower', 'Setup & help', 'Setup & help', 'manage_options', 'evpower', 'evpower_admin_page' );
} );

add_action( 'admin_init', function () {
    register_setting( 'evpower', 'evpower_notification_email', array( 'type' => 'string', 'sanitize_callback' => 'sanitize_email', 'default' => 'info@evpower.et' ) );
} );

function evpower_admin_page() {
    if ( ! current_user_can( 'manage_options' ) ) { return; }
    $ready = function_exists( 'WC' );
    ?>
    <div class="wrap" style="max-width:1000px">
        <h1>Evpower — your WordPress website</h1>
        <p><strong>For Elementor editing:</strong> open <a href="<?php echo esc_url( admin_url( 'admin.php?page=evpower-elementor' ) ); ?>">Evpower → Elementor &amp; plugins</a> to prepare pages, edit the header/footer, and install the focused plugin set.</p>
        <p>Edit pages in <a href="<?php echo esc_url( admin_url( 'edit.php?post_type=page' ) ); ?>">Pages</a>. Edit the header, footer, navigation, templates, logo, colours, and fonts in <a href="<?php echo esc_url( admin_url( 'site-editor.php' ) ); ?>">Appearance → Editor</a>.</p>
        <?php if ( isset( $_GET['evpower_created'] ) ) : ?><div class="notice notice-success"><p>Starter content prepared. Existing pages and products were kept. Review the setup checks below, delivery rates, legal policies, and product details before launch.</p></div><?php endif; ?>
        <?php if ( ! $ready ) : ?><div class="notice notice-warning"><p>Install and activate WooCommerce before creating starter content. The Evpower theme uses WooCommerce for products, inventory, cart, checkout, customer accounts, and orders.</p></div><?php endif; ?>
        <?php if ( 'evpower' !== get_stylesheet() ) : ?><div class="notice notice-warning"><p>Activate the Evpower theme in Appearance → Themes to use its editable starter pages and Site Editor.</p></div><?php endif; ?>
        <h2>1. Prepare starter pages</h2>
        <p><strong>Seeing “Welcome to WordPress” or broken menu links?</strong> Select the homepage and Post name URL options below, then create missing starter content. A theme supplies the design; this step creates the pages and selects what the homepage displays.</p>
        <p>This creates missing Evpower pages only. It never replaces an existing page’s content, imports your old app’s customer data, or deletes orders. Privacy and terms pages start as drafts for your review. Sample products are optional and always drafts.</p>
        <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
            <input type="hidden" name="action" value="evpower_setup">
            <?php wp_nonce_field( 'evpower_setup' ); ?>
            <p><label><input type="checkbox" name="homepage" value="1"> Set the Evpower Home page as this WordPress site’s homepage.</label></p>
            <p><label><input type="checkbox" name="permalinks" value="1"> Use Post name URLs, such as /services/ (recommended for a new website). This changes the site-wide permalink setting; leave unchecked to preserve an existing custom URL structure.</label></p>
            <p><label><input type="checkbox" name="identity" value="1"> Set the site title to Evpower and the tagline to “Powering journeys. Moving Ethiopia forward.”</label></p>
            <p><label><input type="checkbox" name="sample_products" value="1"> Import six sample products as drafts for review. No station is marked verified or created automatically.</label></p>
            <p><label><input type="checkbox" name="classic_checkout" value="1"> Use the classic WooCommerce Cart and Checkout for the included Chapa gateway. This replaces those two pages’ content; review or back them up first. Other pages are preserved.</label></p>
            <?php submit_button( 'Create missing starter content', 'primary', 'submit', true, ( ! $ready || 'evpower' !== get_stylesheet() ) ? array( 'disabled' => 'disabled' ) : array() ); ?>
        </form>
        <h3>Setup checks</h3>
        <ul>
            <li>Homepage: <?php if ( 'page' === get_option( 'show_on_front' ) && 'publish' === get_post_status( (int) get_option( 'page_on_front' ) ) ) : ?>a published static page is selected.<?php else : ?>still showing latest posts. Select the homepage option above, or choose Home in <a href="<?php echo esc_url( admin_url( 'options-reading.php' ) ); ?>">Settings → Reading</a>.<?php endif; ?></li>
            <li>Menu URLs: <?php if ( get_option( 'permalink_structure' ) ) : ?>a named URL structure is configured.<?php else : ?>WordPress is using Plain URLs. Select the Post name option above, or save Post name in <a href="<?php echo esc_url( admin_url( 'options-permalink.php' ) ); ?>">Settings → Permalinks</a>.<?php endif; ?></li>
        </ul>
        <h2>2. Configure the shop</h2>
        <p>In WooCommerce → Settings, set your business details, Ethiopian birr (ETB), delivery zones and rates, taxes, guest checkout, and account registration. Use the classic Cart and Checkout pages created by this setup for the included Chapa gateway.</p>
        <p>Chapa is disabled until you configure a merchant key in WooCommerce → Settings → Payments → Chapa. You can also define <code>EVPOWER_CHAPA_SECRET_KEY</code> in a private wp-config.php instead of saving the key in WordPress. Never share the key in chat.</p>
        <p>Installation requests are quoted separately and shown on orders. They do not silently add an installation fee to the checkout total.</p>
        <h2>3. Manage charging and enquiries</h2>
        <p>Use Evpower → Charging locations to add real station information. Verification requires a source URL, verification date, hours, power, and connectors. Booking and contact submissions are private records under Evpower. Only administrators can manage these records.</p>
        <form method="post" action="options.php">
            <?php settings_fields( 'evpower' ); ?>
            <label for="evpower-email"><strong>Notification email</strong></label><br>
            <input id="evpower-email" name="evpower_notification_email" type="email" class="regular-text" value="<?php echo esc_attr( get_option( 'evpower_notification_email', 'info@evpower.et' ) ); ?>">
            <p>Submissions are saved even if email delivery is unavailable. Configure your Hostinger email/SMTP service to receive notifications.</p>
            <?php submit_button( 'Save notification email' ); ?>
        </form>
        <h2>Editing guide</h2>
        <ol><li>Open Pages, choose a page, and click a heading, paragraph, image, or button to edit it.</li><li>Use the block inserter (+), List View, and drag controls to add, move, or remove sections. Evpower patterns are available in the inserter.</li><li>Use Appearance → Editor → Styles for colours and typography; edit the Header and Footer template parts there.</li><li>Use WordPress Preview, Save draft, Update/Publish, and Revisions to review and restore edits.</li><li>Manage products and photos under Products. Customers use My Account for addresses, order history, and charging requests.</li></ol>
    </div>
    <?php
}

function evpower_setup_content( $options = array() ) {
    if ( ! current_user_can( 'manage_options' ) ) { return new WP_Error( 'forbidden', 'Administrator access required.' ); }
    if ( ! function_exists( 'WC' ) || 'evpower' !== get_stylesheet() ) { return new WP_Error( 'dependencies', 'Activate WooCommerce and the Evpower theme first.' ); }
    if ( ! empty( $options['permalinks'] ) ) {
        global $wp_rewrite;
        $wp_rewrite->set_permalink_structure( '/%postname%/' );
    }
    $pages = get_option( 'evpower_pages', array() );
    $definitions = array(
        'home' => array( 'Home', 'home', 'page-home', 'publish', 'Evpower charging, chargers, and EV care in Ethiopia.' ),
        'services' => array( 'Our Services', 'services', 'page-services', 'publish', 'Mobile EV charging, fleet solutions, charger installation, and EV care.' ),
        'locations' => array( 'Charging Locations', 'locations', 'page-locations', 'publish', 'Explore charging information in Addis Ababa and Adama.' ),
        'about' => array( 'About Us', 'about', 'page-about', 'publish', 'Meet Evpower, your local partner for cleaner electric journeys.' ),
        'contact' => array( 'Contact Us', 'contact', 'page-contact', 'publish', 'Contact Evpower on 8890, +251911049916, or info@evpower.et.' ),
        'booking' => array( 'Book Charging', 'book-charging', 'page-booking', 'publish', 'Request EV charging or a service consultation with Evpower.' ),
        'faq' => array( 'Frequently Asked Questions', 'faq', 'page-faq', 'publish', 'Answers about EV charging, compatibility, installation, and payments.' ),
        'privacy' => array( 'Privacy Policy — review draft', 'privacy', 'page-privacy', 'draft', '' ),
        'terms' => array( 'Terms & Conditions — review draft', 'terms', 'page-terms', 'draft', '' ),
    );
    foreach ( $definitions as $key => list( $title, $slug, $pattern, $status, $description ) ) {
        if ( ! empty( $pages[ $key ] ) && get_post( $pages[ $key ] ) ) { continue; }
        $existing = get_page_by_path( $slug );
        if ( $existing ) { $pages[ $key ] = $existing->ID; continue; }
        $registered = WP_Block_Patterns_Registry::get_instance()->get_registered( 'evpower/' . $pattern );
        if ( ! $registered ) { return new WP_Error( 'pattern', 'Evpower page patterns are not available. Please reload the setup screen.' ); }
        $id = wp_insert_post( array( 'post_type' => 'page', 'post_title' => $title, 'post_name' => $slug, 'post_content' => wp_slash( $registered['content'] ), 'post_status' => $status ), true );
        if ( is_wp_error( $id ) ) { return $id; }
        $pages[ $key ] = $id;
        if ( $description ) { update_post_meta( $id, '_evpower_description', $description ); }
    }
    foreach ( array( 'shop' => array( 'Shop', '[products paginate="true" columns="3" limit="9"]' ), 'cart' => array( 'Cart', '[woocommerce_cart]' ), 'checkout' => array( 'Checkout', '[woocommerce_checkout]' ), 'account' => array( 'My Account', '[woocommerce_my_account]' ) ) as $key => list( $title, $shortcode ) ) {
        $wc_option = 'woocommerce_' . ( 'account' === $key ? 'myaccount' : $key ) . '_page_id';
        $wc_page = (int) get_option( $wc_option );
        if ( $wc_page > 0 && get_post( $wc_page ) ) { $pages[ $key ] = $wc_page; continue; }
        $existing = get_page_by_path( $key );
        $id = $existing ? $existing->ID : wp_insert_post( array( 'post_type' => 'page', 'post_title' => $title, 'post_name' => $key, 'post_content' => '<!-- wp:shortcode -->' . $shortcode . '<!-- /wp:shortcode -->', 'post_status' => 'publish' ), true );
        if ( is_wp_error( $id ) ) { return $id; }
        $pages[ $key ] = $id;
        update_option( $wc_option, $id );
    }
    update_option( 'evpower_pages', $pages, false );
    if ( ! empty( $options['classic_checkout'] ) ) {
        foreach ( array( 'cart' => '[woocommerce_cart]', 'checkout' => '[woocommerce_checkout]' ) as $key => $shortcode ) {
            wp_update_post( array( 'ID' => $pages[ $key ], 'post_content' => '<!-- wp:shortcode -->' . $shortcode . '<!-- /wp:shortcode -->' ) );
        }
    }
    if ( ! empty( $options['homepage'] ) ) { update_option( 'show_on_front', 'page' ); update_option( 'page_on_front', $pages['home'] ); }
    if ( ! empty( $options['identity'] ) ) { update_option( 'blogname', 'Evpower' ); update_option( 'blogdescription', 'Powering journeys. Moving Ethiopia forward.' ); }
    if ( ! empty( $options['sample_products'] ) ) { evpower_sample_products(); }
    flush_rewrite_rules();
    return $pages;
}

add_action( 'admin_post_evpower_setup', function () {
    if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Administrator access required.', '', array( 'response' => 403 ) ); }
    check_admin_referer( 'evpower_setup' );
    $result = evpower_setup_content( array( 'homepage' => ! empty( $_POST['homepage'] ), 'permalinks' => ! empty( $_POST['permalinks'] ), 'identity' => ! empty( $_POST['identity'] ), 'sample_products' => ! empty( $_POST['sample_products'] ), 'classic_checkout' => ! empty( $_POST['classic_checkout'] ) ) );
    if ( is_wp_error( $result ) ) { wp_die( esc_html( $result->get_error_message() ) ); }
    wp_safe_redirect( admin_url( 'admin.php?page=evpower&evpower_created=1' ) ); exit;
} );

function evpower_sample_products() {
    $rows = array(
        array( 'home-7', 'HomeCharge 7.4 kW', 'Home chargers', 42500, '7.4 kW', 'Type 2' ),
        array( 'home-22', 'HomeCharge Pro 22 kW', 'Home chargers', 68500, '22 kW', 'Type 2' ),
        array( 'portable', 'GoCharge Portable', 'Portable chargers', 18500, '3.7 kW', 'Type 2' ),
        array( 'cable', 'Type 2 Charging Cable', 'Accessories', 8500, '22 kW', 'Type 2' ),
        array( 'business-44', 'BusinessCharge Duo', 'Business chargers', 145000, '2 × 22 kW', 'Type 2' ),
        array( 'adapter', 'GB/T Charging Adapter', 'Accessories', 12500, '7.4 kW AC', 'GB/T' ),
    );
    foreach ( $rows as list( $sku, $name, $category, $price, $power, $connector ) ) {
        if ( wc_get_product_id_by_sku( 'evpower-' . $sku ) ) { continue; }
        $term = term_exists( $category, 'product_cat' );
        if ( ! $term ) { $term = wp_insert_term( $category, 'product_cat' ); }
        $product = new WC_Product_Simple();
        $product->set_name( $name ); $product->set_sku( 'evpower-' . $sku ); $product->set_status( 'draft' );
        $product->set_regular_price( $price ); $product->set_featured( true ); $product->set_manage_stock( true ); $product->set_stock_quantity( 0 );
        $product->set_description( 'Sample product for review. Replace this description, confirm compatibility, price, warranty, delivery, tax, and stock before publishing. Installation is quoted separately.' );
        if ( ! is_wp_error( $term ) ) { $product->set_category_ids( array( (int) $term['term_id'] ) ); }
        $attributes = array();
        foreach ( array( 'Power' => $power, 'Connector' => $connector ) as $label => $value ) {
            $attribute = new WC_Product_Attribute(); $attribute->set_name( $label ); $attribute->set_options( array( $value ) ); $attribute->set_visible( true ); $attributes[] = $attribute;
        }
        $product->set_attributes( $attributes ); $product->save();
    }
}

add_action( 'add_meta_boxes', function () {
    add_meta_box( 'evpower-description', 'Search description', function ( $post ) {
        wp_nonce_field( 'evpower_description', 'evpower_description_nonce' );
        echo '<p>Optional description for search engines. Titles are edited with the page title.</p><textarea name="evpower_description" rows="3" maxlength="400" style="width:100%">' . esc_textarea( get_post_meta( $post->ID, '_evpower_description', true ) ) . '</textarea>';
    }, 'page', 'side' );
} );
add_action( 'save_post_page', function ( $id ) {
    if ( wp_is_post_revision( $id ) || ! current_user_can( 'edit_post', $id ) || empty( $_POST['evpower_description_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['evpower_description_nonce'] ) ), 'evpower_description' ) ) { return; }
    update_post_meta( $id, '_evpower_description', mb_substr( sanitize_textarea_field( wp_unslash( $_POST['evpower_description'] ?? '' ) ), 0, 400 ) );
} );
