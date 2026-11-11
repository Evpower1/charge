<?php
/**
 * Title: Evpower / Services overview
 * Slug: evpower/services-overview
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
<!-- wp:group {"className":"evs-page evs-services","layout":{"type":"default"}} -->
<div class="wp-block-group evs-page evs-services">
<!-- wp:group {"className":"evs-section evs-page-intro","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-section evs-page-intro">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:paragraph {"className":"evs-eyebrow"} -->
<p class="evs-eyebrow">OUR SERVICES</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">Charging support, from start to finish.</h1>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-lead"} -->
<p class="evs-lead">Get a charge when you need one, choose the right equipment, and keep it working. Evpower brings these services together in one place.</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</section>
<!-- /wp:group -->
<!-- wp:group {"className":"evs-section","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-section">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:columns {"className":"evs-service-grid"} -->
<div class="wp-block-columns evs-service-grid">
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-card","layout":{"type":"default"}} -->
<div class="wp-block-group evs-card">
<!-- wp:paragraph {"className":"evs-card-number"} -->
<p class="evs-card-number">01</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":3,"className":"evs-card-title"} -->
<h3 class="wp-block-heading evs-card-title"><a href="<?php echo esc_url( $evs_url( 'mobile' ) ); ?>">Mobile EV charging</a></h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>A charging service that comes to your vehicle. Tell us where you are and we’ll confirm coverage and compatibility.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph {"className":"evs-text-link"} -->
<p class="evs-text-link"><a href="<?php echo esc_url( $evs_url( 'mobile' ) ); ?>">Request mobile charging &rarr;</a></p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-card","layout":{"type":"default"}} -->
<div class="wp-block-group evs-card">
<!-- wp:paragraph {"className":"evs-card-number"} -->
<p class="evs-card-number">02</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":3,"className":"evs-card-title"} -->
<h3 class="wp-block-heading evs-card-title"><a href="<?php echo esc_url( $evs_url( 'supply' ) ); ?>">Charger supply</a></h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Choose charging equipment that suits your vehicle, power supply and everyday routine.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph {"className":"evs-text-link"} -->
<p class="evs-text-link"><a href="<?php echo esc_url( $evs_url( 'supply' ) ); ?>">Explore chargers &rarr;</a></p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-card","layout":{"type":"default"}} -->
<div class="wp-block-group evs-card">
<!-- wp:paragraph {"className":"evs-card-number"} -->
<p class="evs-card-number">03</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":3,"className":"evs-card-title"} -->
<h3 class="wp-block-heading evs-card-title"><a href="<?php echo esc_url( $evs_url( 'installation' ) ); ?>">Charger installation</a></h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Plan a practical charging setup for your home, workplace or commercial property.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph {"className":"evs-text-link"} -->
<p class="evs-text-link"><a href="<?php echo esc_url( $evs_url( 'installation' ) ); ?>">Plan an installation &rarr;</a></p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-card","layout":{"type":"default"}} -->
<div class="wp-block-group evs-card">
<!-- wp:paragraph {"className":"evs-card-number"} -->
<p class="evs-card-number">04</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":3,"className":"evs-card-title"} -->
<h3 class="wp-block-heading evs-card-title"><a href="<?php echo esc_url( $evs_url( 'maintenance' ) ); ?>">Charger maintenance</a></h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Keep your charging equipment in working order with assessment, servicing and repair support.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph {"className":"evs-text-link"} -->
<p class="evs-text-link"><a href="<?php echo esc_url( $evs_url( 'maintenance' ) ); ?>">Get maintenance support &rarr;</a></p>
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
<p class="evs-eyebrow">HOMES, WORKPLACES & BUSINESSES</p>
<!-- /wp:paragraph -->
<!-- wp:heading -->
<h2 class="wp-block-heading">Tell us how you use your EV.</h2>
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
<h3 class="wp-block-heading evs-card-title">For your daily drive</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Explore mobile charging support or a convenient charging setup where you park.</p>
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
<h3 class="wp-block-heading evs-card-title">For your property</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Plan charger supply and installation around your parking layout and electrical capacity.</p>
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
<h3 class="wp-block-heading evs-card-title">For your operations</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Discuss equipment, charging needs and maintenance for business vehicles or shared parking.</p>
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
<p class="evs-eyebrow">BEFORE WE START</p>
<!-- /wp:paragraph -->
<!-- wp:heading -->
<h2 class="wp-block-heading">The details that help us help you.</h2>
<!-- /wp:heading -->
</div>
<!-- /wp:group -->
<!-- wp:list {"className":"evs-check-list"} -->
<ul class="wp-block-list evs-check-list">
<!-- wp:list-item -->
<li>Your vehicle make, model and charging connector.</li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li>Your location or installation site.</li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li>The service you need and your preferred timing.</li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li>For installed chargers: the charger model and the issue, if any.</li>
<!-- /wp:list-item -->
</ul>
<!-- /wp:list -->
<!-- wp:paragraph {"className":"evs-note"} -->
<p class="evs-note">We confirm service coverage and availability for each request. Photos of your charger, connector or site can help our team assess the next step.</p>
<!-- /wp:paragraph -->
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
