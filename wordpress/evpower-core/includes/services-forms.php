<?php
/** Service enquiries work without WooCommerce or Elementor Pro Forms. */
defined( 'ABSPATH' ) || exit;

function evpower_services_request_choices() {
    return array(
        'mobile' => 'Mobile EV Charging',
        'supply' => 'Charger Supply',
        'installation' => 'Charger Installation',
        'maintenance' => 'Charger Maintenance',
    );
}

function evpower_services_request_defaults() {
    return array(
        'service' => '', 'default_service' => '', 'heading' => '', 'intro' => '',
        'button_text' => 'Send request',
        'name_label' => 'Full name', 'email_label' => 'Email address',
        'phone_label' => 'Phone number', 'service_label' => 'Service',
        'location_label' => 'City / area', 'date_label' => 'Preferred date (optional)',
        'message_label' => 'Tell us what you need',
        'consent_label' => 'I agree that Evpower may use these details to respond to my request.',
        'note_text' => 'We will contact you to discuss availability, compatibility and price. Sending a request does not confirm a booking.',
    );
}

function evpower_services_request_url() {
    return function_exists( 'evpower_services_page_url' ) ? evpower_services_page_url( 'quote' ) : evpower_page_url( 'contact' );
}

/** Return validated data, never a service label supplied by a visitor. */
function evpower_services_request_validate( $input ) {
    if ( ! is_array( $input ) ) { return new WP_Error( 'validation' ); }
    foreach ( $input as $field ) { if ( ! is_string( $field ) ) { return new WP_Error( 'validation' ); } }
    $limits = array( 'full_name' => 100, 'email' => 190, 'phone' => 25, 'service' => 30, 'location' => 300, 'preferred_date' => 10, 'message' => 4000 );
    foreach ( $limits as $key => $limit ) {
        if ( mb_strlen( $input[ $key ] ?? '' ) > $limit ) { return new WP_Error( 'validation' ); }
    }
    $services = evpower_services_request_choices();
    $service = $input['service'] ?? '';
    $email = trim( $input['email'] ?? '' );
    $value = array(
        'type' => 'service',
        'name' => sanitize_text_field( $input['full_name'] ?? '' ),
        'email' => sanitize_email( $email ),
        'phone' => sanitize_text_field( $input['phone'] ?? '' ),
        'service_id' => $service,
        'service' => $services[ $service ] ?? '',
        'topic' => 'Service request',
        'location' => sanitize_text_field( $input['location'] ?? '' ),
        'preferred_date' => $input['preferred_date'] ?? '',
        'message' => sanitize_textarea_field( $input['message'] ?? '' ),
    );
    $digits = preg_replace( '/\D/', '', $value['phone'] );
    if ( ! $value['name'] || ! is_email( $email ) || ! $value['service'] || ! $value['location'] || ! $value['message'] || '1' !== ( $input['consent'] ?? '' ) || ! preg_match( '/^\+?[0-9 ()-]{7,25}$/', $value['phone'] ) || strlen( $digits ) < 7 || strlen( $digits ) > 15 ) {
        return new WP_Error( 'validation' );
    }
    if ( '' !== $value['preferred_date'] ) {
        $date = DateTimeImmutable::createFromFormat( '!Y-m-d', $value['preferred_date'], wp_timezone() );
        $today = new DateTimeImmutable( 'today', wp_timezone() );
        if ( ! $date || $date->format( 'Y-m-d' ) !== $value['preferred_date'] || $date < $today || $date > $today->modify( '+180 days' ) ) { return new WP_Error( 'validation' ); }
    }
    return $value;
}

function evpower_services_request_save( $value ) {
    // Reuse the existing private enquiry record and staff dashboard fields.
    $id = wp_insert_post( wp_slash( array( 'post_type' => 'ev_enquiry', 'post_status' => 'private', 'post_title' => $value['name'] . ' · ' . $value['service'], 'post_author' => get_current_user_id() ) ), true );
    if ( is_wp_error( $id ) || ! $id ) { return new WP_Error( 'save' ); }
    foreach ( $value as $key => $field ) { update_post_meta( $id, '_ev_' . $key, wp_slash( $field ) ); }
    update_post_meta( $id, '_ev_status', 'Requested' );
    update_post_meta( $id, '_ev_consent_at', current_time( 'mysql', true ) );
    return $id;
}

