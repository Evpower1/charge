<?php
/**
 * Title: Evpower / Site header
 * Slug: evpower/header
 * Categories: evpower
 * Inserter: yes
 * Block Types: core/template-part/header
 */
defined( 'ABSPATH' ) || exit;
?>
<!-- wp:group {"className":"ep-topbar","layout":{"type":"default"}} -->
<div class="wp-block-group ep-topbar"><!-- wp:group {"className":"ep-container ep-top-inner","layout":{"type":"default"}} -->
<div class="wp-block-group ep-container ep-top-inner"><!-- wp:paragraph {"className":"ep-announcement"} -->
<p class="ep-announcement">● &nbsp; A cleaner drive. A brighter Ethiopia.</p>
<!-- /wp:paragraph --><!-- wp:paragraph {"className":"ep-top-contact"} -->
<p class="ep-top-contact"><a href="tel:8890">Toll-free <strong>8890</strong></a> &nbsp; Addis Ababa &amp; Adama</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --></div>
<!-- /wp:group --><!-- wp:group {"className":"ep-header","layout":{"type":"default"}} -->
<div class="wp-block-group ep-header"><!-- wp:group {"className":"ep-container ep-header-inner","layout":{"type":"default"}} -->
<div class="wp-block-group ep-container ep-header-inner"><!-- wp:group {"className":"ep-brand","layout":{"type":"default"}} -->
<div class="wp-block-group ep-brand"><!-- wp:site-logo {"width":36} /--><!-- wp:site-title {"level":0} /--></div>
<!-- /wp:group --><!-- wp:navigation {"overlayMenu":"mobile","className":"ep-navigation","layout":{"type":"flex","justifyContent":"center"}} -->
<!-- wp:navigation-link <?php echo wp_json_encode( array( 'label' => 'Home', 'url' => home_url( '/' ), 'kind' => 'custom' ) ); ?> /--><!-- wp:navigation-link <?php echo wp_json_encode( array( 'label' => 'Our Services', 'url' => home_url( '/services/' ), 'kind' => 'custom' ) ); ?> /--><!-- wp:navigation-link <?php echo wp_json_encode( array( 'label' => 'Charging Locations', 'url' => home_url( '/locations/' ), 'kind' => 'custom' ) ); ?> /--><!-- wp:navigation-link <?php echo wp_json_encode( array( 'label' => 'Shop', 'url' => home_url( '/shop/' ), 'kind' => 'custom' ) ); ?> /--><!-- wp:navigation-link <?php echo wp_json_encode( array( 'label' => 'About Us', 'url' => home_url( '/about/' ), 'kind' => 'custom' ) ); ?> /--><!-- wp:navigation-link <?php echo wp_json_encode( array( 'label' => 'Contact Us', 'url' => home_url( '/contact/' ), 'kind' => 'custom' ) ); ?> /-->
<!-- /wp:navigation --><!-- wp:group {"className":"ep-header-actions","layout":{"type":"default"}} -->
<div class="wp-block-group ep-header-actions"><!-- wp:paragraph {"className":"ep-account-links"} -->
<p class="ep-account-links"><a href="<?php echo evpower_url( '/account/' ); ?>">Account</a> &nbsp; <a href="<?php echo evpower_url( '/cart/' ); ?>">Cart</a></p>
<!-- /wp:paragraph --><!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button {"className":"is-style-fill"} -->
<div class="wp-block-button is-style-fill"><a class="wp-block-button__link wp-element-button" href="<?php echo evpower_url( '/book-charging/' ); ?>">Book Charging ↗</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons --></div>
<!-- /wp:group --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->
