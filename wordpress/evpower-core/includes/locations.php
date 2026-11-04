<?php
defined( 'ABSPATH' ) || exit;

add_action( 'add_meta_boxes', function () {
    add_meta_box( 'evpower-station', 'Station information & verification', function ( $post ) {
        wp_nonce_field( 'evpower_station', 'evpower_station_nonce' );
        echo '<p>Only publish accurate station records. A verified label requires a dated source, hours, power, and connector information.</p><table class="form-table">';
        foreach ( array( 'city' => 'City (Addis Ababa or Adama)', 'area' => 'Area / landmark', 'latitude' => 'Latitude', 'longitude' => 'Longitude', 'power' => 'Charging power', 'connectors' => 'Connectors', 'hours' => 'Opening hours', 'status' => 'Status (Available, Planned, Temporarily unavailable)', 'source' => 'Verification source URL (HTTPS)', 'verified_date' => 'Verification date (YYYY-MM-DD)' ) as $key => $label ) {
            echo '<tr><th><label for="ev-' . esc_attr( $key ) . '">' . esc_html( $label ) . '</label></th><td><input class="regular-text" id="ev-' . esc_attr( $key ) . '" name="ev_station[' . esc_attr( $key ) . ']" value="' . esc_attr( get_post_meta( $post->ID, '_ev_' . $key, true ) ) . '" maxlength="400"></td></tr>';
        }
        echo '<tr><th>Verified</th><td><label><input name="ev_station[verified]" type="checkbox" value="1" ' . checked( get_post_meta( $post->ID, '_ev_verified', true ), '1', false ) . '> I have checked this station and supplied evidence.</label></td></tr></table>';
    }, 'ev_station' );
} );

function evpower_station_data( $input ) {
    $result = array();
    foreach ( array( 'city', 'area', 'power', 'connectors', 'hours', 'status', 'verified_date' ) as $key ) {
        $result[ $key ] = mb_substr( sanitize_text_field( is_scalar( $input[ $key ] ?? '' ) ? $input[ $key ] ?? '' : '' ), 0, 200 );
    }
    $result['source'] = esc_url_raw( is_scalar( $input['source'] ?? '' ) ? $input['source'] ?? '' : '', array( 'https' ) );
    foreach ( array( 'latitude' => 90, 'longitude' => 180 ) as $key => $limit ) {
        $value = filter_var( $input[ $key ] ?? null, FILTER_VALIDATE_FLOAT );
        if ( false === $value || $value < -$limit || $value > $limit ) { return new WP_Error( 'coordinates', 'Enter valid latitude and longitude values.' ); }
        $result[ $key ] = $value;
    }
    if ( ! in_array( $result['city'], array( 'Addis Ababa', 'Adama' ), true ) || ! in_array( $result['status'], array( 'Available', 'Planned', 'Temporarily unavailable' ), true ) ) { return new WP_Error( 'station', 'Choose Addis Ababa or Adama and a supported status.' ); }
    $date = DateTimeImmutable::createFromFormat( '!Y-m-d', $result['verified_date'], wp_timezone() );
    $evidence = $result['source'] && $date && $date->format( 'Y-m-d' ) === $result['verified_date'] && $date <= new DateTimeImmutable( 'today', wp_timezone() ) && $result['power'] && $result['connectors'] && $result['hours'];
    $result['verified'] = ! empty( $input['verified'] ) && $evidence ? '1' : '0';
    return $result;
}

