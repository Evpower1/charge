<?php
/**
 * Title: Evpower / Charger Supply
 * Slug: evpower/service-supply
 * Categories: evpower
 * Inserter: yes
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
<!-- wp:group {"className":"evs-page evs-service evs-service-supply","layout":{"type":"default"}} -->
<div class="wp-block-group evs-page evs-service evs-service-supply">
<!-- wp:group {"className":"evs-section evs-page-intro","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-section evs-page-intro">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:paragraph {"className":"evs-eyebrow"} -->
<p class="evs-eyebrow">CHARGER SUPPLY</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">The right charger starts with your needs.</h1>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-lead"} -->
<p class="evs-lead">Explore charging equipment for your home, workplace or business. We help you compare suitable options before you choose.</p>
<!-- /wp:paragraph -->
<!-- wp:buttons {"className":"evs-buttons"} -->
<div class="wp-block-buttons evs-buttons">
<!-- wp:button {"className":"evs-button-primary"} -->
<div class="wp-block-button evs-button-primary"><a class="wp-block-button__link wp-element-button" href="<?php echo esc_url( add_query_arg( 'service', 'supply', $evs_url( 'quote' ) ) ); ?>">Request a quote</a></div>
<!-- /wp:button -->
<!-- wp:button {"className":"evs-button-outline"} -->
<div class="wp-block-button evs-button-outline"><a class="wp-block-button__link wp-element-button" href="tel:+251911049916">Call our team</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->
</div>
<!-- /wp:group -->
</section>
<!-- /wp:group -->
<!-- wp:group {"className":"evs-section","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-section">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:columns {"className":"evs-two-grid"} -->
<div class="wp-block-columns evs-two-grid">
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-section-heading","layout":{"type":"default"}} -->
<div class="wp-block-group evs-section-heading">
<!-- wp:paragraph {"className":"evs-eyebrow"} -->
<p class="evs-eyebrow">IS THIS FOR YOU?</p>
<!-- /wp:paragraph -->
<!-- wp:heading -->
<h2 class="wp-block-heading">Make a confident equipment choice.</h2>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-lead"} -->
<p class="evs-lead">A charger should work with your vehicle and the electricity available at your property. Share how and where you plan to charge so we can discuss a suitable setup.</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-card","layout":{"type":"default"}} -->
<div class="wp-block-group evs-card">
<!-- wp:heading {"level":3,"className":"evs-card-title"} -->
<h3 class="wp-block-heading evs-card-title">What to expect</h3>
<!-- /wp:heading -->
<!-- wp:list {"className":"evs-check-list"} -->
<ul class="wp-block-list evs-check-list">
<!-- wp:list-item -->
<li>A discussion of vehicle compatibility and charging requirements.</li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li>Equipment options matched to the intended installation.</li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li>Confirmation of specifications, price, availability and applicable warranty terms.</li>
<!-- /wp:list-item -->
</ul>
<!-- /wp:list -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
</div>
<!-- /wp:columns -->
</div>
<!-- /wp:group -->
</section>
<!-- /wp:group -->
<!-- wp:group {"className":"evs-section evs-section-soft","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-section evs-section-soft">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:group {"className":"evs-section-heading","layout":{"type":"default"}} -->
<div class="wp-block-group evs-section-heading">
<!-- wp:paragraph {"className":"evs-eyebrow"} -->
<p class="evs-eyebrow">HOW IT WORKS</p>
<!-- /wp:paragraph -->
<!-- wp:heading -->
<h2 class="wp-block-heading">Three steps to the next charge.</h2>
<!-- /wp:heading -->
</div>
<!-- /wp:group -->
<!-- wp:columns {"className":"evs-three-grid"} -->
<div class="wp-block-columns evs-three-grid">
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-card evs-step","layout":{"type":"default"}} -->
<div class="wp-block-group evs-card evs-step">
<!-- wp:paragraph {"className":"evs-card-number"} -->
<p class="evs-card-number">01</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":3,"className":"evs-card-title"} -->
<h3 class="wp-block-heading evs-card-title">Describe your setup</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Tell us about your vehicle, parking space, electrical supply and daily charging needs.</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-card evs-step","layout":{"type":"default"}} -->
<div class="wp-block-group evs-card evs-step">
<!-- wp:paragraph {"className":"evs-card-number"} -->
<p class="evs-card-number">02</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":3,"className":"evs-card-title"} -->
<h3 class="wp-block-heading evs-card-title">Compare the options</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>We explain suitable equipment and confirm specifications, availability and pricing.</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-card evs-step","layout":{"type":"default"}} -->
<div class="wp-block-group evs-card evs-step">
<!-- wp:paragraph {"className":"evs-card-number"} -->
<p class="evs-card-number">03</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":3,"className":"evs-card-title"} -->
<h3 class="wp-block-heading evs-card-title">Plan delivery or installation</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Agree on supply arrangements and ask us about installation support if needed.</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
</div>
<!-- /wp:columns -->
<!-- wp:paragraph {"className":"evs-note"} -->
<p class="evs-note">Product availability, specifications, delivery and installation are confirmed in your quote. Equipment images are illustrative; confirm the exact product before purchasing.</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</section>
<!-- /wp:group -->
<!-- wp:group {"className":"evs-section","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-section">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:group {"className":"evs-form-panel","layout":{"type":"default"}} -->
<div class="wp-block-group evs-form-panel">
<!-- wp:heading -->
<h2 class="wp-block-heading">Tell us what you need</h2>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-note"} -->
<p class="evs-note">Share a few details and our team will contact you to confirm the options. Your request is not a confirmed booking.</p>
<!-- /wp:paragraph -->
<!-- wp:shortcode -->
[evpower_service_request service="supply"]
<!-- /wp:shortcode -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:group -->
</section>
<!-- /wp:group -->
<!-- wp:group {"className":"evs-cta","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-cta">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:group {"className":"evs-cta-inner","layout":{"type":"default"}} -->
<div class="wp-block-group evs-cta-inner">
<!-- wp:group {"className":"evs-cta-copy","layout":{"type":"default"}} -->
<div class="wp-block-group evs-cta-copy">
<!-- wp:heading -->
<h2 class="wp-block-heading">Have a question before you request?</h2>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Call or message our team. We’ll help you decide which service to ask for.</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
<!-- wp:buttons {"className":"evs-buttons"} -->
<div class="wp-block-buttons evs-buttons">
<!-- wp:button {"className":"evs-button-primary"} -->
<div class="wp-block-button evs-button-primary"><a class="wp-block-button__link wp-element-button" href="<?php echo esc_url( $evs_url( 'quote' ) ); ?>">Request a quote</a></div>
<!-- /wp:button -->
<!-- wp:button {"className":"evs-button-outline"} -->
<div class="wp-block-button evs-button-outline"><a class="wp-block-button__link wp-element-button" href="tel:+251911049916">Call Evpower</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:group -->
</section>
<!-- /wp:group -->
</div>
<!-- /wp:group -->
