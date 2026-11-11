<?php
/**
 * Title: Evpower / Request a quote
 * Slug: evpower/services-quote
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
<!-- wp:group {"className":"evs-page evs-quote","layout":{"type":"default"}} -->
<div class="wp-block-group evs-page evs-quote">
<!-- wp:group {"className":"evs-section evs-page-intro","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-section evs-page-intro">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:paragraph {"className":"evs-eyebrow"} -->
<p class="evs-eyebrow">START A REQUEST</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">What can we help you with?</h1>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-lead"} -->
<p class="evs-lead">Tell us whether you need mobile charging, equipment, installation or maintenance. We’ll review the details and contact you to discuss a suitable option.</p>
<!-- /wp:paragraph -->
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
<!-- wp:group {"anchor":"service-request","className":"evs-form-panel","layout":{"type":"default"}} -->
<div id="service-request" class="wp-block-group evs-form-panel">
<!-- wp:heading -->
<h2 class="wp-block-heading">Tell us what you need</h2>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-note"} -->
<p class="evs-note">Share a few details and our team will contact you to confirm the options. Your request is not a confirmed booking.</p>
<!-- /wp:paragraph -->
<!-- wp:shortcode -->
[evpower_service_request]
<!-- /wp:shortcode -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-card","layout":{"type":"default"}} -->
<div class="wp-block-group evs-card">
<!-- wp:heading {"level":3,"className":"evs-card-title"} -->
<h3 class="wp-block-heading evs-card-title">Helpful details to include</h3>
<!-- /wp:heading -->
<!-- wp:list {"className":"evs-check-list"} -->
<ul class="wp-block-list evs-check-list">
<!-- wp:list-item -->
<li>Your vehicle make, model and connector type.</li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li>The service location or installation site.</li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li>For supply or installation: how and where you want to charge.</li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li>For maintenance: charger model and a description of the issue.</li>
<!-- /wp:list-item -->
</ul>
<!-- /wp:list -->
<!-- wp:paragraph {"className":"evs-note"} -->
<p class="evs-note">Submitting this form does not confirm a booking or payment. Our team will confirm coverage, compatibility, availability and a quote with you.</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Prefer to speak with us?</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p><a href="tel:+251911049916">Call +251 911 049 916</a><br><a href="https://wa.me/251911049916">Message on WhatsApp</a></p>
<!-- /wp:paragraph -->
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
</div>
<!-- /wp:group -->
