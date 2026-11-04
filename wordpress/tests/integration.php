<?php
/** Run only through tests/runtime.py against the disposable local installation. */
if ( 'local' !== wp_get_environment_type() || 'http://localhost:8094' !== home_url() ) { throw new RuntimeException( 'Disposable local runtime required.' ); }
$GLOBALS['evpower_checks'] = 0;
// Reset only records created by this test in the disposable runtime.
if ( file_exists( '/tmp/evpower-wordpress-fixtures.json' ) ) {
    $previous = json_decode( file_get_contents( '/tmp/evpower-wordpress-fixtures.json' ), true );
    foreach ( $previous['station_ids'] ?? array() as $id ) { if ( 'ev_station' === get_post_type( $id ) ) { wp_delete_post( $id, true ); } }
    $previous_product = wc_get_product( $previous['product_id'] ?? 0 );
    if ( $previous_product ) { $previous_product->set_status( 'draft' ); $previous_product->set_stock_quantity( 0 ); $previous_product->save(); }
}
function ev_check( $condition, $message ) {
    if ( ! $condition ) { throw new RuntimeException( $message ); }
    $GLOBALS['evpower_checks']++; echo 'PASS: ' . $message . "\n";
}
wp_set_current_user( get_user_by( 'login', 'evpower-test-admin' )->ID );
ev_check( wp_is_block_theme(), 'Evpower is a native WordPress block theme' );
$patterns = WP_Block_Patterns_Registry::get_instance()->get_all_registered();
$ev_patterns = array_values( array_filter( $patterns, fn( $p ) => str_starts_with( $p['name'], 'evpower/' ) ) );
ev_check( count( $ev_patterns ) >= 14, 'Editable Evpower page and section patterns are registered' );
foreach ( $ev_patterns as $pattern ) { ev_check( count( parse_blocks( $pattern['content'] ) ) > 0 && ! str_contains( $pattern['content'], '<!-- wp:html' ), $pattern['name'] . ' uses editable blocks rather than an HTML embed' ); }
$pages = get_option( 'evpower_pages' );
$home = get_post( $pages['home'] );
wp_update_post( array( 'ID' => $home->ID, 'post_content' => wp_slash( $home->post_content . '<!-- wp:paragraph --><p>EDITOR_PRESERVATION_TEST</p><!-- /wp:paragraph -->' ) ) );
$count = wp_count_posts( 'page' );
$again = evpower_setup_content( array( 'sample_products' => true ) );
ev_check( ! is_wp_error( $again ) && str_contains( get_post( $home->ID )->post_content, 'EDITOR_PRESERVATION_TEST' ), 'Repeated setup preserves edited page content' );
ev_check( wp_count_posts( 'page' ) == $count, 'Repeated setup creates no duplicate pages' );
wp_update_post( array( 'ID' => $home->ID, 'post_content' => wp_slash( $home->post_content ) ) );
ev_check( 'draft' === get_post_status( $pages['privacy'] ) && 'draft' === get_post_status( $pages['terms'] ), 'Legal starter policies remain drafts for review' );
$products = wc_get_products( array( 'limit' => -1, 'status' => array( 'draft', 'publish' ) ) );
ev_check( count( $products ) === 6 && count( array_filter( $products, fn( $p ) => 'draft' === $p->get_status() && 0 === $p->get_stock_quantity() ) ) === 6, 'Sample products are drafts with zero stock' );
ev_check( empty( get_posts( array( 'post_type' => 'ev_station', 'post_status' => 'any' ) ) ), 'Setup creates no invented verified charging stations' );

