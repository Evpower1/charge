=== Evpower Core ===
Contributors: evpower
Tags: charging, bookings, woocommerce
Requires at least: 6.7
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 1.2.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Evpower's companion to the Evpower theme: Elementor page/header/footer editing, editable starter content, charging locations, private booking requests/enquiries, and optional Chapa payments for classic WooCommerce checkout.

== Installation ==
Install WooCommerce and the Evpower theme, activate this plugin, then open Evpower -> Setup & help. Review options before creating missing starter pages. Existing page content is preserved unless you explicitly choose to replace the Cart/Checkout content with classic shortcodes. Optional sample products are drafts, with zero stock.

== Editing ==
Use Pages for page content, Appearance -> Editor for the header/footer/navigation/styles, Products for the catalogue, and WooCommerce for orders/customers/shipping/payments. Native WordPress drafts, previews, revisions, and publishing are supported.

For Elementor, open Evpower -> Elementor & plugins and prepare editing. Pages become individual editable widgets. Header/footer templates have direct Elementor edit buttons; Pro Theme Builder display conditions take precedence when Pro is active. Original WordPress blocks are retained for restoration. The same screen provides focused plugin installation links for Elementor, WooCommerce, Yoast SEO, WP Mail SMTP, and LiteSpeed Cache. Third-party plugins and Pro licence keys are not bundled.

== Payments ==
Chapa is disabled until configured with a merchant secret, enabled, and used with ETB store currency and classic checkout. Supported payment methods depend on the Chapa merchant account. Verification independently checks the reference, currency and exact amount. Automated API refunds are not included. Test the merchant sandbox and hosted callback before accepting live payments.

== Privacy and operations ==
Requests and enquiries are private administrator-managed records. Notifications use WordPress mail; configure your email/SMTP service. Native WordPress/WooCommerce data and uploads need normal hosting backups. There is no automatic migration from the separate Next.js Evpower application.

== External services ==
The locations map displays OpenStreetMap tiles and attribution (https://www.openstreetmap.org/copyright). Leaflet 1.9.4 is bundled locally with its license. The optional Chapa gateway uses https://api.chapa.co for merchant payment initialization and verification, and redirects buyers to hosted Chapa checkout. Merchant credentials stay server-side. No other external service is required by this plugin.

== Changelog ==

= 1.2.0 =
* Add an explicit simple-header/light-footer preset action with five layout backups, restoration and save-failure rollback.
* Keep existing document IDs, Pro display conditions, pages and owner menus during layout replacement.
* Add an editable lightning wordmark/accent and independent account/cart visibility controls.
* Use a dedicated three-link menu, visible mobile account/cart/booking actions and Evpower contact links.
* Retain all earlier authenticated header/footer preview fixes.

= 1.1.5 =
* Recover the native editing container when content filters clear a header/footer preview or change the global post.
* Preserve normal filtered preview output when the requested container is already present, without adding a second wrapper.
* Report wrapper source and the post ID after content filters in private preview diagnostics.

= 1.1.4 =
* Use a signed, permission-checked WordPress front-controller URL for header/footer editor previews.
* Bind the final editor configuration after document subclasses complete their preview settings.
* Render previews before later template dispatchers, with no-cache responses and private route markers.
* Add header/footer preview checks and opt-in editor reports that omit nonce values, cookies and content.

= 1.1.3 =
* Remove the direct Pro conditions-saving call that could fail with Cannot unset string offsets.
* Prefill missing native conditions metadata while preserving existing owner conditions, including an intentionally empty list.
* Guide owners to save and activate display conditions through Pro Theme Builder's native UI.

= 1.1.2 =
* Select the edited header/footer independently of the page used for preview context, and initialize its native Elementor editing area.
* Handle conversion exceptions with an administrator-only error message and restore failed page conversions.
* Check that optional Pro conditions methods are publicly callable and restore the previous template type if promotion fails.
* Keep the existing header/footer mode when preparation fails; show plugin versions on the editor setup screen.

= 1.1.1 =
* Provide an isolated header/footer editing preview that calls the_content, even when a saved Single template has no post-content block.
* Keep the preview limited to authenticated Elementor layout editing; existing designs and public page templates are preserved.
* Make the homepage hero photo selectable in Elementor by allowing clicks through its decorative editing layers.

= 1.1.0 =
* Add native Elementor page conversion, header/footer templates, and Pro Theme Builder locations.
* Add editable identity, menu, and Account & Cart widgets, with content backups and restoration controls.
* Prevent WooCommerce auto-inserting duplicate account/cart controls in the Evpower header.
* Add a focused plugin installation/activation dashboard and Media Library image ownership.

= 1.0.1 =
* Fix the setup button remaining disabled when all requirements are active.
* Add an explicit Post name URL choice and homepage/permalink setup checks.
