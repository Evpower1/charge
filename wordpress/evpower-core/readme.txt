=== Evpower Core ===
Contributors: evpower
Tags: charging, bookings, woocommerce
Requires at least: 6.7
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 1.0.1
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Evpower's companion to the Evpower block theme: editable starter content, charging locations, private booking requests/enquiries, and optional Chapa payments for classic WooCommerce checkout.

== Installation ==
Install WooCommerce and the Evpower theme, activate this plugin, then open Evpower -> Setup & help. Review options before creating missing starter pages. Existing page content is preserved unless you explicitly choose to replace the Cart/Checkout content with classic shortcodes. Optional sample products are drafts, with zero stock.

== Editing ==
Use Pages for page content, Appearance -> Editor for the header/footer/navigation/styles, Products for the catalogue, and WooCommerce for orders/customers/shipping/payments. Native WordPress drafts, previews, revisions, and publishing are supported.

== Payments ==
Chapa is disabled until configured with a merchant secret, enabled, and used with ETB store currency and classic checkout. Supported payment methods depend on the Chapa merchant account. Verification independently checks the reference, currency and exact amount. Automated API refunds are not included. Test the merchant sandbox and hosted callback before accepting live payments.

== Privacy and operations ==
Requests and enquiries are private administrator-managed records. Notifications use WordPress mail; configure your email/SMTP service. Native WordPress/WooCommerce data and uploads need normal hosting backups. There is no automatic migration from the separate Next.js Evpower application.

== External services ==
The locations map displays OpenStreetMap tiles and attribution (https://www.openstreetmap.org/copyright). Leaflet 1.9.4 is bundled locally with its license. The optional Chapa gateway uses https://api.chapa.co for merchant payment initialization and verification, and redirects buyers to hosted Chapa checkout. Merchant credentials stay server-side. No other external service is required by this plugin.

== Changelog ==

= 1.0.1 =
* Fix the setup button remaining disabled when all requirements are active.
* Add an explicit Post name URL choice and homepage/permalink setup checks.
