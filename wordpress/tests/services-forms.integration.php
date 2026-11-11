<?php
/** Run only in the disposable tests/runtime.py installation. No outbound mail. */
if ( 'local' !== wp_get_environment_type() || 'http://localhost:8094' !== home_url() ) { throw new RuntimeException( 'Disposable local runtime required.' ); }
if ( ! function_exists( 'evpower_services_request_receive' ) ) { throw new RuntimeException( 'Service request module must be loaded.' ); }

$GLOBALS['evpower_service_form_checks'] = 0;
function ev_service_form_check( $condition, $message ) {
    if ( ! $condition ) { throw new RuntimeException( $message ); }
    $GLOBALS['evpower_service_form_checks']++;
    echo 'PASS: ' . $message . "\n";
}

$original_user = get_current_user_id();
$original_get = $_GET;
$original_email = get_option( 'evpower_notification_email', null );
$record_ids = array();
$subscriber = 0;
$mail_calls = array();
$mail_fixture = function ( $pre, $attributes ) use ( &$mail_calls ) {
    $mail_calls[] = $attributes;
    return true;
};
add_filter( 'pre_wp_mail', $mail_fixture, PHP_INT_MAX, 2 );
$address = '192.0.2.230';
$rate_key = 'evpower_services_form_' . hash_hmac( 'sha256', $address, wp_salt( 'auth' ) );
delete_transient( $rate_key );

