<?php
defined( 'ABSPATH' ) || exit;

class Evpower_Chapa_Gateway extends WC_Payment_Gateway {
    public function __construct() {
        $this->id = 'evpower_chapa';
        $this->method_title = 'Chapa (Evpower)';
        $this->method_description = 'Hosted Chapa checkout for Ethiopian birr orders. Chapa shows the methods enabled for your merchant account, such as Telebirr, CBE Birr, bank payments, and eligible cards. Requires the classic WooCommerce Checkout shortcode.';
        $this->has_fields = false; $this->supports = array( 'products' );
        $this->init_form_fields(); $this->init_settings();
        $this->title = $this->get_option( 'title', 'Chapa — Ethiopian payment methods' );
        $this->description = $this->get_option( 'description', 'Pay securely on Chapa using the methods available for your account.' );
        $this->enabled = $this->get_option( 'enabled', 'no' );
        add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );
        add_action( 'woocommerce_api_evpower_chapa_callback', array( $this, 'callback' ) );
        add_action( 'template_redirect', array( $this, 'return_from_chapa' ), 1 );
    }
    public function init_form_fields() {
        $this->form_fields = array(
            'enabled' => array( 'title' => 'Enable', 'type' => 'checkbox', 'label' => 'Enable Chapa after configuring and testing your merchant account', 'default' => 'no' ),
            'title' => array( 'title' => 'Checkout title', 'type' => 'text', 'default' => 'Chapa — Ethiopian payment methods' ),
            'description' => array( 'title' => 'Checkout description', 'type' => 'textarea', 'default' => 'Pay securely on Chapa using the methods available for your account.' ),
            'secret_key' => array( 'title' => 'Chapa secret key', 'type' => 'password', 'description' => 'A private EVPOWER_CHAPA_SECRET_KEY constant in wp-config.php takes precedence. Never place the secret in page content or JavaScript.', 'default' => '' ),
        );
    }
    private function secret() {
        return defined( 'EVPOWER_CHAPA_SECRET_KEY' ) ? (string) EVPOWER_CHAPA_SECRET_KEY : (string) $this->get_option( 'secret_key', '' );
    }
    public function is_available() {
        return parent::is_available() && '' !== $this->secret() && 'ETB' === get_woocommerce_currency();
    }
    private function request( $path, $body = null ) {
        if ( ! $this->secret() ) { return new WP_Error( 'chapa_unconfigured', 'Online payments are not configured.' ); }
        $args = array( 'timeout' => 25, 'redirection' => 0, 'headers' => array( 'Authorization' => 'Bearer ' . $this->secret(), 'Content-Type' => 'application/json' ) );
        if ( null !== $body ) { $args['method'] = 'POST'; $args['body'] = wp_json_encode( $body ); }
        $response = wp_remote_request( 'https://api.chapa.co/v1/transaction/' . $path, $args );
        if ( is_wp_error( $response ) ) { return new WP_Error( 'chapa_network', 'Payment provider unavailable. Please try again or contact Evpower.' ); }
        $data = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( wp_remote_retrieve_response_code( $response ) < 200 || wp_remote_retrieve_response_code( $response ) >= 300 || ! is_array( $data ) || 'success' !== ( $data['status'] ?? '' ) ) { return new WP_Error( 'chapa_response', 'The payment provider could not complete this request.' ); }
        return $data;
    }
    private function lock( $id ) {
        $key = '_evpower_chapa_lock_' . $id;
        // add_option uses a unique database key, so concurrent callbacks cannot both hold this lock.
        if ( add_option( $key, time(), '', false ) ) { return $key; }
        $time = (int) get_option( $key );
        if ( $time && time() - $time > 120 ) { delete_option( $key ); if ( add_option( $key, time(), '', false ) ) { return $key; } }
        return false;
    }
    private function checkout_url( $url ) {
        $parts = wp_parse_url( $url );
        return is_array( $parts ) && 'https' === ( $parts['scheme'] ?? '' ) && in_array( $parts['host'] ?? '', array( 'checkout.chapa.co', 'chapa.co' ), true ) && empty( $parts['user'] ) && empty( $parts['pass'] ) && ( empty( $parts['port'] ) || 443 === $parts['port'] );
    }
    public function process_payment( $order_id ) {
        $order = wc_get_order( $order_id );
        if ( ! $order || ! $this->is_available() || 'ETB' !== $order->get_currency() ) { wc_add_notice( 'Chapa checkout is unavailable. Contact Evpower for assistance.', 'error' ); return array( 'result' => 'failure' ); }
        if ( $order->is_paid() ) { return array( 'result' => 'success', 'redirect' => $this->get_return_url( $order ) ); }
        $lock = $this->lock( $order_id );
        if ( ! $lock ) { wc_add_notice( 'This payment is being prepared. Please wait and try again.', 'error' ); return array( 'result' => 'failure' ); }
        try {
            $reference = $order->get_meta( '_ev_chapa_ref' );
            $url = $order->get_meta( '_ev_chapa_url' );
            if ( $reference && $url && $this->checkout_url( $url ) && (string) $order->get_meta( '_ev_chapa_total' ) === (string) $order->get_total() ) { return array( 'result' => 'success', 'redirect' => $url ); }
            if ( $reference ) { throw new RuntimeException( 'A payment attempt already exists. Contact Evpower to reconcile it before starting another payment for this order.' ); }
            $reference = 'evpower-' . $order_id . '-' . bin2hex( random_bytes( 12 ) );
            $order->update_meta_data( '_ev_chapa_ref', $reference );
            $order->update_meta_data( '_ev_chapa_total', $order->get_total() );
            $order->update_meta_data( '_ev_chapa_currency', $order->get_currency() );
            $order->save();
            $response = $this->request( 'initialize', array(
                'amount' => $order->get_total(), 'currency' => $order->get_currency(), 'email' => $order->get_billing_email(),
                'first_name' => $order->get_billing_first_name(), 'last_name' => $order->get_billing_last_name(), 'phone_number' => $order->get_billing_phone(),
                'tx_ref' => $reference,
                'callback_url' => add_query_arg( array( 'wc-api' => 'evpower_chapa_callback', 'tx_ref' => $reference ), home_url( '/' ) ),
                'return_url' => add_query_arg( 'evpower_chapa_return', $reference, $this->get_return_url( $order ) ),
                'customization' => array( 'title' => 'Evpower order', 'description' => 'Order ' . $order->get_order_number() ),
            ) );
            if ( is_wp_error( $response ) ) { throw new RuntimeException( $response->get_error_message() ); }
            $url = $response['data']['checkout_url'] ?? '';
            if ( ! is_string( $url ) || ! $this->checkout_url( $url ) ) { throw new RuntimeException( 'The payment provider returned an unsupported checkout address.' ); }
            $order->update_meta_data( '_ev_chapa_url', $url ); $order->save();
            return array( 'result' => 'success', 'redirect' => $url );
        } catch ( Throwable $error ) {
            $order->add_order_note( 'Chapa initialization needs review. Payment has not been marked complete.' );
            wc_add_notice( $error->getMessage(), 'error' ); return array( 'result' => 'failure' );
        } finally { delete_option( $lock ); }
    }
    public function verify_reference( $reference ) {
        if ( ! is_string( $reference ) || ! preg_match( '/^evpower-([0-9]+)-[a-f0-9]{24}$/', $reference, $matches ) ) { return false; }
        $order = wc_get_order( (int) $matches[1] );
        if ( ! $order || ! hash_equals( (string) $order->get_meta( '_ev_chapa_ref' ), $reference ) || 'evpower_chapa' !== $order->get_payment_method() ) { return false; }
        if ( $order->is_paid() ) { return true; }
        $lock = $this->lock( $order->get_id() ); if ( ! $lock ) { return false; }
        try {
            $response = $this->request( 'verify/' . rawurlencode( $reference ) );
            if ( is_wp_error( $response ) ) { return false; }
            $data = $response['data'] ?? array();
            $amount = (string) ( $data['amount'] ?? '' );
            $matches_amount = preg_match( '/^[0-9]+(?:\.[0-9]{1,2})?$/', $amount ) && (int) round( (float) $amount * 100 ) === (int) round( (float) $order->get_total() * 100 ) && (int) round( (float) $amount * 100 ) === (int) round( (float) $order->get_meta( '_ev_chapa_total' ) * 100 );
            if ( 'success' !== ( $data['status'] ?? '' ) || ! hash_equals( $reference, (string) ( $data['tx_ref'] ?? '' ) ) || 'ETB' !== ( $data['currency'] ?? '' ) || 'ETB' !== $order->get_currency() || ! $matches_amount ) { return false; }
            $transaction = sanitize_text_field( $data['reference'] ?? $reference );
            $order->payment_complete( $transaction );
            $order->add_order_note( 'Chapa payment independently verified against the order reference, currency, and amount.' );
            return true;
        } finally { delete_option( $lock ); }
    }
    public function callback() {
        $reference = isset( $_GET['tx_ref'] ) && is_string( $_GET['tx_ref'] ) ? sanitize_text_field( wp_unslash( $_GET['tx_ref'] ) ) : '';
        if ( ! $reference ) { $input = json_decode( file_get_contents( 'php://input', false, null, 0, 16384 ), true ); $reference = is_string( $input['tx_ref'] ?? null ) ? sanitize_text_field( $input['tx_ref'] ) : ''; }
        nocache_headers();
        wp_send_json( array( 'received' => true, 'verified' => $this->verify_reference( $reference ) ) );
    }
    public function return_from_chapa() {
        if ( isset( $_GET['evpower_chapa_return'] ) && is_string( $_GET['evpower_chapa_return'] ) ) { $this->verify_reference( sanitize_text_field( wp_unslash( $_GET['evpower_chapa_return'] ) ) ); }
    }
}
