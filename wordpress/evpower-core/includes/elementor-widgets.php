<?php
defined( 'ABSPATH' ) || exit;

/** Small native widgets: content/settings stay editable inside Elementor. */
class Evpower_Elementor_Identity extends \Elementor\Widget_Base {
    public function get_name() { return 'evpower-identity'; }
    public function get_title() { return 'Evpower Site Identity'; }
    public function get_icon() { return 'eicon-site-logo'; }
    public function get_categories() { return array( 'evpower' ); }
    protected function register_controls() {
        $this->start_controls_section( 'identity', array( 'label' => 'Site identity' ) );
        $this->add_control( 'title', array( 'label' => 'Text logo (leave blank for site title)', 'type' => \Elementor\Controls_Manager::TEXT, 'default' => '' ) );
        $this->add_control( 'logo', array( 'label' => 'Logo image (optional)', 'type' => \Elementor\Controls_Manager::MEDIA ) );
        $this->end_controls_section();
        $this->start_controls_section( 'style', array( 'label' => 'Appearance', 'tab' => \Elementor\Controls_Manager::TAB_STYLE ) );
        $this->add_control( 'color', array( 'label' => 'Colour', 'type' => \Elementor\Controls_Manager::COLOR, 'selectors' => array( '{{WRAPPER}} .ep-identity-link' => 'color: {{VALUE}}' ) ) );
        $this->add_group_control( \Elementor\Group_Control_Typography::get_type(), array( 'name' => 'type', 'selector' => '{{WRAPPER}} .ep-identity-link' ) );
        $this->add_responsive_control( 'logo_width', array( 'label' => 'Logo width', 'type' => \Elementor\Controls_Manager::SLIDER, 'range' => array( 'px' => array( 'min' => 20, 'max' => 350 ) ), 'selectors' => array( '{{WRAPPER}} img' => 'width: {{SIZE}}{{UNIT}}' ) ) );
        $this->end_controls_section();
    }
    protected function render() {
        $s = $this->get_settings_for_display();
        $logo = $s['logo']['url'] ?? '';
        if ( ! $logo && get_theme_mod( 'custom_logo' ) ) { $logo = wp_get_attachment_image_url( get_theme_mod( 'custom_logo' ), 'full' ); }
        $title = $s['title'] ?: get_bloginfo( 'name' );
        echo '<a class="ep-identity-link" href="' . esc_url( home_url( '/' ) ) . '">';
        if ( $logo ) { echo '<img src="' . esc_url( $logo ) . '" alt="' . esc_attr( $title ) . '">'; }
        else { echo esc_html( $title ); }
        echo '</a>';
    }
}

class Evpower_Elementor_Navigation extends \Elementor\Widget_Base {
    public function get_name() { return 'evpower-navigation'; }
    public function get_title() { return 'Evpower Navigation'; }
    public function get_icon() { return 'eicon-nav-menu'; }
    public function get_categories() { return array( 'evpower' ); }
    protected function register_controls() {
        $menus = array( '' => 'Evpower main menu' );
        foreach ( wp_get_nav_menus() as $menu ) { $menus[ $menu->term_id ] = $menu->name; }
        $this->start_controls_section( 'navigation', array( 'label' => 'Navigation' ) );
        $this->add_control( 'menu', array( 'label' => 'WordPress menu', 'type' => \Elementor\Controls_Manager::SELECT, 'options' => $menus, 'default' => '' ) );
        $this->add_control( 'instructions', array( 'type' => \Elementor\Controls_Manager::RAW_HTML, 'raw' => 'Edit link names, destinations and order in Appearance → Menus. Elementor controls the menu’s position and appearance.' ) );
        $this->end_controls_section();
        $this->start_controls_section( 'style', array( 'label' => 'Appearance', 'tab' => \Elementor\Controls_Manager::TAB_STYLE ) );
        $this->add_control( 'color', array( 'label' => 'Link colour', 'type' => \Elementor\Controls_Manager::COLOR, 'selectors' => array( '{{WRAPPER}} .wp-block-navigation' => 'color: {{VALUE}}' ) ) );
        $this->add_group_control( \Elementor\Group_Control_Typography::get_type(), array( 'name' => 'type', 'selector' => '{{WRAPPER}} .wp-block-navigation' ) );
        $this->add_responsive_control( 'gap', array( 'label' => 'Link spacing', 'type' => \Elementor\Controls_Manager::SLIDER, 'selectors' => array( '{{WRAPPER}} .wp-block-navigation__container' => 'gap: {{SIZE}}{{UNIT}}' ) ) );
        $this->end_controls_section();
    }
    protected function render() {
        $s = $this->get_settings_for_display();
        $id = absint( $s['menu'] ?: get_option( 'evpower_elementor_menu' ) );
        $items = $id ? wp_get_nav_menu_items( $id ) : array();
        if ( ! $items ) { return; }
        $tree = function ( $parent ) use ( &$tree, $items ) {
            $blocks = '';
            foreach ( $items as $item ) {
                if ( (int) $item->menu_item_parent !== $parent ) { continue; }
                $children = $tree( (int) $item->ID );
                $type = $children ? 'navigation-submenu' : 'navigation-link';
                $attrs = wp_json_encode( array( 'label' => $item->title, 'url' => $item->url, 'kind' => 'custom', 'opensInNewTab' => '_blank' === $item->target ) );
                $blocks .= $children ? '<!-- wp:' . $type . ' ' . $attrs . ' -->' . $children . '<!-- /wp:' . $type . ' -->' : '<!-- wp:' . $type . ' ' . $attrs . ' /-->';
            }
            return $blocks;
        };
        echo do_blocks( '<!-- wp:navigation {"className":"ep-navigation ep-builder-navigation","overlayMenu":"mobile","layout":{"type":"flex","justifyContent":"center"}} -->' . $tree( 0 ) . '<!-- /wp:navigation -->' );
    }
}