/** Compare site origins, including the effective HTTP(S) port. */
function evpower_services_request_same_origin( $origin ) {
    if ( '' === $origin ) { return true; }
    if ( ! is_string( $origin ) ) { return false; }
    $parts = wp_parse_url( $origin );
    $site = wp_parse_url( home_url() );
    if ( ! is_array( $parts ) || ! isset( $parts['scheme'], $parts['host'] ) || isset( $parts['user'] ) || isset( $parts['pass'] ) || ! in_array( strtolower( $parts['scheme'] ), array( 'http', 'https' ), true ) ) { return false; }
    $origin_port = $parts['port'] ?? ( 'https' === strtolower( $parts['scheme'] ) ? 443 : 80 );
    $site_port = $site['port'] ?? ( 'https' === strtolower( $site['scheme'] ?? '' ) ? 443 : 80 );
    return strtolower( $parts['scheme'] ) === strtolower( $site['scheme'] ?? '' ) && strtolower( $parts['host'] ) === strtolower( $site['host'] ?? '' ) && $origin_port === $site_port;
}

/** A separate receiver lets local tests cover guards without HTTP redirects. */
function evpower_services_request_receive( $input, $server ) {
    if ( 'POST' !== ( $server['REQUEST_METHOD'] ?? '' ) ) { return new WP_Error( 'method' ); }
    if ( (int) ( $server['CONTENT_LENGTH'] ?? 0 ) > 32768 ) { return new WP_Error( 'size' ); }
    if ( ! is_array( $input ) || count( $input ) > 25 ) { return new WP_Error( 'validation' ); }
    foreach ( $input as $field ) { if ( ! is_string( $field ) ) { return new WP_Error( 'validation' ); } }
    if ( strlen( http_build_query( $input ) ) > 32768 ) { return new WP_Error( 'size' ); }
    if ( ! evpower_services_request_same_origin( $server['HTTP_ORIGIN'] ?? '' ) ) { return new WP_Error( 'origin' ); }
    if ( ! wp_verify_nonce( $input['evpower_service_nonce'] ?? '', 'evpower_service_request' ) ) { return new WP_Error( 'expired' ); }
    if ( ! empty( $input['company_website'] ) ) { return 0; }
    $address = $server['REMOTE_ADDR'] ?? '';
    $address = is_string( $address ) && filter_var( $address, FILTER_VALIDATE_IP ) ? $address : 'unknown';
    $rate_key = 'evpower_services_form_' . hash_hmac( 'sha256', $address, wp_salt( 'auth' ) );
    $attempts = (int) get_transient( $rate_key );
    if ( $attempts >= 5 ) { return new WP_Error( 'limited' ); }
    set_transient( $rate_key, $attempts + 1, 15 * MINUTE_IN_SECONDS );
    $value = evpower_services_request_validate( $input );
    if ( is_wp_error( $value ) ) { return $value; }
    $id = evpower_services_request_save( $value );
    if ( is_wp_error( $id ) ) { return $id; }
    $recipient = get_option( 'evpower_notification_email', 'info@evpower.et' );
    if ( is_string( $recipient ) && is_email( $recipient ) ) {
        // The request is already saved if the mail server is unavailable.
        try {
            wp_mail( $recipient, 'New Evpower service request #' . $id, 'A service request is saved in your private WordPress dashboard.' . "\n\n" . admin_url( 'post.php?post=' . $id . '&action=edit' ) );
        } catch ( Throwable $error ) {
            update_post_meta( $id, '_ev_notification_failed', '1' );
        }
    }
    return $id;
}

function evpower_services_request_submit() {
    $result = evpower_services_request_receive( wp_unslash( $_POST ), $_SERVER );
    if ( is_wp_error( $result ) ) {
        $code = $result->get_error_code();
        $status = array( 'method' => 405, 'size' => 413, 'origin' => 403 );
        if ( isset( $status[ $code ] ) ) { wp_die( 'This request could not be accepted. Return to the form and try again.', 'Request not accepted', array( 'response' => $status[ $code ] ) ); }
        wp_safe_redirect( add_query_arg( 'evs_error', $code, evpower_services_request_url() ) . '#service-request' );
    } else {
        wp_safe_redirect( add_query_arg( 'evs_request', 'saved', evpower_services_request_url() ) . '#service-request' );
    }
    exit;
}
add_action( 'admin_post_evpower_service_request_submit', 'evpower_services_request_submit' );
add_action( 'admin_post_nopriv_evpower_service_request_submit', 'evpower_services_request_submit' );

