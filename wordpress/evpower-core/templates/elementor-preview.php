<?php
/** Isolated Elementor layout editor: the_content supplies its editable document. */
defined( 'ABSPATH' ) || exit;
?><!doctype html>
<html <?php language_attributes(); ?>>
<head><meta charset="<?php bloginfo( 'charset' ); ?>"><meta name="viewport" content="width=device-width, initial-scale=1"><?php wp_head(); ?></head>
<body <?php body_class(); ?>><?php wp_body_open(); ?>
<main id="content" class="ep-elementor-layout-preview"><?php while ( have_posts() ) { the_post(); the_content(); } ?></main>
<?php wp_footer(); ?></body></html>
