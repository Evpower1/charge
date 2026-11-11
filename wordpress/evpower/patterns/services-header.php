<?php
/**
 * Title: Evpower / Services site header
 * Slug: evpower/services-header
 * Categories: evpower
 * Inserter: yes
 * Block Types: core/template-part/header
 */
defined( 'ABSPATH' ) || exit;
$evs_url = static function ( $key ) {
    if ( function_exists( 'evpower_services_page_url' ) ) {
        return evpower_services_page_url( $key );
    }
    $paths = array( 'home' => '/', 'services' => '/services/', 'mobile' => '/mobile-ev-charging/', 'supply' => '/charger-supply/', 'installation' => '/charger-installation/', 'maintenance' => '/charger-maintenance/', 'about' => '/about/', 'contact' => '/contact/', 'quote' => '/request-a-quote/', 'privacy' => '/privacy/' );
    return home_url( $paths[ $key ] ?? '/' );
};
?>
<!-- wp:group {"className":"evs-header","layout":{"type":"default"}} -->
<div class="wp-block-group evs-header">
<!-- wp:group {"className":"evs-container evs-header-inner","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container evs-header-inner">
<!-- wp:image {"sizeSlug":"full","linkDestination":"custom","className":"evs-brand-image"} -->
<figure class="wp-block-image size-full evs-brand-image"><a href="<?php echo esc_url( $evs_url( 'home' ) ); ?>"><img src="<?php echo esc_url( get_theme_file_uri( 'assets/images/evpower-logo.png' ) ); ?>" alt="Evpower — home"/></a></figure>
<!-- /wp:image -->
<!-- wp:navigation {"overlayMenu":"mobile","className":"evs-navigation","layout":{"type":"flex","justifyContent":"center"}} -->
<!-- wp:navigation-link <?php echo wp_json_encode( array( 'label' => 'Home', 'url' => $evs_url( 'home' ), 'kind' => 'custom' ) ); ?> /-->
<!-- wp:navigation-link <?php echo wp_json_encode( array( 'label' => 'Services', 'url' => $evs_url( 'services' ), 'kind' => 'custom' ) ); ?> /-->
<!-- wp:navigation-link <?php echo wp_json_encode( array( 'label' => 'About', 'url' => $evs_url( 'about' ), 'kind' => 'custom' ) ); ?> /-->
<!-- wp:navigation-link <?php echo wp_json_encode( array( 'label' => 'Contact', 'url' => $evs_url( 'contact' ), 'kind' => 'custom' ) ); ?> /-->
<!-- /wp:navigation -->
<!-- wp:group {"className":"evs-header-actions","layout":{"type":"default"}} -->
<div class="wp-block-group evs-header-actions">
<?php if ( function_exists( 'wc_get_cart_url' ) ) : ?>
<!-- wp:paragraph {"className":"evs-cart"} -->
<p class="evs-cart"><a href="<?php echo esc_url( wc_get_cart_url() ); ?>">Cart</a></p>
<!-- /wp:paragraph -->
<?php endif; ?>
<!-- wp:buttons {"className":"evs-buttons"} -->
<div class="wp-block-buttons evs-buttons">
<!-- wp:button {"className":"evs-button-primary"} -->
<div class="wp-block-button evs-button-primary"><a class="wp-block-button__link wp-element-button" href="<?php echo esc_url( $evs_url( 'quote' ) ); ?>">Request a quote</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:group -->
