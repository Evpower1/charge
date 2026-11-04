<?php
defined( 'ABSPATH' ) || exit;

function evpower_form( $type ) {
    evpower_assets();
    $booking = 'booking' === $type;
    $services = array( 'Mobile EV Charging', 'Fleet Charging Solutions', 'Charger Sales & Installation', 'EV Maintenance & Care' );
    ob_start();
    if ( isset( $_GET['ev_submitted'] ) ) {
        echo '<div class="ep-form-success" role="status"><h2>' . ( $booking ? 'Your charging request is in.' : 'Thanks for reaching out.' ) . '</h2><p>Our team will contact you. ' . ( $booking ? 'This request is not a confirmed appointment.' : '' ) . '</p><p>Need assistance? Call <a href="tel:8890">8890</a>.</p></div>';
        return ob_get_clean();
    }
    if ( isset( $_GET['ev_error'] ) ) {
        $messages = array( 'validation' => 'Check the required fields and try again.', 'expired' => 'Your form expired. Reload this page and try again.', 'limited' => 'Too many requests. Please try again in 15 minutes or call 8890.', 'save' => 'We could not save your request. Please try again or call 8890.' );
        $code = sanitize_key( wp_unslash( $_GET['ev_error'] ) );
        echo '<p class="ep-form-error" role="alert">' . esc_html( $messages[ $code ] ?? $messages['validation'] ) . '</p>';
    }
    ?>
    <form class="ep-form" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
        <input type="hidden" name="action" value="evpower_submit">
        <input type="hidden" name="form_type" value="<?php echo esc_attr( $type ); ?>">
        <?php wp_nonce_field( 'evpower_' . $type, 'evpower_nonce' ); ?>
        <div class="ep-form-trap" aria-hidden="true"><label>Company website<input name="company_website" tabindex="-1" autocomplete="off"></label></div>
        <div class="ep-form-grid">
            <label>Full name<input name="full_name" required maxlength="100" autocomplete="name"></label>
            <label>Email address<input name="email" type="email" required maxlength="190" autocomplete="email"></label>
            <?php if ( $booking ) : ?>
                <label>Phone number<input name="phone" type="tel" required maxlength="25" autocomplete="tel" placeholder="+251…"></label>
                <label>Service<select name="service" required><?php foreach ( $services as $service ) : ?><option><?php echo esc_html( $service ); ?></option><?php endforeach; ?></select></label>
                <label>Preferred date<input name="preferred_date" type="date" required min="<?php echo esc_attr( wp_date( 'Y-m-d' ) ); ?>"></label>
                <label>Preferred time<select name="preferred_time" required><option>Morning</option><option>Afternoon</option><option>Flexible</option></select></label>
                <label class="ep-form-full">Your location<input name="location" required maxlength="300" placeholder="City, area, and a nearby landmark"></label>
                <label class="ep-form-full">Vehicle and connector<input name="vehicle" maxlength="150" placeholder="Vehicle model and connector, if known"></label>
            <?php else : ?>
                <label class="ep-form-full">How can we help?<select name="topic" required><option>General enquiry</option><option>Charging support</option><option>Product advice</option><option>Business partnership</option></select></label>
            <?php endif; ?>
            <label class="ep-form-full"><?php echo $booking ? 'Additional details (optional)' : 'Your message'; ?><textarea name="message" rows="5" maxlength="4000" <?php echo $booking ? '' : 'required'; ?>></textarea></label>
            <label class="ep-form-consent ep-form-full"><input type="checkbox" name="consent" value="1" required> <span>I agree that Evpower may use these details to respond to my request. <a href="<?php echo esc_url( evpower_page_url( 'privacy' ) ); ?>">Privacy policy</a>.</span></label>
        </div>
        <button class="wp-element-button" type="submit"><?php echo $booking ? 'Request charging ↗' : 'Send your message ↗'; ?></button>
        <p class="ep-form-note"><?php echo $booking ? 'We confirm availability, compatibility, and price before your appointment.' : 'For urgent assistance, call 8890 or +251 911 049 916.'; ?></p>
    </form>
    <?php
    return ob_get_clean();
}
add_shortcode( 'evpower_booking', function () { return evpower_form( 'booking' ); } );
add_shortcode( 'evpower_contact', function () { return evpower_form( 'contact' ); } );

