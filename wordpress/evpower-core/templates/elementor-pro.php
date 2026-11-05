<?php
defined( 'ABSPATH' ) || exit;
// Render both areas before wp_head so their widget styles/scripts are enqueued.
$header = do_blocks( '<!-- wp:template-part {"slug":"header","tagName":"header"} /-->' );
$footer = do_blocks( '<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->' );
?><!doctype html>
<html <?php language_attributes(); ?>><head><meta charset="<?php bloginfo( 'charset' ); ?>"><meta name="viewport" content="width=device-width, initial-scale=1"><?php wp_head(); ?></head>
<body <?php body_class(); ?>><?php wp_body_open(); ?><div class="wp-site-blocks"><?php echo $header; ?><main id="content" class="ep-main"><?php echo $GLOBALS['evpower_pro_content']; ?></main><?php echo $footer; ?></div><?php wp_footer(); ?></body></html>
