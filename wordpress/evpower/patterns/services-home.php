<?php
/**
 * Title: Evpower / Services home page
 * Slug: evpower/services-home
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
<!-- wp:group {"className":"evs-page evs-home","layout":{"type":"default"}} -->
<div class="wp-block-group evs-page evs-home">
<!-- wp:group {"className":"evs-section evs-hero","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-section evs-hero">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:columns {"className":"evs-hero-grid"} -->
<div class="wp-block-columns evs-hero-grid">
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-hero-copy","layout":{"type":"default"}} -->
<div class="wp-block-group evs-hero-copy">
<!-- wp:paragraph {"className":"evs-eyebrow"} -->
<p class="evs-eyebrow">EVPOWER · ADDIS ABABA, ETHIOPIA</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">EV charging, made simple.</h1>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-lead"} -->
<p class="evs-lead">Mobile EV charging, charger supply, installation and maintenance. Practical support for your vehicle, your property and your business.</p>
<!-- /wp:paragraph -->
<!-- wp:buttons {"className":"evs-buttons"} -->
<div class="wp-block-buttons evs-buttons">
<!-- wp:button {"className":"evs-button-primary"} -->
<div class="wp-block-button evs-button-primary"><a class="wp-block-button__link wp-element-button" href="<?php echo esc_url( $evs_url( 'quote' ) ); ?>">Request a quote</a></div>
<!-- /wp:button -->
<!-- wp:button {"className":"evs-button-outline"} -->
<div class="wp-block-button evs-button-outline"><a class="wp-block-button__link wp-element-button" href="<?php echo esc_url( $evs_url( 'services' ) ); ?>">Explore our services</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->
<!-- wp:paragraph {"className":"evs-note"} -->
<p class="evs-note">Need to speak with us? <a href="tel:+251911049916">+251 911 049 916</a></p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"className":"evs-hero-visual","layout":{"type":"default"}} -->
<div class="wp-block-group evs-hero-visual">
<!-- wp:image {"sizeSlug":"full","className":"evs-hero-image"} -->
<figure class="wp-block-image size-full evs-hero-image"><img src="<?php echo esc_url( get_theme_file_uri( 'assets/images/services-hero.png' ) ); ?>" alt="An electric vehicle connected to a charging station"/></figure>
<!-- /wp:image -->
<!-- wp:paragraph {"className":"evs-hero-caption"} -->
<p class="evs-hero-caption">Charging solutions for the way you move.</p>
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
<p class="evs-eyebrow">OUR SERVICES</p>
<!-- /wp:paragraph -->
<!-- wp:heading -->
<h2 class="wp-block-heading">One partner for your charging needs.</h2>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-lead"} -->
<p class="evs-lead">From a charge on the go to a charger of your own, start with the service that fits.</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
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
<p class="evs-eyebrow">HOW IT WORKS</p>
<!-- /wp:paragraph -->
<!-- wp:heading -->
<h2 class="wp-block-heading">A clear path from request to charging.</h2>
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
<h3 class="wp-block-heading evs-card-title">Tell us what you need</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Share your vehicle, location and the service you’re looking for.</p>
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
<h3 class="wp-block-heading evs-card-title">We confirm the details</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>We check compatibility, coverage and the scope of work, then explain the options and cost.</p>
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
<h3 class="wp-block-heading evs-card-title">We agree the next step</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Once you approve the quote, we arrange the service or installation with you.</p>
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
<p class="evs-eyebrow">BUILT AROUND YOUR NEEDS</p>
<!-- /wp:paragraph -->
<!-- wp:heading -->
<h2 class="wp-block-heading">Useful advice. A practical solution.</h2>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-lead"} -->
<p class="evs-lead">Charging should fit your day, your vehicle and your space. Our team helps you make an informed choice.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph {"className":"evs-text-link"} -->
<p class="evs-text-link"><a href="<?php echo esc_url( $evs_url( 'about' ) ); ?>">Get to know Evpower &rarr;</a></p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:list {"className":"evs-check-list"} -->
<ul class="wp-block-list evs-check-list">
<!-- wp:list-item -->
<li>Vehicle compatibility checked before a service is confirmed.</li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li>Equipment recommendations based on your actual charging needs.</li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li>A clear scope and quote before work starts.</li>
<!-- /wp:list-item -->
<!-- wp:list-item -->
<li>Support for mobile charging and installed equipment.</li>
<!-- /wp:list-item -->
</ul>
<!-- /wp:list -->
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
<p class="evs-eyebrow">COMMON QUESTIONS</p>
<!-- /wp:paragraph -->
<!-- wp:heading -->
<h2 class="wp-block-heading">A little clarity before you start.</h2>
<!-- /wp:heading -->
</div>
<!-- /wp:group -->
<!-- wp:group {"className":"evs-faq-list","layout":{"type":"default"}} -->
<div class="wp-block-group evs-faq-list">
<!-- wp:details {"className":"evs-faq"} -->
<details class="wp-block-details evs-faq"><summary>Can you charge my EV at my location?</summary>
<!-- wp:paragraph -->
<p>Send us your location, vehicle model and charging connector details. We’ll confirm whether mobile charging is available and suitable before arranging a visit.</p>
<!-- /wp:paragraph -->
</details>
<!-- /wp:details -->
<!-- wp:details {"className":"evs-faq"} -->
<details class="wp-block-details evs-faq"><summary>Which charger is right for my home or business?</summary>
<!-- wp:paragraph -->
<p>That depends on your vehicle, electrical supply, parking space and usage. We can discuss your requirements and recommend equipment after checking those details.</p>
<!-- /wp:paragraph -->
</details>
<!-- /wp:details -->
<!-- wp:details {"className":"evs-faq"} -->
<details class="wp-block-details evs-faq"><summary>Do you install and maintain chargers?</summary>
<!-- wp:paragraph -->
<p>Yes. You can request installation planning or maintenance support. We’ll confirm the scope, any site assessment needed and the quote before the work is agreed.</p>
<!-- /wp:paragraph -->
</details>
<!-- /wp:details -->
<!-- wp:details {"className":"evs-faq"} -->
<details class="wp-block-details evs-faq"><summary>Is an online request a confirmed booking?</summary>
<!-- wp:paragraph -->
<p>No. A request starts a conversation with our team. Coverage, compatibility, price and timing must be confirmed with you first.</p>
<!-- /wp:paragraph -->
</details>
<!-- /wp:details -->
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