/** Validation is separate from HTTP handling so it can be tested without sending mail. */
function evpower_validate_submission( $input ) {
    foreach ( $input as $field ) { if ( ! is_string( $field ) ) { return new WP_Error( 'validation' ); } }
    $type = sanitize_key( $input['form_type'] ?? '' );
    $value = array(
        'type' => $type,
        'name' => mb_substr( sanitize_text_field( $input['full_name'] ?? '' ), 0, 100 ),
        'email' => sanitize_email( $input['email'] ?? '' ),
        'message' => mb_substr( sanitize_textarea_field( $input['message'] ?? '' ), 0, 4000 ),
    );
    if ( ! in_array( $type, array( 'booking', 'contact' ), true ) || ! $value['name'] || ! is_email( $value['email'] ) || '1' !== ( $input['consent'] ?? '' ) ) { return new WP_Error( 'validation' ); }
    if ( 'contact' === $type ) {
        $value['topic'] = sanitize_text_field( $input['topic'] ?? '' );
        if ( ! $value['message'] || ! in_array( $value['topic'], array( 'General enquiry', 'Charging support', 'Product advice', 'Business partnership' ), true ) ) { return new WP_Error( 'validation' ); }
    } else {
        foreach ( array( 'phone' => 25, 'service' => 100, 'preferred_date' => 10, 'preferred_time' => 20, 'location' => 300, 'vehicle' => 150 ) as $key => $limit ) {
            $value[ $key ] = mb_substr( sanitize_text_field( $input[ $key ] ?? '' ), 0, $limit );
        }
        $date = DateTimeImmutable::createFromFormat( '!Y-m-d', $value['preferred_date'], wp_timezone() );
        if ( ! preg_match( '/^\+?[0-9 ()-]{7,25}$/', $value['phone'] ) || ! $value['location'] || ! $date || $date->format( 'Y-m-d' ) !== $value['preferred_date'] || $date < new DateTimeImmutable( 'today', wp_timezone() ) || ! in_array( $value['preferred_time'], array( 'Morning', 'Afternoon', 'Flexible' ), true ) || ! in_array( $value['service'], array( 'Mobile EV Charging', 'Fleet Charging Solutions', 'Charger Sales & Installation', 'EV Maintenance & Care' ), true ) ) { return new WP_Error( 'validation' ); }
    }
    return $value;
}

function evpower_save_submission( $value ) {
    $booking = 'booking' === $value['type'];
    $title = $value['name'] . ' · ' . ( $booking ? $value['service'] : $value['topic'] );
    $id = wp_insert_post( array( 'post_type' => $booking ? 'ev_booking' : 'ev_enquiry', 'post_status' => 'private', 'post_title' => $title, 'post_author' => get_current_user_id() ), true );
    if ( is_wp_error( $id ) ) { return $id; }
    foreach ( $value as $key => $field ) { update_post_meta( $id, '_ev_' . $key, $field ); }
    update_post_meta( $id, '_ev_status', 'Requested' );
    update_post_meta( $id, '_ev_consent_at', current_time( 'mysql', true ) );
    return $id;
}

function evpower_submission_redirect( $type, $code ) {
    $key = 'booking' === $type ? 'booking' : 'contact';
    wp_safe_redirect( add_query_arg( $code, '1', evpower_page_url( $key ) ) ); exit;
}

