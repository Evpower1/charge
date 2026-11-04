<?php
/**
 * Title: Evpower / Charging locations page
 * Slug: evpower/page-locations
 * Categories: evpower
 * Inserter: yes
 */
defined( 'ABSPATH' ) || exit;
?>
<!-- wp:group {"className":"ep-section ","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group ep-section "><!-- wp:group {"className":"ep-container","layout":{"type":"default"}} -->
<div class="wp-block-group ep-container"><!-- wp:paragraph {"className":"ep-eyebrow"} -->
<p class="ep-eyebrow">CLOSER THAN YOU THINK</p>
<!-- /wp:paragraph --><!-- wp:paragraph {"className":"ep-intro"} -->
<p class="ep-intro">Find charging information for Addis Ababa and Adama. Check compatibility, opening hours, and availability with the station before travelling.</p>
<!-- /wp:paragraph --><!-- wp:shortcode -->
[evpower_locations]
<!-- /wp:shortcode --></div>
<!-- /wp:group --></section>
<!-- /wp:group --><!-- wp:group {"className":"ep-section ep-cta","layout":{"type":"default"},"tagName":"section"} -->
<section class="wp-block-group ep-section ep-cta"><!-- wp:group {"className":"ep-container","layout":{"type":"default"}} -->
<div class="wp-block-group ep-container"><!-- wp:group {"className":"ep-cta-inner","layout":{"type":"default"}} -->
<div class="wp-block-group ep-cta-inner"><!-- wp:group {"className":"ep-cta-copy","layout":{"type":"default"}} -->
<div class="wp-block-group ep-cta-copy"><!-- wp:paragraph {"className":"ep-eyebrow"} -->
<p class="ep-eyebrow">GOOD ENERGY IS A CONVERSATION AWAY</p>
<!-- /wp:paragraph --><!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Your electric journey.<br>Let’s make it happen.</h2>
<!-- /wp:heading --><!-- wp:paragraph -->
<p>A quick question, a bigger plan, or your next charge. We’re here for you.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --><!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button {"className":"is-style-fill"} -->
<div class="wp-block-button is-style-fill"><a class="wp-block-button__link wp-element-button" href="<?php echo evpower_url( '/contact/' ); ?>">Let’s talk ↗</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons --></div>
<!-- /wp:group --></div>
<!-- /wp:group --></section>
<!-- /wp:group -->
