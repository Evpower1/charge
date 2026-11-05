<?php
/** Failure injection and Pro API contract checks, only in the disposable runtime. */
if ( 'local' !== wp_get_environment_type() || 'http://localhost:8094' !== home_url() ) { throw new RuntimeException( 'Disposable runtime required.' ); }
wp_set_current_user( get_user_by( 'login', 'evpower-test-admin' )->ID );
$GLOBALS['evpower_prepare_checks'] = 0;
function ev_prepare_check( $condition, $message ) { if ( ! $condition ) { throw new RuntimeException( $message ); } $GLOBALS['evpower_prepare_checks']++; echo 'PASS: ' . $message . "\n"; }
$original_pages = get_option( 'evpower_pages' );
$original_mode = get_option( 'evpower_header_footer_mode' );
$content = '<!-- wp:paragraph --><p>Original owner content survives a failed conversion.</p><!-- /wp:paragraph -->';
$page_id = wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'draft', 'post_title' => 'Local preparation rollback fixture', 'post_content' => $content ) );
update_post_meta( $page_id, '_wp_page_template', 'default' );
$throw = function ( $document ) use ( $page_id ) { if ( (int) $document->get_main_id() === $page_id ) { throw new RuntimeException( 'LOCAL_PREPARATION_FAILURE' ); } };
try {
    $pages = $original_pages; $pages['about'] = $page_id; update_option( 'evpower_pages', $pages );
    update_option( 'evpower_header_footer_mode', 'wordpress' );
    add_action( 'elementor/document/after_save', $throw, 100 );
    $result = evpower_prepare_elementor();
    ev_prepare_check( is_wp_error( $result ) && str_contains( $result->get_error_message(), 'LOCAL_PREPARATION_FAILURE' ), 'A save exception becomes an actionable preparation error instead of escaping as a fatal error' );
    ev_prepare_check( $content === get_post_field( 'post_content', $page_id ), 'Original page content is restored even when Elementor throws after saving' );
    ev_prepare_check( ! metadata_exists( 'post', $page_id, '_elementor_data' ) && ! metadata_exists( 'post', $page_id, '_elementor_edit_mode' ), 'Failed conversion restores the previous editor metadata' );
    ev_prepare_check( 'default' === get_post_meta( $page_id, '_wp_page_template', true ), 'Failed conversion preserves the original page template' );
    ev_prepare_check( 'wordpress' === get_option( 'evpower_header_footer_mode' ), 'A preparation failure does not switch the active header/footer mode' );
    remove_action( 'elementor/document/after_save', $throw, 100 );
    $result = evpower_prepare_elementor();
    ev_prepare_check( ! is_wp_error( $result ) && evpower_is_elementor_page( $page_id ), 'Preparation can be retried successfully after a dependency save failure' );

    // Contract fixture only: the paid Pro plugin is not represented by these classes.
    if ( ! class_exists( '\ElementorPro\Modules\ThemeBuilder\Module' ) ) {
        class Evpower_Test_Private_Conditions { protected function save_conditions() { throw new RuntimeException( 'A protected API must not be called.' ); } }
        eval( 'namespace ElementorPro\\Modules\\ThemeBuilder; class Module { public static function instance() { return new self(); } public function get_conditions_manager() { return new \\Evpower_Test_Private_Conditions(); } }' );
        class Evpower_Test_Header extends \Elementor\Modules\Library\Documents\Section { public static function get_type() { return 'header'; } }
        class Evpower_Test_Footer extends \Elementor\Modules\Library\Documents\Section { public static function get_type() { return 'footer'; } }
        \Elementor\Plugin::$instance->documents->register_document_type( 'header', Evpower_Test_Header::class );
        \Elementor\Plugin::$instance->documents->register_document_type( 'footer', Evpower_Test_Footer::class );
        $layouts = get_option( 'evpower_elementor_layouts' );
        $snapshots = array();
        foreach ( $layouts as $area => $id ) { $snapshots[ $id ] = array( 'type' => get_post_meta( $id, '_elementor_template_type', true ), 'data' => get_post_meta( $id, '_elementor_data', true ), 'conditions' => metadata_exists( 'post', $id, '_elementor_conditions' ) ? get_post_meta( $id, '_elementor_conditions', true ) : null, 'terms' => wp_get_object_terms( $id, 'elementor_library_type', array( 'fields' => 'ids' ) ) ); }
        try {
            foreach ( $layouts as $id ) { update_post_meta( $id, '_elementor_template_type', 'section' ); }
            $result = evpower_prepare_elementor();
            ev_prepare_check( ! is_wp_error( $result ), 'Pro document promotion does not call an inaccessible conditions method' );
            foreach ( $layouts as $area => $id ) { ev_prepare_check( $area === get_post_meta( $id, '_elementor_template_type', true ) && $snapshots[ $id ]['data'] === get_post_meta( $id, '_elementor_data', true ), $area . ' promotion preserves existing owner widget data' ); }
            update_post_meta( $layouts['header'], '_elementor_template_type', 'section' );
            wp_set_object_terms( $layouts['header'], 'section', 'elementor_library_type' );
            $fail_promotion = function ( $document ) use ( $layouts ) { if ( (int) $document->get_main_id() === (int) $layouts['header'] ) { throw new RuntimeException( 'LOCAL_PROMOTION_FAILURE' ); } };
            add_action( 'elementor/document/after_save', $fail_promotion, 100 );
            try {
                $failed = evpower_prepare_elementor();
                ev_prepare_check( is_wp_error( $failed ) && str_contains( $failed->get_error_message(), 'LOCAL_PROMOTION_FAILURE' ), 'A Pro promotion exception becomes a clear preparation error' );
                ev_prepare_check( 'section' === get_post_meta( $layouts['header'], '_elementor_template_type', true ) && $snapshots[ $layouts['header'] ]['data'] === get_post_meta( $layouts['header'], '_elementor_data', true ), 'A failed promotion restores its previous template type and preserves the design' );
            } finally { remove_action( 'elementor/document/after_save', $fail_promotion, 100 ); }
        } finally {
            foreach ( $snapshots as $id => $snapshot ) {
                update_post_meta( $id, '_elementor_template_type', $snapshot['type'] );
                if ( null === $snapshot['conditions'] ) { delete_post_meta( $id, '_elementor_conditions' ); } else { update_post_meta( $id, '_elementor_conditions', $snapshot['conditions'] ); }
                wp_set_object_terms( $id, $snapshot['terms'], 'elementor_library_type' );
            }
        }
        // New templates are published only after their editable data saves successfully.
        delete_option( 'evpower_elementor_layouts' );
        try {
            $created = evpower_prepare_elementor();
            ev_prepare_check( ! is_wp_error( $created ) && isset( $created['header'], $created['footer'] ), 'Preparation can create both new layout documents through the Pro-compatible API' );
            foreach ( $created as $area => $id ) { ev_prepare_check( 'publish' === get_post_status( $id ) && evpower_has_elementor_data( $id ), 'New ' . $area . ' is published with editable widget data' ); }
        } finally {
            foreach ( get_option( 'evpower_elementor_layouts', array() ) as $id ) { if ( ! in_array( $id, $layouts, true ) ) { wp_delete_post( $id, true ); } }
            update_option( 'evpower_elementor_layouts', $layouts );
        }
    }
} finally {
    remove_action( 'elementor/document/after_save', $throw, 100 );
    update_option( 'evpower_pages', $original_pages );
    update_option( 'evpower_header_footer_mode', $original_mode );
    wp_delete_post( $page_id, true );
}
echo 'Completed ' . $GLOBALS['evpower_prepare_checks'] . " preparation failure/contract checks.\n";
