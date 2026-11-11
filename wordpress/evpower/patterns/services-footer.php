<?php
/**
 * Title: Evpower / Services site footer
 * Slug: evpower/services-footer
 * Categories: evpower
 * Inserter: yes
 * Block Types: core/template-part/footer
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
<!-- wp:group {"className":"evs-footer","layout":{"type":"default"}} -->
<div class="wp-block-group evs-footer">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:columns {"className":"evs-footer-grid"} -->
<div class="wp-block-columns evs-footer-grid">
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-footer-brand","layout":{"type":"default"}} -->
<div class="wp-block-group evs-footer-brand">
<!-- wp:image {"sizeSlug":"full","linkDestination":"custom","className":"evs-footer-logo"} -->
<figure class="wp-block-image size-full evs-footer-logo"><a href="<?php echo esc_url( $evs_url( 'home' ) ); ?>"><img src="<?php echo esc_url( get_theme_file_uri( 'assets/images/evpower-logo.png' ) ); ?>" alt="Evpower — home"/></a></figure>
<!-- /wp:image -->
<!-- wp:paragraph -->
<p>Charging made simple.<br>Supporting your electric journey.</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-footer-column","layout":{"type":"default"}} -->
<div class="wp-block-group evs-footer-column">
<!-- wp:paragraph {"className":"evs-footer-heading"} -->
<p class="evs-footer-heading">Services</p>
<!-- /wp:paragraph -->
<!-- wp:list {"className":"evs-footer-links"} -->
<ul class="wp-block-list evs-footer-links">
<!-- wp:list-item -->
<li><a href="<?php echo esc_url( $evs_url( 'mobile' ) ); ?>">Mobile EV charging</a></li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li><a href="<?php echo esc_url( $evs_url( 'supply' ) ); ?>">Charger supply</a></li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li><a href="<?php echo esc_url( $evs_url( 'installation' ) ); ?>">Installation</a></li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li><a href="<?php echo esc_url( $evs_url( 'maintenance' ) ); ?>">Maintenance</a></li>
<!-- /wp:list-item -->
</ul>
<!-- /wp:list -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-footer-column","layout":{"type":"default"}} -->
<div class="wp-block-group evs-footer-column">
<!-- wp:paragraph {"className":"evs-footer-heading"} -->
<p class="evs-footer-heading">Company</p>
<!-- /wp:paragraph -->
<!-- wp:list {"className":"evs-footer-links"} -->
<ul class="wp-block-list evs-footer-links">
<!-- wp:list-item -->
<li><a href="<?php echo esc_url( $evs_url( 'about' ) ); ?>">About Evpower</a></li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li><a href="<?php echo esc_url( $evs_url( 'contact' ) ); ?>">Contact us</a></li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li><a href="<?php echo esc_url( $evs_url( 'quote' ) ); ?>">Request a quote</a></li>
<!-- /wp:list-item -->
<?php $evs_pages = get_option( 'evpower_services_pages', array() ); if ( ! empty( $evs_pages['privacy'] ) && 'publish' === get_post_status( $evs_pages['privacy'] ) ) : ?>
<!-- wp:list-item -->
<li><a href="<?php echo esc_url( $evs_url( 'privacy' ) ); ?>">Privacy notice</a></li>
<!-- /wp:list-item -->
<?php endif; ?>
</ul>
<!-- /wp:list -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-footer-column","layout":{"type":"default"}} -->
<div class="wp-block-group evs-footer-column">
<!-- wp:paragraph {"className":"evs-footer-heading"} -->
<p class="evs-footer-heading">Contact</p>
<!-- /wp:paragraph -->
<!-- wp:list {"className":"evs-footer-links"} -->
<ul class="wp-block-list evs-footer-links">
<!-- wp:list-item -->
<li><a href="tel:+251911049916">+251 911 049 916</a></li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li><a href="tel:8890">8890 · Toll-free</a></li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li><a href="https://wa.me/251911049916">WhatsApp</a></li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li><a href="mailto:info@evpower.et">info@evpower.et</a></li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li>Addis Ababa, Ethiopia</li>
<!-- /wp:list-item -->
</ul>
<!-- /wp:list -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
</div>
<!-- /wp:columns -->
<!-- wp:group {"className":"evs-footer-bottom","layout":{"type":"default"}} -->
<div class="wp-block-group evs-footer-bottom">
<!-- wp:paragraph -->
<p>© <?php echo esc_html( wp_date( 'Y' ) ); ?> Evpower. All rights reserved.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>Mobile charging · Charger supply · Installation · Maintenance</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:group -->
