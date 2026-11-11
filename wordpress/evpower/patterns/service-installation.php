<?php
/**
 * Title: Evpower / Charger Installation
 * Slug: evpower/service-installation
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
<!-- wp:group {"className":"evs-page evs-service evs-service-installation","layout":{"type":"default"}} -->
<div class="wp-block-group evs-page evs-service evs-service-installation">
<!-- wp:group {"className":"evs-section evs-page-intro","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-section evs-page-intro">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:columns {"className":"evs-hero-grid"} -->
<div class="wp-block-columns evs-hero-grid">
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-hero-copy","layout":{"type":"default"}} -->
<div class="wp-block-group evs-hero-copy">
<!-- wp:paragraph {"className":"evs-eyebrow"} -->
<p class="evs-eyebrow">CHARGER INSTALLATION</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">A charging setup that fits your space.</h1>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-lead"} -->
<p class="evs-lead">Plan EV charger installation for a home, workplace or commercial property, with the site and electrical requirements considered from the start.</p>
<!-- /wp:paragraph -->
<!-- wp:buttons {"className":"evs-buttons"} -->
<div class="wp-block-buttons evs-buttons">
<!-- wp:button {"className":"evs-button-primary"} -->
<div class="wp-block-button evs-button-primary"><a class="wp-block-button__link wp-element-button" href="<?php echo esc_url( add_query_arg( 'service', 'installation', $evs_url( 'quote' ) ) ); ?>">Request a quote</a></div>
<!-- /wp:button -->
<!-- wp:button {"className":"evs-button-outline"} -->
<div class="wp-block-button evs-button-outline"><a class="wp-block-button__link wp-element-button" href="tel:+251911049916">Call our team</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-hero-visual","layout":{"type":"default"}} -->
<div class="wp-block-group evs-hero-visual">
<!-- wp:image {"sizeSlug":"full","className":"evs-feature-image"} -->
<figure class="wp-block-image size-full evs-feature-image"><img src="<?php echo esc_url( get_theme_file_uri( 'assets/images/services-installation.png' ) ); ?>" alt="An EV charger beside a parked vehicle at a modern property"/></figure>
<!-- /wp:image -->
<!-- wp:paragraph {"className":"evs-hero-caption"} -->
<p class="evs-hero-caption">Illustration of an EV charging setup.</p>
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
<h2 class="wp-block-heading">Turn a parking space into a practical charging space.</h2>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-lead"} -->
<p class="evs-lead">We assess the planned charger location, electrical supply, cable route and access. The installation scope is agreed with you before work begins.</p>
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
<li>A review of the charger, site and available electrical supply.</li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li>An agreed installation scope and quote.</li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li>Installation arrangements, commissioning checks and a practical handover as specified in your quote.</li>
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
<h3 class="wp-block-heading evs-card-title">Tell us about the site</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Share your location, vehicle, charger requirements and photos of the proposed parking and supply areas.</p>
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
<h3 class="wp-block-heading evs-card-title">Assess and agree</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>We confirm whether a site visit is needed and explain the proposed scope and cost.</p>
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
<h3 class="wp-block-heading evs-card-title">Install and hand over</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>After approval, we arrange the work and explain how to use the installed equipment.</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
</div>
<!-- /wp:columns -->
<!-- wp:paragraph {"className":"evs-note"} -->
<p class="evs-note">Electrical upgrades, permissions, civil work and other site requirements depend on the property. We’ll identify these during assessment and include agreed work in the quote.</p>
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
[evpower_service_request service="installation"]
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
