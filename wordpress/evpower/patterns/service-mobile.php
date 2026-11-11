<?php
/**
 * Title: Evpower / Mobile Ev Charging
 * Slug: evpower/service-mobile
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
<!-- wp:group {"className":"evs-page evs-service evs-service-mobile","layout":{"type":"default"}} -->
<div class="wp-block-group evs-page evs-service evs-service-mobile">
<!-- wp:group {"className":"evs-section evs-page-intro","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-section evs-page-intro">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:paragraph {"className":"evs-eyebrow"} -->
<p class="evs-eyebrow">MOBILE EV CHARGING</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">Charging that comes to you.</h1>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-lead"} -->
<p class="evs-lead">Request mobile EV charging for your vehicle. We’ll check your location, connector and charging needs before confirming the service.</p>
<!-- /wp:paragraph -->
<!-- wp:buttons {"className":"evs-buttons"} -->
<div class="wp-block-buttons evs-buttons">
<!-- wp:button {"className":"evs-button-primary"} -->
<div class="wp-block-button evs-button-primary"><a class="wp-block-button__link wp-element-button" href="<?php echo esc_url( add_query_arg( 'service', 'mobile', $evs_url( 'quote' ) ) ); ?>">Request mobile charging</a></div>
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
<h2 class="wp-block-heading">When you need a charge away from your usual charger.</h2>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-lead"} -->
<p class="evs-lead">Whether you are parked at home, at work or at another accessible location, tell us what you need. Our team will confirm whether we can provide a suitable charging service.</p>
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
<li>A review of your location and vehicle charging connection.</li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li>Confirmation of service availability and the proposed charge.</li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li>A quote and agreed arrangements before a visit.</li>
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
<h3 class="wp-block-heading evs-card-title">Share your details</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Send your location, vehicle model, connector type and current battery level if known.</p>
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
<h3 class="wp-block-heading evs-card-title">Confirm the service</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>We check coverage, access and compatibility, then confirm the cost and proposed timing.</p>
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
<h3 class="wp-block-heading evs-card-title">Arrange your charge</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Approve the details with our team before the charging visit is scheduled.</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
</div>
<!-- /wp:columns -->
<!-- wp:paragraph {"className":"evs-note"} -->
<p class="evs-note">Coverage, compatibility and timing are confirmed per request. For an immediate road safety emergency, contact the appropriate local emergency service.</p>
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
[evpower_service_request service="mobile"]
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
