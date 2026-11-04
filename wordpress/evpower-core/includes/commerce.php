<?php
defined( 'ABSPATH' ) || exit;

add_action( 'plugins_loaded', function () {
    if ( ! class_exists( 'WC_Payment_Gateway' ) ) { return; }
    require_once EVPOWER_CORE_PATH . 'includes/gateway-chapa.php';
    add_filter( 'woocommerce_payment_gateways', function ( $gateways ) { $gateways[] = 'Evpower_Chapa_Gateway'; return $gateways; } );
}, 20 );

add_filter( 'woocommerce_account_menu_items', function ( $items ) {
    $logout = $items['customer-logout'] ?? 'Log out'; unset( $items['customer-logout'] );
    $items['charging-requests'] = 'Charging requests'; $items['customer-logout'] = $logout; return $items;
} );
add_action( 'woocommerce_account_charging-requests_endpoint', function () {
    if ( ! is_user_logged_in() ) { return; }
    evpower_assets();
    $records = get_posts( array( 'post_type' => 'ev_booking', 'post_status' => 'private', 'author' => get_current_user_id(), 'numberposts' => 50, 'orderby' => 'date', 'order' => 'DESC' ) );
    echo '<h2>Your charging requests</h2><p>Requests become appointments only after our team confirms the details.</p>';
    foreach ( $records as $record ) {
        echo '<article class="ep-account-booking"><h3>' . esc_html( get_post_meta( $record->ID, '_ev_service', true ) ) . '</h3><p>' . esc_html( get_post_meta( $record->ID, '_ev_preferred_date', true ) . ' · ' . get_post_meta( $record->ID, '_ev_preferred_time', true ) ) . '</p><p>' . esc_html( get_post_meta( $record->ID, '_ev_location', true ) ) . '</p><p>Status: <strong>' . esc_html( get_post_meta( $record->ID, '_ev_status', true ) ) . '</strong></p></article>';
    }
    if ( ! $records ) { echo '<p>No charging requests yet.</p>'; }
    echo '<p><a href="' . esc_url( evpower_page_url( 'booking' ) ) . '">Request charging ↗</a></p>';
} );

add_action( 'woocommerce_after_order_notes', function ( $checkout ) {
    woocommerce_form_field( 'evpower_installation', array( 'type' => 'checkbox', 'label' => 'Request an installation quote (quoted separately; not included in this order total)', 'required' => false ), $checkout->get_value( 'evpower_installation' ) );
} );
add_action( 'woocommerce_checkout_create_order', function ( $order, $data ) {
    if ( ! empty( $_POST['evpower_installation'] ) ) { $order->update_meta_data( '_evpower_installation', 'Requested — quote separately' ); }
}, 10, 2 );
add_action( 'woocommerce_admin_order_data_after_billing_address', function ( $order ) {
    if ( $order->get_meta( '_evpower_installation' ) ) { echo '<p><strong>Installation:</strong> ' . esc_html( $order->get_meta( '_evpower_installation' ) ) . '</p>'; }
} );

function evpower_receipt_link( $order ) {
    if ( ! $order || ! $order->is_paid() ) { return; }
    $url = add_query_arg( array( 'action' => 'evpower_receipt', 'order_id' => $order->get_id(), 'key' => $order->get_order_key() ), admin_url( 'admin-post.php' ) );
    echo '<p><a class="ep-invoice-link" target="_blank" rel="noopener noreferrer" href="' . esc_url( $url ) . '">Print payment receipt ↗</a></p>';
}
add_action( 'woocommerce_order_details_after_order_table', 'evpower_receipt_link' );
function evpower_print_receipt() {
    $order = function_exists( 'wc_get_order' ) ? wc_get_order( absint( $_GET['order_id'] ?? 0 ) ) : false;
    $key = sanitize_text_field( wp_unslash( $_GET['key'] ?? '' ) );
    $owns = $order && $order->get_customer_id() > 0 && get_current_user_id() === $order->get_customer_id();
    $guest = $order && 0 === $order->get_customer_id() && $key && hash_equals( $order->get_order_key(), $key );
    if ( ! $order || ! $order->is_paid() || ( ! $owns && ! $guest && ! current_user_can( 'manage_woocommerce' ) ) ) { wp_die( 'Receipt unavailable.', '', array( 'response' => 403 ) ); }
    nocache_headers(); header( 'X-Robots-Tag: noindex, nofollow', true ); header( 'Referrer-Policy: no-referrer', true );
    ?>
    <!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Evpower payment receipt</title><style>body{font:16px/1.7 system-ui;color:#183330;margin:40px auto;max-width:800px;padding:20px}h1{letter-spacing:-1px}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #ddd;padding:12px 0}button{padding:10px 18px;border:0;background:#c4f06b;border-radius:6px;cursor:pointer}@media print{button{display:none}body{margin:0}}</style></head><body>
    <h1><?php echo esc_html( get_bloginfo( 'name' ) ); ?></h1><h2>Payment receipt #<?php echo esc_html( $order->get_order_number() ); ?></h2>
    <p><?php echo esc_html( $order->get_formatted_billing_full_name() ); ?><br><?php echo esc_html( $order->get_billing_email() ); ?></p>
    <table><thead><tr><th>Item</th><th>Quantity</th><th>Amount</th></tr></thead><tbody>
    <?php foreach ( $order->get_items() as $item ) : ?><tr><td><?php echo esc_html( $item->get_name() ); ?></td><td><?php echo (int) $item->get_quantity(); ?></td><td><?php echo wp_kses_post( $order->get_formatted_line_subtotal( $item ) ); ?></td></tr><?php endforeach; ?>
    </tbody><tfoot><?php foreach ( $order->get_order_item_totals() as $total ) : ?><tr><th colspan="2"><?php echo esc_html( $total['label'] ); ?></th><td><?php echo wp_kses_post( $total['value'] ); ?></td></tr><?php endforeach; ?></tfoot></table>
    <p>Paid via <?php echo esc_html( $order->get_payment_method_title() ); ?>.</p><p>This is a payment receipt. Request any required statutory tax invoice from Evpower.</p><button onclick="window.print()">Print receipt</button></body></html>
    <?php exit;
}
add_action( 'admin_post_evpower_receipt', 'evpower_print_receipt' );
add_action( 'admin_post_nopriv_evpower_receipt', 'evpower_print_receipt' );
