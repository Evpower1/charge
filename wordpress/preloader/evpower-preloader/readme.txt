=== Evpower Emblem Preloader ===
Contributors: evpower
Requires at least: 6.3
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPL-2.0-or-later

A lightweight website preloader using Evpower's approved red car-and-charging emblem.

== Installation ==

1. In WordPress, open Plugins > Add New > Upload Plugin.
2. Upload evpower-preloader.zip and activate Evpower Emblem Preloader.
3. Open Appearance > Evpower Preloader to enable or disable it, choose once per browser tab session or every eligible page, and edit the loading caption.
4. For Evolta, disable the theme's built-in preloader in Theme Options to avoid two loaders. Clear your page cache after installing or changing settings.

The plugin works independently of the theme. It does not modify theme files, pages, products, orders, accounts or payment settings. It uses wp_body_open, with a single-render wp_footer fallback for themes missing that hook. Assets are local; there are no remote services or tracking requests.

== Behaviour ==

The charging animation dismisses when the page is ready, with a six-second fallback. Visitors can use Skip animation or press Escape. By default it shows once per browser tab session; browser storage restrictions do not prevent page access. Reduced-motion visitors receive a still treatment. Without JavaScript, the overlay does not cover the page.

WordPress administration, Elementor editor and template previews, WordPress previews, the Customizer, feeds, embeds, REST requests and WooCommerce Cart/Checkout/My Account pages are excluded. Native page, shop and editor content remains under WordPress, Elementor and WooCommerce control.

If a performance plugin delays all JavaScript, exclude the evpower-emblem-preloader handle or assets/preloader.js from delayed execution so it can decide whether to show the loader before body rendering.

== Changelog ==

= 1.0.0 =
* Add the approved Evpower emblem preloader and owner-controlled display settings.
