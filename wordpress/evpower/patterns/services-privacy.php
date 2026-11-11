<?php
/**
 * Title: Evpower / Privacy notice — owner review draft
 * Slug: evpower/services-privacy
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
<!-- wp:group {"className":"evs-page evs-privacy","layout":{"type":"default"}} -->
<div class="wp-block-group evs-page evs-privacy">
<!-- wp:group {"className":"evs-section evs-page-intro","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-section evs-page-intro">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:paragraph {"className":"evs-eyebrow"} -->
<p class="evs-eyebrow">PRIVACY</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">Your details, handled with care.</h1>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-lead"} -->
<p class="evs-lead">This draft explains how service enquiries on this website are intended to work. Evpower should review and complete this notice before the new website is made public.</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</section>
<!-- /wp:group -->
<!-- wp:group {"className":"evs-section","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group evs-section">
<!-- wp:group {"className":"evs-container","layout":{"type":"default"}} -->
<div class="wp-block-group evs-container">
<!-- wp:heading -->
<h2 class="wp-block-heading">Information you share</h2>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>When you send a request, you may provide your name, phone number, email, location, service choice and the details of your vehicle or charger. Please only include information needed to respond to your enquiry.</p>
<!-- /wp:paragraph -->
<!-- wp:heading -->
<h2 class="wp-block-heading">Why we use it</h2>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Evpower uses enquiry details to respond, check service requirements, prepare a quote and make arrangements that you agree with the team. Sending an enquiry does not create a confirmed booking.</p>
<!-- /wp:paragraph -->
<!-- wp:heading -->
<h2 class="wp-block-heading">Who to contact</h2>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>For questions about your details, contact Evpower at <a href="mailto:info@evpower.et">info@evpower.et</a> or <a href="tel:+251911049916">+251 911 049 916</a>.</p>
<!-- /wp:paragraph -->
<!-- wp:heading -->
<h2 class="wp-block-heading">Third-party services</h2>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Links to WhatsApp open a service operated by another provider. Its own privacy terms apply when you use it.</p>
<!-- /wp:paragraph -->
<!-- wp:heading -->
<h2 class="wp-block-heading">Owner review required</h2>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"evs-note"} -->
<p class="evs-note">Before publication, confirm the website’s actual enquiry storage and email providers, retention period, access controls, cookies, analytics, embedded services and any customer rights or legal requirements that apply. Update this notice so it accurately describes the live website.</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</section>
<!-- /wp:group -->
</div>
<!-- /wp:group -->