try {
    wp_set_current_user( 0 );
    $_GET = array();
    $valid = array( 'full_name' => 'Disposable Driver', 'email' => 'driver@example.test', 'phone' => '+251 911 000 000', 'service' => 'mobile', 'location' => 'Addis Ababa / test area', 'preferred_date' => '', 'message' => 'Please contact me about a charger.', 'consent' => '1', 'company_website' => '' );
    foreach ( array( 'mobile', 'supply', 'installation', 'maintenance' ) as $service ) {
        $candidate = $valid; $candidate['service'] = $service;
        $data = evpower_services_request_validate( $candidate );
        ev_service_form_check( ! is_wp_error( $data ) && $service === $data['service_id'], $service . ' accepts a request without forcing an appointment date' );
    }
    $date = new DateTimeImmutable( 'today', wp_timezone() );
    $dated = $valid; $dated['preferred_date'] = $date->modify( '+180 days' )->format( 'Y-m-d' );
    ev_service_form_check( ! is_wp_error( evpower_services_request_validate( $dated ) ), 'A preferred date inside the six-month window is accepted' );
    $invalid_values = array(
        array( 'service', 'Mobile EV Charging' ), array( 'service', 'fleet' ),
        array( 'service', 'MOBILE' ), array( 'service', array( 'mobile' ) ),
        array( 'email', 'not-an-email' ), array( 'email', 'driver<@example.test' ),
        array( 'phone', 'just text' ), array( 'phone', '(((((((((' ),
        array( 'phone', '+251123456789012345' ), array( 'phone', '+251;mail()' ),
        array( 'full_name', '' ), array( 'location', '' ), array( 'message', '' ),
        array( 'message', str_repeat( 'a', 4001 ) ), array( 'consent', '' ),
        array( 'preferred_date', '2028-02-31' ), array( 'preferred_date', $date->modify( '-1 day' )->format( 'Y-m-d' ) ),
        array( 'preferred_date', $date->modify( '+181 days' )->format( 'Y-m-d' ) ),
    );
    foreach ( $invalid_values as list( $key, $value ) ) {
        $candidate = $valid; $candidate[ $key ] = $value;
        ev_service_form_check( is_wp_error( evpower_services_request_validate( $candidate ) ), 'Invalid ' . $key . ' is rejected before storage' );
    }
    $candidate = $valid;
    $candidate['full_name'] = '<b>Local Driver</b>';
    $candidate['message'] = '<script>alert(1)</script>Clean details';
    $candidate['service_label'] = 'Attacker-provided service label';
    $clean = evpower_services_request_validate( $candidate );
    ev_service_form_check( 'Local Driver' === $clean['name'] && ! str_contains( $clean['message'], '<' ) && 'Mobile EV Charging' === $clean['service'], 'Names/messages are sanitized and service labels come from the server allowlist' );

    $form = evpower_services_request_form( array( 'service' => 'installation', 'name_label' => 'Your name', 'button_text' => 'Ask for a quote', 'heading' => '<script>alert(1)</script>Request support' ) );
    ev_service_form_check( str_contains( $form, 'name="evpower_service_nonce"' ) && str_contains( $form, 'value="evpower_service_request_submit"' ), 'The public form includes the protected WordPress submission action' );
    ev_service_form_check( preg_match( '/<option\s+value="installation"\s+selected=/', $form ) && str_contains( $form, 'Your name' ) && str_contains( $form, 'Ask for a quote' ) && ! str_contains( $form, '<script>' ), 'Service and editable text settings render safely' );
    preg_match( '/<input[^>]*name="preferred_date"[^>]*>/', $form, $date_input );
    ev_service_form_check( ! empty( $date_input ) && ! str_contains( $date_input[0], 'required' ), 'A date remains optional in the browser form' );
    $other_form = evpower_services_request_form();
    preg_match( '/id="([^"]+)-name"/', $form, $first_id );
    preg_match( '/id="([^"]+)-name"/', $other_form, $second_id );
    ev_service_form_check( ! empty( $first_id[1] ) && ! empty( $second_id[1] ) && $first_id[1] !== $second_id[1], 'Multiple forms have unique accessible field IDs' );
    $_GET['service'] = 'maintenance';
    ev_service_form_check( preg_match( '/<option\s+value="maintenance"\s+selected=/', evpower_services_request_form() ), 'A service CTA can preselect a valid service' );
    $_GET['service'] = array( 'mobile' );
    ev_service_form_check( str_contains( evpower_services_request_form(), 'value="">Choose a service' ), 'Malformed service query parameters do not select a service' );
    $_GET = array( 'evs_request' => 'saved' );
    $success = evpower_services_request_form();
    ev_service_form_check( str_contains( $success, 'Your request is saved.' ) && str_contains( $success, 'not a confirmed booking' ), 'Confirmation explains that a request is saved, not booked' );
    $_GET = array();

    $request = $valid + array( 'evpower_service_nonce' => wp_create_nonce( 'evpower_service_request' ) );
    $server = array( 'REQUEST_METHOD' => 'POST', 'CONTENT_LENGTH' => '700', 'HTTP_ORIGIN' => home_url(), 'REMOTE_ADDR' => $address );
    foreach ( array( array( 'REQUEST_METHOD', 'GET', 'method' ), array( 'CONTENT_LENGTH', '32769', 'size' ), array( 'HTTP_ORIGIN', 'https://example.test', 'origin' ), array( 'HTTP_ORIGIN', home_url() . '.example.test', 'origin' ) ) as list( $key, $value, $code ) ) {
        $bad_server = $server; $bad_server[ $key ] = $value;
        $result = evpower_services_request_receive( $request, $bad_server );
        ev_service_form_check( is_wp_error( $result ) && $code === $result->get_error_code(), 'Submission rejects invalid ' . $key );
    }
    $bad_nonce = $request; $bad_nonce['evpower_service_nonce'] = 'invalid';
    $result = evpower_services_request_receive( $bad_nonce, $server );
    ev_service_form_check( is_wp_error( $result ) && 'expired' === $result->get_error_code(), 'Missing or invalid nonces cannot create enquiries' );
    $bad_array = $request; $bad_array['full_name'] = array( 'invalid' );
    ev_service_form_check( is_wp_error( evpower_services_request_receive( $bad_array, $server ) ), 'Array-valued POST fields cannot reach persistence' );
    $large = $request; $large['message'] = str_repeat( 'x', 33000 );
    $result = evpower_services_request_receive( $large, $server );
    ev_service_form_check( is_wp_error( $result ) && 'size' === $result->get_error_code(), 'Actual form size is limited when a content length header is inaccurate' );
    $trapped = $request; $trapped['company_website'] = 'https://example.test';
    $private_before = (int) wp_count_posts( 'ev_enquiry' )->private;
    ev_service_form_check( 0 === evpower_services_request_receive( $trapped, $server ) && $private_before === (int) wp_count_posts( 'ev_enquiry' )->private && empty( $mail_calls ), 'The honeypot reports success without storing a record or sending mail' );

    update_option( 'evpower_notification_email', 'service-notifications@example.test' );
    $id = evpower_services_request_receive( $request, $server );
    if ( is_int( $id ) && $id > 0 ) { $record_ids[] = $id; }
    ev_service_form_check( ! is_wp_error( $id ) && $id > 0 && 'private' === get_post_status( $id ) && 'ev_enquiry' === get_post_type( $id ), 'An anonymous request is saved as a private staff enquiry' );
    ev_service_form_check( 'Requested' === get_post_meta( $id, '_ev_status', true ) && get_post_meta( $id, '_ev_consent_at', true ) && 'mobile' === get_post_meta( $id, '_ev_service_id', true ), 'New enquiries record explicit consent, stable service IDs and unconfirmed status' );
    ev_service_form_check( 'Mobile EV Charging' === get_post_meta( $id, '_ev_service', true ) && $valid['phone'] === get_post_meta( $id, '_ev_phone', true ) && $valid['location'] === get_post_meta( $id, '_ev_location', true ), 'Existing admin request fields contain the validated customer details' );
    ev_service_form_check( 1 === count( $mail_calls ) && 'service-notifications@example.test' === $mail_calls[0]['to'] && str_contains( $mail_calls[0]['message'], 'post=' . $id ) && ! str_contains( $mail_calls[0]['message'], 'driver@example.test' ), 'A mocked staff notification uses the configured email and private record link' );
    ev_service_form_check( ! get_post_type_object( 'ev_enquiry' )->public && ! get_post_type_object( 'ev_enquiry' )->show_in_rest, 'Enquiry details have no public post or REST endpoint' );

    $subscriber = wp_insert_user( array( 'user_login' => 'service-test-' . wp_generate_password( 8, false ), 'user_email' => 'service-test-' . wp_generate_password( 8, false ) . '@example.test', 'user_pass' => wp_generate_password( 24, true ), 'role' => 'subscriber' ) );
    ev_service_form_check( ! is_wp_error( $subscriber ), 'A local test customer account can be created without WooCommerce' );
    wp_set_current_user( $subscriber );
    ev_service_form_check( ! current_user_can( 'edit_post', $id ) && ! current_user_can( 'read_post', $id ), 'Customers cannot read or manage private service records' );
    wp_set_current_user( 0 );
    for ( $attempt = 0; $attempt < 4; $attempt++ ) {
        $result = evpower_services_request_receive( $request, $server );
        if ( is_int( $result ) && $result > 0 ) { $record_ids[] = $result; }
        ev_service_form_check( is_int( $result ) && $result > 0, 'A request within the public rate limit is saved' );
    }
    $result = evpower_services_request_receive( $request, $server );
    ev_service_form_check( is_wp_error( $result ) && 'limited' === $result->get_error_code() && 5 === count( $mail_calls ), 'The sixth request from one address is limited without additional mail' );

    if ( class_exists( '\Elementor\Plugin' ) ) {
        $widgets = \Elementor\Plugin::$instance->widgets_manager->get_widget_types();
        $widget = $widgets['evpower-service-request'] ?? null;
        ev_service_form_check( $widget instanceof \Elementor\Widget_Base, 'The service form registers as a native Elementor widget' );
        $controls = $widget->get_controls();
        foreach ( array( 'default_service', 'heading', 'button_text', 'name_label', 'consent_label' ) as $key ) {
            ev_service_form_check( isset( $controls[ $key ] ), 'Elementor exposes the editable ' . $key . ' control' );
        }
    }
} finally {
    remove_filter( 'pre_wp_mail', $mail_fixture, PHP_INT_MAX );
    delete_transient( $rate_key );
    foreach ( $record_ids as $id ) { wp_delete_post( $id, true ); }
    if ( is_int( $subscriber ) && $subscriber > 0 ) {
        require_once ABSPATH . 'wp-admin/includes/user.php';
        wp_delete_user( $subscriber );
    }
    if ( null === $original_email ) { delete_option( 'evpower_notification_email' ); } else { update_option( 'evpower_notification_email', $original_email ); }
    wp_set_current_user( $original_user );
    $_GET = $original_get;
}
echo 'Completed ' . $GLOBALS['evpower_service_form_checks'] . " service request checks. All mail was intercepted; local records were removed.\n";