function evpower_services_request_form( $attributes = array() ) {
    $defaults = evpower_services_request_defaults();
    $settings = shortcode_atts( $defaults, is_array( $attributes ) ? $attributes : array(), 'evpower_service_request' );
    foreach ( $settings as $key => $value ) { $settings[ $key ] = is_string( $value ) ? sanitize_textarea_field( $value ) : $defaults[ $key ]; }
    $choices = evpower_services_request_choices();
    $selected = $settings['service'] ?: $settings['default_service'];
    if ( ! isset( $choices[ $selected ] ) ) { $selected = ''; }
    // Links from a service CTA can preselect a choice, without hiding alternatives.
    if ( ! $selected && isset( $_GET['service'] ) && is_string( $_GET['service'] ) ) {
        $requested = wp_unslash( $_GET['service'] );
        if ( isset( $choices[ $requested ] ) ) { $selected = $requested; }
    }
    $instance = wp_unique_id( 'evs-request-' );
    $today = new DateTimeImmutable( 'today', wp_timezone() );
    ob_start();
    if ( $settings['heading'] ) { echo '<h2 class="evs-request__heading">' . esc_html( $settings['heading'] ) . '</h2>'; }
    if ( $settings['intro'] ) { echo '<p class="evs-request__intro">' . esc_html( $settings['intro'] ) . '</p>'; }
    if ( isset( $_GET['evs_request'] ) && is_string( $_GET['evs_request'] ) && 'saved' === wp_unslash( $_GET['evs_request'] ) ) {
        echo '<div class="evs-request__notice evs-request__notice--success" role="status"><h3>Thank you. Your request is saved.</h3><p>Our team will contact you to discuss the details. Your request is not a confirmed booking.</p></div>';
    }
    if ( isset( $_GET['evs_error'] ) && is_string( $_GET['evs_error'] ) ) {
        $messages = array( 'validation' => 'Please check every required field, choose a service and agree to the contact consent.', 'expired' => 'Your form has expired. Reload this page and try again.', 'limited' => 'Please wait 15 minutes before trying again, or call +251 911 049 916.', 'save' => 'We could not save your request. Please try again or call +251 911 049 916.' );
        $code = sanitize_key( wp_unslash( $_GET['evs_error'] ) );
        echo '<p class="evs-request__notice evs-request__notice--error" role="alert">' . esc_html( $messages[ $code ] ?? $messages['validation'] ) . '</p>';
    }
    ?>
    <form class="evs-request" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" aria-label="Service request">
        <input type="hidden" name="action" value="evpower_service_request_submit">
        <?php wp_nonce_field( 'evpower_service_request', 'evpower_service_nonce', false ); ?>
        <div class="evs-request__trap" aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;"><label for="<?php echo esc_attr( $instance ); ?>-website">Leave this field empty</label><input id="<?php echo esc_attr( $instance ); ?>-website" name="company_website" tabindex="-1" autocomplete="off"></div>
        <div class="evs-request__grid">
            <label for="<?php echo esc_attr( $instance ); ?>-name"><?php echo esc_html( $settings['name_label'] ); ?><input id="<?php echo esc_attr( $instance ); ?>-name" name="full_name" required maxlength="100" autocomplete="name"></label>
            <label for="<?php echo esc_attr( $instance ); ?>-email"><?php echo esc_html( $settings['email_label'] ); ?><input id="<?php echo esc_attr( $instance ); ?>-email" name="email" type="email" required maxlength="190" autocomplete="email"></label>
            <label for="<?php echo esc_attr( $instance ); ?>-phone"><?php echo esc_html( $settings['phone_label'] ); ?><input id="<?php echo esc_attr( $instance ); ?>-phone" name="phone" type="tel" required maxlength="25" autocomplete="tel" placeholder="+251…"></label>
            <label for="<?php echo esc_attr( $instance ); ?>-service"><?php echo esc_html( $settings['service_label'] ); ?><select id="<?php echo esc_attr( $instance ); ?>-service" name="service" required><option value="">Choose a service</option><?php foreach ( $choices as $key => $label ) : ?><option value="<?php echo esc_attr( $key ); ?>" <?php selected( $selected, $key ); ?>><?php echo esc_html( $label ); ?></option><?php endforeach; ?></select></label>
            <label for="<?php echo esc_attr( $instance ); ?>-location"><?php echo esc_html( $settings['location_label'] ); ?><input id="<?php echo esc_attr( $instance ); ?>-location" name="location" required maxlength="300" autocomplete="address-level2"></label>
            <label for="<?php echo esc_attr( $instance ); ?>-date"><?php echo esc_html( $settings['date_label'] ); ?><input id="<?php echo esc_attr( $instance ); ?>-date" name="preferred_date" type="date" min="<?php echo esc_attr( $today->format( 'Y-m-d' ) ); ?>" max="<?php echo esc_attr( $today->modify( '+180 days' )->format( 'Y-m-d' ) ); ?>"></label>
            <label class="evs-request__full" for="<?php echo esc_attr( $instance ); ?>-message"><?php echo esc_html( $settings['message_label'] ); ?><textarea id="<?php echo esc_attr( $instance ); ?>-message" name="message" rows="5" required maxlength="4000"></textarea></label>
            <label class="evs-request__consent evs-request__full" for="<?php echo esc_attr( $instance ); ?>-consent"><input id="<?php echo esc_attr( $instance ); ?>-consent" name="consent" type="checkbox" value="1" required><span><?php echo esc_html( $settings['consent_label'] ); ?></span></label>
        </div>
        <button class="evs-request__button wp-element-button" type="submit"><?php echo esc_html( $settings['button_text'] ); ?></button>
        <p class="evs-request__note"><?php echo esc_html( $settings['note_text'] ); ?></p>
    </form>
    <?php
    return ob_get_clean();
}
add_shortcode( 'evpower_service_request', 'evpower_services_request_form' );

