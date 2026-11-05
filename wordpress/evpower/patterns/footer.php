<?php
/**
 * Title: Evpower / Light site footer
 * Slug: evpower/footer
 * Categories: evpower
 * Inserter: yes
 * Block Types: core/template-part/footer
 */
defined( 'ABSPATH' ) || exit;
?>
<!-- wp:group {"className":"ep-section ep-footer ep-footer-light","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group ep-section ep-footer ep-footer-light"><!-- wp:group {"className":"ep-container","layout":{"type":"default"}} -->
<div class="wp-block-group ep-container"><!-- wp:group {"className":"ep-footer-grid","layout":{"type":"default"}} -->
<div class="wp-block-group ep-footer-grid"><!-- wp:group {"className":"ep-footer-brand","layout":{"type":"default"}} -->
<div class="wp-block-group ep-footer-brand"><!-- wp:group {"className":"ep-brand ep-brand-simple","layout":{"type":"default"}} -->
<div class="wp-block-group ep-brand ep-brand-simple"><!-- wp:site-logo {"width":140} /--><!-- wp:site-title {"level":0,"className":"ep-wordmark-simple"} /--></div>
<!-- /wp:group --><!-- wp:paragraph -->
<p>Charging that comes to you.<br>Powering Ethiopia forward.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --><!-- wp:group {"className":"ep-footer-links","layout":{"type":"default"}} -->
<div class="wp-block-group ep-footer-links"><!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Services</h3>
<!-- /wp:heading --><!-- wp:paragraph -->
<p><a href="<?php echo evpower_url( '/services/#mobile' ); ?>">Mobile charging</a></p>
<!-- /wp:paragraph --><!-- wp:paragraph -->
<p><a href="<?php echo evpower_url( '/locations/' ); ?>">Charging stations</a></p>
<!-- /wp:paragraph --><!-- wp:paragraph -->
<p><a href="<?php echo evpower_url( '/services/#fleet' ); ?>">Fleet charging</a></p>
<!-- /wp:paragraph --><!-- wp:paragraph -->
<p><a href="<?php echo evpower_url( '/shop/' ); ?>">Home chargers</a></p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --><!-- wp:group {"className":"ep-footer-links","layout":{"type":"default"}} -->
<div class="wp-block-group ep-footer-links"><!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Company</h3>
<!-- /wp:heading --><!-- wp:paragraph -->
<p><a href="<?php echo evpower_url( '/about/' ); ?>">About Evpower</a></p>
<!-- /wp:paragraph --><!-- wp:paragraph -->
<p><a href="<?php echo evpower_url( '/contact/' ); ?>">Contact &amp; partnerships</a></p>
<!-- /wp:paragraph --><!-- wp:paragraph -->
<p><a href="<?php echo evpower_url( '/account/' ); ?>">My account &amp; orders</a></p>
<!-- /wp:paragraph --><!-- wp:paragraph -->
<p><a href="<?php echo evpower_url( '/cart/' ); ?>">Cart</a></p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --><!-- wp:group {"className":"ep-footer-links ep-footer-contact","layout":{"type":"default"}} -->
<div class="wp-block-group ep-footer-links ep-footer-contact"><!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Contact</h3>
<!-- /wp:heading --><!-- wp:paragraph {"className":"ep-contact-phone"} -->
<p class="ep-contact-phone"><a href="tel:8890">8890 Toll-free</a> · <a href="tel:+251911049916">+251 911 049 916</a></p>
<!-- /wp:paragraph --><!-- wp:paragraph {"className":"ep-contact-email"} -->
<p class="ep-contact-email"><a href="mailto:info@evpower.et">info@evpower.et</a></p>
<!-- /wp:paragraph --><!-- wp:paragraph {"className":"ep-contact-location"} -->
<p class="ep-contact-location">Addis Ababa &amp; Adama</p>
<!-- /wp:paragraph --><!-- wp:paragraph {"className":"ep-contact-whatsapp"} -->
<p class="ep-contact-whatsapp"><a href="https://wa.me/251911049916">Chat on WhatsApp</a></p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --></div>
<!-- /wp:group --></div>
<!-- /wp:group --><!-- wp:group {"className":"ep-footer-bottom","layout":{"type":"default"}} -->
<div class="wp-block-group ep-footer-bottom"><!-- wp:paragraph -->
<p>© <?php echo esc_html( wp_date( 'Y' ) ); ?> Evpower. All rights reserved.</p>
<!-- /wp:paragraph --><!-- wp:paragraph {"className":"ep-footer-legal"} -->
<p class="ep-footer-legal"><a href="<?php echo evpower_url( '/privacy/' ); ?>">Privacy</a> <span aria-hidden="true">·</span> <a href="<?php echo evpower_url( '/terms/' ); ?>">Terms</a></p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --></section>
<!-- /wp:group -->
