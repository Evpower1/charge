<?php
/** Isolated Elementor layout editor: the_content supplies its editable document. */
defined( 'ABSPATH' ) || exit;
$evpower_layout_id = evpower_elementor_layout_preview_id();
if ( ! $evpower_layout_id ) { wp_die( 'Layout preview unavailable.', '', array( 'response' => 403 ) ); }
$evpower_layout = get_post( $evpower_layout_id );
if ( ! $evpower_layout || 'elementor_library' !== $evpower_layout->post_type ) { wp_die( 'Layout preview unavailable.', '', array( 'response' => 403 ) ); }
$evpower_original_post = $GLOBALS['post'] ?? null;
$GLOBALS['post'] = $evpower_layout;
setup_postdata( $evpower_layout );
// Pro can query an ordinary page for context; initialize the actual edited layout.
$evpower_preview = \Elementor\Plugin::$instance->preview;
if ( ! $evpower_preview->is_preview() || (int) $evpower_preview->get_post_id() !== $evpower_layout->ID ) { $evpower_preview->init(); }
?><!doctype html>
<html <?php language_attributes(); ?>>
<head><meta charset="<?php bloginfo( 'charset' ); ?>"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="evpower-layout-preview" content="<?php echo esc_attr( EVPOWER_CORE_VERSION ); ?>"><meta name="evpower-preview-state" content="<?php echo $evpower_preview->is_preview() && (int) $evpower_preview->get_post_id() === $evpower_layout->ID ? 'active' : 'inactive'; ?>"><?php wp_head(); ?></head>
<body <?php body_class(); ?>><?php wp_body_open(); ?>
<main id="content" class="ep-elementor-layout-preview"><?php $GLOBALS['post'] = $evpower_layout; setup_postdata( $evpower_layout ); the_content(); ?></main>
<?php wp_footer(); ?></body></html>
<?php
if ( $evpower_original_post instanceof WP_Post ) { $GLOBALS['post'] = $evpower_original_post; setup_postdata( $evpower_original_post ); } else { wp_reset_postdata(); }