add_action( 'elementor/widgets/register', function ( $manager ) {
    if ( ! class_exists( '\Elementor\Widget_Base' ) ) { return; }
    if ( ! class_exists( 'Evpower_Elementor_Service_Request', false ) ) {
    class Evpower_Elementor_Service_Request extends \Elementor\Widget_Base {
        public function get_name() { return 'evpower-service-request'; }
        public function get_title() { return 'Evpower Service Request'; }
        public function get_icon() { return 'eicon-form-horizontal'; }
        public function get_categories() { return array( 'evpower' ); }
        protected function register_controls() {
            $defaults = evpower_services_request_defaults();
            $this->start_controls_section( 'request_content', array( 'label' => 'Service request' ) );
            foreach ( array( 'heading' => 'Heading (optional)', 'intro' => 'Introduction (optional)', 'button_text' => 'Button text', 'note_text' => 'Text below button' ) as $key => $label ) {
                $this->add_control( $key, array( 'label' => $label, 'type' => in_array( $key, array( 'intro', 'note_text' ), true ) ? \Elementor\Controls_Manager::TEXTAREA : \Elementor\Controls_Manager::TEXT, 'default' => $defaults[ $key ] ) );
            }
            $this->add_control( 'default_service', array( 'label' => 'Preselected service', 'type' => \Elementor\Controls_Manager::SELECT, 'options' => array( '' => 'Ask the visitor to choose' ) + evpower_services_request_choices(), 'default' => '' ) );
            $this->end_controls_section();
            $this->start_controls_section( 'request_labels', array( 'label' => 'Field labels' ) );
            foreach ( array( 'name_label', 'email_label', 'phone_label', 'service_label', 'location_label', 'date_label', 'message_label', 'consent_label' ) as $key ) {
                $this->add_control( $key, array( 'label' => $defaults[ $key ], 'type' => 'consent_label' === $key ? \Elementor\Controls_Manager::TEXTAREA : \Elementor\Controls_Manager::TEXT, 'default' => $defaults[ $key ] ) );
            }
            $this->end_controls_section();
            $this->start_controls_section( 'request_style', array( 'label' => 'Appearance', 'tab' => \Elementor\Controls_Manager::TAB_STYLE ) );
            $this->add_control( 'text_color', array( 'label' => 'Text colour', 'type' => \Elementor\Controls_Manager::COLOR, 'selectors' => array( '{{WRAPPER}} .evs-request' => 'color: {{VALUE}}' ) ) );
            $this->add_control( 'button_color', array( 'label' => 'Button colour', 'type' => \Elementor\Controls_Manager::COLOR, 'selectors' => array( '{{WRAPPER}} .evs-request__button' => 'background: {{VALUE}}' ) ) );
            $this->add_group_control( \Elementor\Group_Control_Typography::get_type(), array( 'name' => 'request_typography', 'selector' => '{{WRAPPER}} .evs-request' ) );
            $this->end_controls_section();
        }
        protected function render() { echo evpower_services_request_form( $this->get_settings_for_display() ); }
    }
    }
    $manager->register( new Evpower_Elementor_Service_Request() );
} );