class Evpower_Elementor_Shop_Actions extends \Elementor\Widget_Base {
    public function get_name() { return 'evpower-shop-actions'; }
    public function get_title() { return 'Evpower Account & Cart'; }
    public function get_icon() { return 'eicon-cart'; }
    public function get_categories() { return array( 'evpower' ); }
    protected function register_controls() {
        $this->start_controls_section( 'links', array( 'label' => 'Account & cart' ) );
        $this->add_control( 'account_label', array( 'label' => 'Account label', 'type' => \Elementor\Controls_Manager::TEXT, 'default' => 'Account' ) );
        $this->add_control( 'cart_label', array( 'label' => 'Cart label', 'type' => \Elementor\Controls_Manager::TEXT, 'default' => 'Cart' ) );
        $this->add_control( 'show_labels', array( 'label' => 'Show labels', 'type' => \Elementor\Controls_Manager::SWITCHER, 'default' => 'yes' ) );
        $this->add_responsive_control( 'label_display', array( 'label' => 'Label visibility on device', 'type' => \Elementor\Controls_Manager::SELECT, 'default' => 'inline', 'mobile_default' => 'none', 'options' => array( 'inline' => 'Show', 'none' => 'Hide' ), 'selectors' => array( '{{WRAPPER}} .ep-builder-shop-links a span' => 'display: {{VALUE}}' ) ) );
        $this->end_controls_section();
        $this->start_controls_section( 'style', array( 'label' => 'Appearance', 'tab' => \Elementor\Controls_Manager::TAB_STYLE ) );
        $this->add_control( 'color', array( 'label' => 'Colour', 'type' => \Elementor\Controls_Manager::COLOR, 'selectors' => array( '{{WRAPPER}} .ep-builder-shop-links' => 'color: {{VALUE}}' ) ) );
        $this->add_group_control( \Elementor\Group_Control_Typography::get_type(), array( 'name' => 'type', 'selector' => '{{WRAPPER}} .ep-builder-shop-links' ) );
        $this->end_controls_section();
    }
    protected function render() {
        $s = $this->get_settings_for_display();
        $account = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'myaccount' ) : home_url( '/account/' );
        $cart = function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : home_url( '/cart/' );
        $icons = array( 'account' => '<circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>', 'cart' => '<path d="M2 3h3l3 13h11l3-9H6"/><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>' );
        echo '<div class="ep-builder-shop-links">';
        foreach ( array( 'account' => $account, 'cart' => $cart ) as $key => $url ) {
            $label = $s[ $key . '_label' ] ?: ucfirst( $key );
            echo '<a href="' . esc_url( $url ) . '" aria-label="' . esc_attr( $label ) . '"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' . $icons[ $key ] . '</svg>';
            if ( 'yes' === $s['show_labels'] ) { echo '<span>' . esc_html( $label ) . '</span>'; }
            echo '</a>';
        }
        echo '</div>';
    }
}

class Evpower_Elementor_Block extends \Elementor\Widget_Base {
    public function get_name() { return 'evpower-block'; }
    public function get_title() { return 'Evpower WordPress Block'; }
    public function get_icon() { return 'eicon-wordpress'; }
    public function get_categories() { return array( 'evpower' ); }
    protected function register_controls() {
        $this->start_controls_section( 'block', array( 'label' => 'Original dynamic block' ) );
        $this->add_control( 'content', array( 'label' => 'WordPress block', 'type' => \Elementor\Controls_Manager::TEXTAREA, 'description' => 'Preserves a block from another plugin. Manage its underlying data in that plugin; use Elementor widgets for new visual content.' ) );
        $this->end_controls_section();
    }
    protected function render() {
        static $depth = 0;
        if ( $depth > 2 ) { return; }
        $depth++; try { echo do_blocks( $this->get_settings_for_display( 'content' ) ?: '' ); } finally { $depth--; }
    }
}