$valid = array( 'form_type' => 'booking', 'full_name' => 'Test Driver', 'email' => 'driver@example.test', 'phone' => '+251911000000', 'service' => 'Mobile EV Charging', 'preferred_date' => wp_date( 'Y-m-d', time() + DAY_IN_SECONDS ), 'preferred_time' => 'Morning', 'location' => 'Addis Ababa test address', 'vehicle' => 'Test vehicle', 'message' => 'Test request', 'consent' => '1' );
ev_check( ! is_wp_error( evpower_validate_submission( $valid ) ), 'A valid future booking is accepted' );
foreach ( array( array( 'preferred_date', '2000-01-01' ), array( 'preferred_date', '2030-02-31' ), array( 'phone', 'bad' ), array( 'consent', '' ), array( 'email', array( 'bad' ) ), array( 'service', 'unsupported' ) ) as list( $key, $value ) ) {
    $invalid = $valid; $invalid[ $key ] = $value;
    ev_check( is_wp_error( evpower_validate_submission( $invalid ) ), 'Booking rejects invalid ' . $key );
}
$booking_id = evpower_save_submission( evpower_validate_submission( $valid ) );
ev_check( 'private' === get_post_status( $booking_id ) && 'Requested' === get_post_meta( $booking_id, '_ev_status', true ), 'Booking records stay private and unconfirmed' );
ev_check( ! get_post_type_object( 'ev_booking' )->show_in_rest && ! get_post_type_object( 'ev_enquiry' )->public, 'Customer details have no public post or REST endpoints' );
$customer_id = wp_insert_user( array( 'user_login' => 'test-driver-' . wp_generate_password( 8, false ), 'user_email' => 'customer-' . wp_generate_password( 8, false ) . '@example.test', 'user_pass' => wp_generate_password( 24, true ), 'role' => 'customer' ) );
wp_set_current_user( $customer_id );
ev_check( ! current_user_can( 'edit_post', $booking_id ) && ! current_user_can( 'manage_options' ), 'Customer accounts cannot administer private requests or locations' );
wp_set_current_user( get_user_by( 'login', 'evpower-test-admin' )->ID );

$station = array( 'city' => 'Addis Ababa', 'area' => 'Test area', 'latitude' => '8.989', 'longitude' => '38.790', 'power' => '22 kW', 'connectors' => 'Type 2', 'hours' => '09:00–17:00', 'status' => 'Available', 'source' => '', 'verified_date' => '', 'verified' => '1' );
ev_check( '0' === evpower_station_data( $station )['verified'], 'A verification checkbox alone cannot verify a station' );
$bad_station = $station; $bad_station['latitude'] = '999';
ev_check( is_wp_error( evpower_station_data( $bad_station ) ), 'Invalid geographic coordinates are rejected' );
$station['source'] = 'https://example.com/local-test-station'; $station['verified_date'] = wp_date( 'Y-m-d' );
ev_check( '1' === evpower_station_data( $station )['verified'], 'Verification requires complete dated evidence' );
$station_ids = array();
foreach ( array( 'Test Bole station', 'Test Adama station' ) as $index => $name ) {
    $data = $station; if ( $index ) { $data['city'] = 'Adama'; $data['latitude'] = '8.54'; $data['longitude'] = '39.27'; $data['verified'] = '0'; }
    $id = wp_insert_post( array( 'post_type' => 'ev_station', 'post_status' => 'publish', 'post_title' => $name ) );
    foreach ( evpower_station_data( $data ) as $key => $value ) { update_post_meta( $id, '_ev_' . $key, $value ); }
    $station_ids[] = $id;
}

