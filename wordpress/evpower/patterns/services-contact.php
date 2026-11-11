<?php
/**
 * Title: Evpower / Contact Evpower
 * Slug: evpower/services-contact
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
<!-- wp:group {"className":"evs-page evs-contact","layout":{"type":"default"}} -->
<div class="wp-block-group evs-page evs-contact">
<!-- wp:group {"className":"evs-section evs-page-intro","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-section evs-page-intro">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:paragraph {"className":"evs-eyebrow"} -->
<p class="evs-eyebrow">CONTACT US</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">Let’s talk charging.</h1>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-lead"} -->
<p class="evs-lead">Ask about a service, discuss a charger for your property or start a business partnership conversation. We’ll help you find the next step.</p>
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
<!-- wp:group {"className":"evs-card evs-contact-card","layout":{"type":"default"}} -->
<div class="wp-block-group evs-card evs-contact-card">
<!-- wp:heading {"level":3,"className":"evs-card-title"} -->
<h3 class="wp-block-heading evs-card-title">Speak with Evpower</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p><a href="tel:+251911049916">+251 911 049 916</a></p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>Toll-free: <a href="tel:8890">8890</a></p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p><a href="https://wa.me/251911049916">Message us on WhatsApp &rarr;</a></p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-card evs-contact-card","layout":{"type":"default"}} -->
<div class="wp-block-group evs-card evs-contact-card">
<!-- wp:heading {"level":3,"className":"evs-card-title"} -->
<h3 class="wp-block-heading evs-card-title">Email & location</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p><a href="mailto:info@evpower.et">info@evpower.et</a></p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>Addis Ababa, Ethiopia</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph {"className":"evs-note"} -->
<p class="evs-note">Please contact us before visiting to confirm arrangements.</p>
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
<!-- wp:group {"className":"evs-section evs-section-soft","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-section evs-section-soft">
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
[evpower_service_request]
<!-- /wp:shortcode -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:group -->
</section>
<!-- /wp:group -->
<!-- wp:group {"className":"evs-section","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-section">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:group {"className":"evs-section-heading","layout":{"type":"default"}} -->
<div class="wp-block-group evs-section-heading">
<!-- wp:paragraph {"className":"evs-eyebrow"} -->
<p class="evs-eyebrow">FOR BUSINESSES & PARTNERS</p>
<!-- /wp:paragraph -->
<!-- wp:heading -->
<h2 class="wp-block-heading">Have a project in mind?</h2>
<!-- /wp:heading -->
</div>
<!-- /wp:group -->
<!-- wp:paragraph {"className":"evs-lead"} -->
<p class="evs-lead">Tell us about your property, vehicles or proposed partnership. Include your location and a short description so the right person can follow up.</p>
<!-- /wp:paragraph -->
<!-- wp:buttons {"className":"evs-buttons"} -->
<div class="wp-block-buttons evs-buttons">
<!-- wp:button {"className":"evs-button-primary"} -->
<div class="wp-block-button evs-button-primary"><a class="wp-block-button__link wp-element-button" href="mailto:info@evpower.et">Email our team</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->
</div>
<!-- /wp:group -->
</section>
<!-- /wp:group -->
</div>
<!-- /wp:group -->
