<?php
/**
 * Title: Evpower / Simple site header
 * Slug: evpower/header
 * Categories: evpower
 * Inserter: yes
 * Block Types: core/template-part/header
 */
defined( 'ABSPATH' ) || exit;
?>
<!-- wp:group {"className":"ep-header ep-header-simple","layout":{"type":"default"}} -->
<div class="wp-block-group ep-header ep-header-simple"><!-- wp:group {"className":"ep-container ep-header-inner","layout":{"type":"default"}} -->
<div class="wp-block-group ep-container ep-header-inner"><!-- wp:group {"className":"ep-brand ep-brand-simple","layout":{"type":"default"}} -->
<div class="wp-block-group ep-brand ep-brand-simple"><!-- wp:site-logo {"width":140} /--><!-- wp:site-title {"level":0,"className":"ep-wordmark-simple"} /--></div>
<!-- /wp:group --><!-- wp:navigation {"overlayMenu":"mobile","className":"ep-navigation ep-navigation-simple","layout":{"type":"flex","justifyContent":"center"}} -->
<!-- wp:navigation-link <?php echo wp_json_encode( array( 'label' => 'Services', 'url' => home_url( '/services/' ), 'kind' => 'custom' ) ); ?> /--><!-- wp:navigation-link <?php echo wp_json_encode( array( 'label' => 'Shop', 'url' => evpower_url( '/shop/' ), 'kind' => 'custom' ) ); ?> /--><!-- wp:navigation-link <?php echo wp_json_encode( array( 'label' => 'Find stations', 'url' => home_url( '/locations/' ), 'kind' => 'custom' ) ); ?> /-->
<!-- /wp:navigation --><!-- wp:group {"className":"ep-header-actions","layout":{"type":"default"}} -->
<div class="wp-block-group ep-header-actions"><!-- wp:paragraph {"className":"ep-signin"} -->
<p class="ep-signin"><a href="<?php echo evpower_url( '/account/' ); ?>" aria-label="Sign in"><span>Sign in</span></a><a class="ep-cart-link" href="<?php echo evpower_url( '/cart/' ); ?>" aria-label="Cart"><span>Cart</span></a></p>
<!-- /wp:paragraph --><!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button {"className":"ep-book-simple"} -->
<div class="wp-block-button ep-book-simple"><a class="wp-block-button__link wp-element-button" href="<?php echo evpower_url( '/book-charging/' ); ?>">Book a charge</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons --></div>
<!-- /wp:group --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->
