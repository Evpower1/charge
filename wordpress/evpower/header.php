<?php
/** Elementor Full Width and classic templates share the same editable header. */
defined( 'ABSPATH' ) || exit;
$evpower_header = do_blocks( '<!-- wp:template-part {"slug":"header","tagName":"header"} /-->' );
?><!doctype html><html <?php language_attributes(); ?>><head><meta charset="<?php bloginfo( 'charset' ); ?>"><meta name="viewport" content="width=device-width, initial-scale=1"><?php wp_head(); ?></head><body <?php body_class(); ?>><?php wp_body_open(); ?><div class="wp-site-blocks"><?php echo $evpower_header; ?>
