<?php
/** Test-only model of an early preview dispatcher and a different preview domain. */
defined( 'ABSPATH' ) || exit;
if ( 'local' !== wp_get_environment_type() || 'http://localhost:8094' !== home_url() ) { return; }
add_filter( 'elementor/document/config', function ( $config, $id ) {
    if ( evpower_elementor_layout_document( $id ) ) { $config['urls']['preview'] = add_query_arg( array( 'page_id' => get_option( 'page_on_front' ), 'elementor-preview' => $id ), 'https://preview-target.invalid/' ); }
    return $config;
}, 1000, 2 );
add_action( 'elementor/documents/register', function ( $manager ) {
    class Evpower_Test_Preview_Section extends \Elementor\Modules\Library\Documents\Section {
        public function get_initial_config() {
            $config = parent::get_initial_config();
            $config['urls']['preview'] = add_query_arg( array( 'page_id' => get_option( 'page_on_front' ), 'elementor-preview' => $this->get_main_id() ), 'https://preview-target.invalid/' );
            return $config;
        }
    }
    $manager->register_document_type( 'section', Evpower_Test_Preview_Section::class );
}, 100 );
add_action( 'template_redirect', function () {
    if ( isset( $_GET['elementor-preview'] ) ) { echo '<!doctype html><html><head><title>Local early preview dispatcher</title></head><body>LOCAL_EARLY_PREVIEW_DISPATCH</body></html>'; exit; }
}, 9 );