add_action( 'save_post_ev_station', function ( $id ) {
    if ( wp_is_post_revision( $id ) || ! current_user_can( 'manage_options' ) || empty( $_POST['evpower_station_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['evpower_station_nonce'] ) ), 'evpower_station' ) ) { return; }
    $input = wp_unslash( $_POST['ev_station'] ?? array() );
    $data = is_array( $input ) ? evpower_station_data( $input ) : new WP_Error( 'station', 'Check station information.' );
    if ( is_wp_error( $data ) ) {
        update_post_meta( $id, '_ev_verified', '0' );
        set_transient( 'evpower_station_notice_' . get_current_user_id(), $data->get_error_message(), 60 ); return;
    }
    foreach ( $data as $key => $value ) { update_post_meta( $id, '_ev_' . $key, $value ); }
    if ( ! empty( $input['verified'] ) && '1' !== $data['verified'] ) { set_transient( 'evpower_station_notice_' . get_current_user_id(), 'Station saved as unverified. Complete the source URL, date, hours, power, and connector fields before verifying it.', 60 ); }
} );
add_action( 'admin_notices', function () {
    $key = 'evpower_station_notice_' . get_current_user_id(); $notice = get_transient( $key );
    if ( $notice ) { echo '<div class="notice notice-warning"><p>' . esc_html( $notice ) . '</p></div>'; delete_transient( $key ); }
} );

function evpower_location_shortcode() {
    evpower_assets();
    wp_enqueue_style( 'leaflet', EVPOWER_CORE_URL . 'assets/leaflet/leaflet.css', array(), '1.9.4' );
    wp_enqueue_script( 'leaflet', EVPOWER_CORE_URL . 'assets/leaflet/leaflet.js', array(), '1.9.4', true );
    wp_enqueue_script( 'evpower-map', EVPOWER_CORE_URL . 'assets/map.js', array( 'leaflet' ), EVPOWER_CORE_VERSION, true );
    $records = get_posts( array( 'post_type' => 'ev_station', 'post_status' => 'publish', 'numberposts' => 200, 'orderby' => 'title', 'order' => 'ASC' ) );
    $stations = array();
    foreach ( $records as $record ) {
        $meta = array(); foreach ( array( 'city', 'area', 'latitude', 'longitude', 'power', 'connectors', 'hours', 'status', 'verified', 'source', 'verified_date' ) as $key ) { $meta[ $key ] = get_post_meta( $record->ID, '_ev_' . $key, true ); }
        $checked = evpower_station_data( $meta );
        if ( is_wp_error( $checked ) ) { continue; }
        $stations[] = array_merge( $checked, array( 'id' => $record->ID, 'name' => get_the_title( $record ) ) );
    }
    ob_start(); ?>
    <div class="ep-locations" data-stations="<?php echo esc_attr( wp_json_encode( $stations ) ); ?>">
        <div class="ep-map-toolbar"><label>City<select class="ep-city-filter"><option value="">All cities</option><option>Addis Ababa</option><option>Adama</option></select></label><label class="ep-verified-label"><input class="ep-verified-filter" type="checkbox"> Verified only</label></div>
        <p class="ep-location-notice">A location is verified only when our team has supplied dated evidence. Contact the station to confirm current availability before travelling.</p>
        <div class="ep-map-layout"><div class="ep-station-results" aria-live="polite">
            <?php foreach ( $stations as $station ) : ?>
                <article class="ep-station" data-id="<?php echo (int) $station['id']; ?>" data-city="<?php echo esc_attr( $station['city'] ); ?>" data-verified="<?php echo esc_attr( $station['verified'] ); ?>">
                    <span class="ep-station-status"><?php echo esc_html( $station['status'] ); ?></span>
                    <h3><button type="button" class="ep-station-focus"><?php echo esc_html( $station['name'] ); ?> ↗</button></h3>
                    <p><?php echo esc_html( $station['city'] . ' · ' . $station['area'] ); ?></p><p><?php echo esc_html( $station['power'] . ' · ' . $station['connectors'] ); ?></p><p><?php echo esc_html( $station['hours'] ); ?></p>
                    <p class="ep-verification"><?php if ( '1' === $station['verified'] ) : ?><a href="<?php echo esc_url( $station['source'] ); ?>" target="_blank" rel="noopener noreferrer">Verified <?php echo esc_html( $station['verified_date'] ); ?> — source ↗</a><?php else : ?>Awaiting verification<?php endif; ?></p>
                    <a class="ep-directions" href="<?php echo esc_url( 'https://www.openstreetmap.org/?mlat=' . $station['latitude'] . '&mlon=' . $station['longitude'] . '#map=17/' . $station['latitude'] . '/' . $station['longitude'] ); ?>" target="_blank" rel="noopener noreferrer">Open location map ↗</a>
                </article>
            <?php endforeach; ?>
            <p class="ep-no-stations" <?php echo $stations ? 'hidden' : ''; ?>>No matching station records yet. Call <a href="tel:8890">8890</a> for charging assistance.</p>
        </div><div class="ep-leaflet-map" role="region" aria-label="Charging locations in Addis Ababa and Adama"></div></div>
        <noscript><p>The station list above works without JavaScript. Enable JavaScript for the interactive map and filters.</p></noscript>
    </div>
    <?php return ob_get_clean();
}
add_shortcode( 'evpower_locations', 'evpower_location_shortcode' );