function evpower_submit_form() {
    if ( 'POST' !== ( $_SERVER['REQUEST_METHOD'] ?? '' ) ) { wp_die( 'Method not allowed.', '', array( 'response' => 405 ) ); }
    if ( (int) ( $_SERVER['CONTENT_LENGTH'] ?? 0 ) > 32768 ) { wp_die( 'Form too large.', '', array( 'response' => 413 ) ); }
    $input = wp_unslash( $_POST );
    foreach ( $input as $field ) { if ( ! is_string( $field ) ) { wp_die( 'Invalid form.', '', array( 'response' => 400 ) ); } }
    $type = sanitize_key( $input['form_type'] ?? '' );
    if ( ! in_array( $type, array( 'booking', 'contact' ), true ) ) { wp_die( 'Invalid form.', '', array( 'response' => 400 ) ); }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ( $origin ) {
        $request_origin = wp_parse_url( $origin ); $site_origin = wp_parse_url( home_url() );
        foreach ( array( 'scheme', 'host', 'port' ) as $key ) {
            if ( ( $request_origin[ $key ] ?? '' ) !== ( $site_origin[ $key ] ?? '' ) ) { wp_die( 'Origin not allowed.', '', array( 'response' => 403 ) ); }
        }
    }
    if ( empty( $input['evpower_nonce'] ) || ! wp_verify_nonce( $input['evpower_nonce'], 'evpower_' . $type ) ) {
        wp_safe_redirect( add_query_arg( 'ev_error', 'expired', evpower_page_url( $type ) ) ); exit;
    }
    if ( ! empty( $input['company_website'] ) ) { evpower_submission_redirect( $type, 'ev_submitted' ); }
    $rate_key = 'evpower_form_' . hash_hmac( 'sha256', $type . ( $_SERVER['REMOTE_ADDR'] ?? 'unknown' ), wp_salt( 'auth' ) );
    $attempts = (int) get_transient( $rate_key );
    if ( $attempts >= 5 ) { wp_safe_redirect( add_query_arg( 'ev_error', 'limited', evpower_page_url( $type ) ) ); exit; }
    set_transient( $rate_key, $attempts + 1, 15 * MINUTE_IN_SECONDS );
    $value = evpower_validate_submission( $input );
    if ( is_wp_error( $value ) ) { wp_safe_redirect( add_query_arg( 'ev_error', 'validation', evpower_page_url( $type ) ) ); exit; }
    $id = evpower_save_submission( $value );
    if ( is_wp_error( $id ) ) { wp_safe_redirect( add_query_arg( 'ev_error', 'save', evpower_page_url( $type ) ) ); exit; }
    $recipient = get_option( 'evpower_notification_email', 'info@evpower.et' );
    if ( is_email( $recipient ) ) {
        wp_mail( $recipient, 'New Evpower ' . $type . ' request #' . $id, 'A new request is saved in your private WordPress dashboard.' . "\n\n" . admin_url( 'post.php?post=' . $id . '&action=edit' ) );
    }
    evpower_submission_redirect( $type, 'ev_submitted' );
}
add_action( 'admin_post_evpower_submit', 'evpower_submit_form' );
add_action( 'admin_post_nopriv_evpower_submit', 'evpower_submit_form' );

add_action( 'add_meta_boxes', function () {
    foreach ( array( 'ev_booking', 'ev_enquiry' ) as $type ) {
        add_meta_box( 'evpower-record', 'Request details', function ( $post ) {
            wp_nonce_field( 'evpower_record', 'evpower_record_nonce' );
            echo '<table class="widefat striped"><tbody>';
            foreach ( array( 'name', 'email', 'phone', 'service', 'topic', 'preferred_date', 'preferred_time', 'location', 'vehicle', 'message', 'consent_at' ) as $key ) {
                $value = get_post_meta( $post->ID, '_ev_' . $key, true );
                if ( '' !== $value ) { echo '<tr><th>' . esc_html( ucwords( str_replace( '_', ' ', $key ) ) ) . '</th><td style="white-space:pre-wrap">' . esc_html( $value ) . '</td></tr>'; }
            }
            echo '</tbody></table><p><label>Status <select name="ev_status">';
            foreach ( array( 'Requested', 'Contacted', 'Confirmed', 'Completed', 'Closed', 'Cancelled' ) as $status ) { echo '<option ' . selected( get_post_meta( $post->ID, '_ev_status', true ), $status, false ) . '>' . esc_html( $status ) . '</option>'; }
            echo '</select></label></p><p>“Confirmed” is a staff decision after contacting the customer. Form submission alone never confirms an appointment.</p>';
        }, $type );
    }
} );
add_action( 'save_post', function ( $id, $post ) {
    if ( ! in_array( $post->post_type, array( 'ev_booking', 'ev_enquiry' ), true ) || ! current_user_can( 'manage_options' ) || empty( $_POST['evpower_record_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['evpower_record_nonce'] ) ), 'evpower_record' ) ) { return; }
    $status = sanitize_text_field( wp_unslash( $_POST['ev_status'] ?? '' ) );
    if ( in_array( $status, array( 'Requested', 'Contacted', 'Confirmed', 'Completed', 'Closed', 'Cancelled' ), true ) ) { update_post_meta( $id, '_ev_status', $status ); }
}, 10, 2 );