update_option( 'woocommerce_currency', 'ETB' );
update_option( 'woocommerce_coming_soon', 'no' );
update_option( 'woocommerce_store_pages_only', 'no' );
update_option( 'woocommerce_enable_guest_checkout', 'yes' );
update_option( 'woocommerce_enable_myaccount_registration', 'yes' );
update_option( 'woocommerce_registration_generate_password', 'no' );
update_option( 'woocommerce_default_country', 'ET' );
update_option( 'woocommerce_chapa_settings', array() );
$gateway = new Evpower_Chapa_Gateway();
ev_check( ! $gateway->is_available(), 'Chapa stays unavailable when no merchant secret is configured' );
update_option( 'woocommerce_evpower_chapa_settings', array( 'enabled' => 'yes', 'secret_key' => 'local-test-placeholder-not-a-merchant-key' ) );
$gateway = new Evpower_Chapa_Gateway();
ev_check( $gateway->is_available(), 'Configured ETB gateway can be exercised with a mocked provider' );
$product = $products[0]; $product->set_status( 'publish' ); $product->set_stock_quantity( 10 ); $product->set_regular_price( '100' ); $product->set_price( '100' ); $product->set_virtual( true ); $product->save();
$order = wc_create_order(); $order->add_product( $product, 2 ); $order->set_currency( 'ETB' ); $order->set_billing_first_name( 'Test' ); $order->set_billing_last_name( 'Driver' ); $order->set_billing_email( 'guest@example.test' ); $order->set_payment_method( $gateway ); $order->calculate_totals(); $order->save();
$http_calls = 0;
$GLOBALS['evpower_test_http'] = function ( $pre, $args, $url ) use ( &$http_calls, $order ) {
    $http_calls++; $body = json_decode( $args['body'], true );
    ev_check( '200.00' === $body['amount'] && 'ETB' === $body['currency'], 'Chapa initialization uses WooCommerce order totals' );
    return array( 'headers' => array(), 'body' => wp_json_encode( array( 'status' => 'success', 'data' => array( 'checkout_url' => 'https://checkout.chapa.co/checkout/local-test' ) ) ), 'response' => array( 'code' => 200, 'message' => 'OK' ), 'cookies' => array() );
};
$result = $gateway->process_payment( $order->get_id() );
ev_check( 'success' === $result['result'] && 1 === $http_calls, 'Checkout redirects only to the supported Chapa host' );
$result = $gateway->process_payment( $order->get_id() );
ev_check( 'success' === $result['result'] && 1 === $http_calls, 'Retrying checkout reuses the pending attempt instead of creating duplicate payments' );
$order = wc_get_order( $order->get_id() ); $reference = $order->get_meta( '_ev_chapa_ref' );
foreach ( array( array( 'status' => 'pending' ), array( 'amount' => '1' ), array( 'currency' => 'USD' ), array( 'tx_ref' => 'wrong-reference' ) ) as $patch ) {
    $data = array_merge( array( 'status' => 'success', 'amount' => '200.00', 'currency' => 'ETB', 'tx_ref' => $reference ), $patch );
    $GLOBALS['evpower_test_http'] = fn() => array( 'headers' => array(), 'body' => wp_json_encode( array( 'status' => 'success', 'data' => $data ) ), 'response' => array( 'code' => 200, 'message' => 'OK' ), 'cookies' => array() );
    ev_check( ! $gateway->verify_reference( $reference ) && ! wc_get_order( $order->get_id() )->is_paid(), 'Verification rejects mismatched ' . array_key_first( $patch ) );
}
$GLOBALS['evpower_test_http'] = fn() => array( 'headers' => array(), 'body' => wp_json_encode( array( 'status' => 'success', 'data' => array( 'status' => 'success', 'amount' => '200.00', 'currency' => 'ETB', 'tx_ref' => $reference, 'reference' => 'local-provider-reference' ) ) ), 'response' => array( 'code' => 200, 'message' => 'OK' ), 'cookies' => array() );
ev_check( $gateway->verify_reference( $reference ) && wc_get_order( $order->get_id() )->is_paid(), 'Only independently verified reference, currency and amount complete payment' );
$stock = wc_get_product( $product->get_id() )->get_stock_quantity();
ev_check( $gateway->verify_reference( $reference ) && $stock === wc_get_product( $product->get_id() )->get_stock_quantity(), 'Repeated callbacks do not reduce inventory twice' );
unset( $GLOBALS['evpower_test_http'] ); update_option( 'woocommerce_evpower_chapa_settings', array( 'enabled' => 'no', 'secret_key' => '' ) );

$fixtures = array( 'pages' => $pages, 'patterns' => array_map( fn( $p ) => array( 'name' => $p['name'], 'content' => $p['content'] ), $ev_patterns ), 'product_id' => $product->get_id(), 'product_url' => get_permalink( $product->get_id() ), 'guest_order_id' => $order->get_id(), 'guest_order_key' => $order->get_order_key(), 'station_ids' => $station_ids );
file_put_contents( '/tmp/evpower-wordpress-fixtures.json', wp_json_encode( $fixtures ) );
echo 'Completed ' . $GLOBALS['evpower_checks'] . " WordPress integration checks. Provider requests were mocked; no real payment or email was sent.\n";
