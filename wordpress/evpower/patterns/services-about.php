<?php
/**
 * Title: Evpower / About Evpower
 * Slug: evpower/services-about
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
<!-- wp:group {"className":"evs-page evs-about","layout":{"type":"default"}} -->
<div class="wp-block-group evs-page evs-about">
<!-- wp:group {"className":"evs-section evs-page-intro","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-section evs-page-intro">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:paragraph {"className":"evs-eyebrow"} -->
<p class="evs-eyebrow">ABOUT EVPOWER</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">Powering everyday journeys.</h1>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-lead"} -->
<p class="evs-lead">Evpower provides mobile EV charging, charger supply, installation and maintenance in Ethiopia. We bring the support around charging together, so it is easier to take the next step.</p>
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
<!-- wp:group {"className":"evs-section-heading","layout":{"type":"default"}} -->
<div class="wp-block-group evs-section-heading">
<!-- wp:paragraph {"className":"evs-eyebrow"} -->
<p class="evs-eyebrow">OUR PURPOSE</p>
<!-- /wp:paragraph -->
<!-- wp:heading -->
<h2 class="wp-block-heading">Make electric mobility more practical.</h2>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-lead"} -->
<p class="evs-lead">Electric vehicles need useful, accessible charging support. We focus on the equipment, advice and services that help people charge with confidence.</p>
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
<h3 class="wp-block-heading evs-card-title">Based in Addis Ababa</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>We work with drivers, property owners and businesses to understand their charging requirements. Service coverage and arrangements are confirmed for each request.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph {"className":"evs-text-link"} -->
<p class="evs-text-link"><a href="<?php echo esc_url( $evs_url( 'contact' ) ); ?>">Talk to our team &rarr;</a></p>
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
<!-- wp:group {"className":"evs-section-heading","layout":{"type":"default"}} -->
<div class="wp-block-group evs-section-heading">
<!-- wp:paragraph {"className":"evs-eyebrow"} -->
<p class="evs-eyebrow">WHAT GUIDES US</p>
<!-- /wp:paragraph -->
<!-- wp:heading -->
<h2 class="wp-block-heading">Clear advice. Thoughtful service.</h2>
<!-- /wp:heading -->
</div>
<!-- /wp:group -->
<!-- wp:columns {"className":"evs-three-grid"} -->
<div class="wp-block-columns evs-three-grid">
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-card","layout":{"type":"default"}} -->
<div class="wp-block-group evs-card">
<!-- wp:heading {"level":3,"className":"evs-card-title"} -->
<h3 class="wp-block-heading evs-card-title">Understand the need</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>We start with your vehicle, your site and the way you plan to charge.</p>
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
<h3 class="wp-block-heading evs-card-title">Explain the options</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>We aim to make specifications, scope and next steps clear before you commit.</p>
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
<h3 class="wp-block-heading evs-card-title">Support the journey</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>From choosing a charger to keeping it working, we look at the complete charging experience.</p>
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
<!-- wp:group {"className":"evs-section","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-section">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:group {"className":"evs-section-heading","layout":{"type":"default"}} -->
<div class="wp-block-group evs-section-heading">
<!-- wp:paragraph {"className":"evs-eyebrow"} -->
<p class="evs-eyebrow">LOOKING AHEAD</p>
<!-- /wp:paragraph -->
<!-- wp:heading -->
<h2 class="wp-block-heading">A more connected electric future.</h2>
<!-- /wp:heading -->
</div>
<!-- /wp:group -->
<!-- wp:paragraph {"className":"evs-lead"} -->
<p class="evs-lead">Our vision is to help make EV charging a dependable part of everyday life in Ethiopia. By supporting the move toward electric transportation, we want to contribute to cleaner, more practical journeys.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>If you manage a property, operate vehicles or want to explore a business partnership, we’d like to hear from you.</p>
<!-- /wp:paragraph -->
<!-- wp:buttons {"className":"evs-buttons"} -->
<div class="wp-block-buttons evs-buttons">
<!-- wp:button {"className":"evs-button-primary"} -->
<div class="wp-block-button evs-button-primary"><a class="wp-block-button__link wp-element-button" href="<?php echo esc_url( $evs_url( 'contact' ) ); ?>">Discuss a partnership</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->
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
<h2 class="wp-block-heading">Let’s find the right charging solution.</h2>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Tell us about your vehicle, property or business. We’ll help you plan the next step.</p>
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
