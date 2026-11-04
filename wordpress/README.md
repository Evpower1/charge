# Evpower for WordPress

This is a separate, installable WordPress version of Evpower. It uses the native WordPress block/Site Editor and WooCommerce; no paid page builder is required. The existing Next.js application remains in the repository and is not converted by uploading these packages.

## Install into your existing Hostinger WordPress site

1. Back up the WordPress files and database in Hostinger. Use a staging copy to review the change before replacing the live design. Keep the old Next.js database separately if it contains orders or accounts.
2. Open **Hostinger hPanel → Websites → your WordPress website → WordPress Admin**. The administrator is the account created during that WordPress installation. The Next.js `ADMIN_EMAIL`/`ADMIN_PASSWORD` settings do not log you into WordPress. Hostinger’s WordPress Admin button can provide access without sharing credentials in chat.
3. Under **Plugins → Add New**, install and activate **WooCommerce** from the WordPress plugin directory. Complete its business setup as appropriate for Evpower.
4. Download [evpower.zip](packages/evpower.zip). In **Appearance → Themes → Add New → Upload Theme**, upload this file and activate **Evpower**.
5. Download [evpower-core.zip](packages/evpower-core.zip). In **Plugins → Add New → Upload Plugin**, upload this file and activate **Evpower Core**. Upload the two ZIPs separately; the theme ZIP belongs under Themes and the plugin ZIP under Plugins.
6. Open **Evpower → Setup & help**. Review the options, then choose **Create missing starter content**. It preserves existing page content and products. Options let you set the new homepage and site identity, import draft sample products, and explicitly switch the Cart/Checkout pages to the classic shortcodes needed by the included Chapa gateway. The Cart/Checkout option replaces only those two pages’ content; leave it unchecked if you need to preserve a custom checkout.
7. If an existing page has the same address (for example `/about/`), setup keeps it. To use the Evpower design there, open the page and insert the corresponding **Evpower** pattern, then review and update it. **Settings → Reading** controls the homepage.
8. In **WooCommerce → Settings**, configure Ethiopia, Ethiopian birr (**ETB**), taxes, delivery zones/rates, guest checkout, and registration. Review actual product photos, specifications, prices, warranty, and stock. The optional six sample products are **drafts with zero stock**.
9. Complete and publish the Privacy Policy and Terms drafts. Assign them in **Settings → Privacy** and **WooCommerce → Settings → Advanced**. Supply real station records in **Evpower → Charging locations**. Setup creates no verified stations or invented availability.
10. Configure notification email under **Evpower → Setup & help** and configure Hostinger’s mail/SMTP service. Test a contact enquiry, a charging request, a guest order, account login, and any enabled payment method before setting **WooCommerce → Settings → Site visibility → Live**. Submissions are saved even if email delivery fails.

The packages do not change DNS, remove the deployed Next.js app, import its SQLite data, or change the hosted website by themselves. Move `evpower.et` to the reviewed WordPress installation through Hostinger only when ready. Existing Next.js accounts, password hashes, orders, invoices, images, and Website Studio revisions need a separate data migration; they are not silently copied into WordPress.

## Edit the website

| What to change | Where in WordPress |
| --- | --- |
| Page text, images, buttons, and sections | **Pages → choose page → Edit** |
| Add/reorder/remove sections | Block inserter (+), **Patterns → Evpower**, and List View |
| Header, footer, navigation, page templates | **Appearance → Editor** |
| Colours, typography, spacing | **Appearance → Editor → Styles**, or individual block settings |
| Logo and site title | Site Logo/Site Title blocks in the header; **Settings → General** for the title |
| Contact details in public pages/header/footer | Edit the corresponding blocks in Pages or the Site Editor |
| Contact notification destination | **Evpower → Setup & help** |
| Products, photos, categories, price, stock | **Products** |
| Orders, fulfilment, customers, payments, delivery | **WooCommerce** |
| Station details and verification evidence | **Evpower → Charging locations** |
| Charging requests and contact enquiries | **Evpower → Charging requests / Enquiries** |
| Search description | Page editor → **Search description** box |
| Drafts, preview, publication, history | WordPress **Preview**, **Save draft**, **Update/Publish**, and **Revisions** |

Customers use the WooCommerce My Account page for login/registration, order history, addresses, and charging requests submitted while signed in. Guest checkout is supported when enabled. Paid orders have a protected printable payment receipt; it is not a statutory Ethiopian tax invoice. Installation is a separately quoted request recorded on the order, with no unannounced fee added to checkout.

## Chapa

The included optional gateway uses WooCommerce orders and **classic Checkout**. It is disabled by default and does not display unless enabled with a merchant secret and ETB store currency. It is not a Checkout Block payment integration. The setup screen can switch the Cart and Checkout content with your explicit selection; you can instead edit those pages to use Shortcode blocks containing `[woocommerce_cart]` and `[woocommerce_checkout]`.

Enable/configure it at **WooCommerce → Settings → Payments → Chapa (Evpower)**. You may set the secret in the password field or define `EVPOWER_CHAPA_SECRET_KEY` in private `wp-config.php`. Leave it unset until you have a Chapa merchant account. Do not paste secrets into pages, GitHub, or chat. Other WooCommerce payment gateways can be configured independently.

Checkout redirects to Chapa. Only methods enabled by Chapa for the merchant account appear there. The server independently verifies the transaction reference, ETB currency, and the exact order amount before marking an order paid. Browser redirects and callback payloads alone cannot mark it paid. Repeated callbacks do not double-reduce stock. If an initialization attempt fails ambiguously, the order is kept pending for reconciliation rather than starting a second potentially chargeable attempt automatically; verify its reference with Chapa before cancelling or starting another order. Refunds are handled in the merchant dashboard and reconciled in WooCommerce; automated API refunds are not implemented.

Testing used a mocked provider. A merchant sandbox transaction and a real hosting callback/return test are still required before accepting live payments. Configure a supported currency and shipping service rather than enabling fake/demo payments on the public site.

## Operations

- Native WordPress revisions, media, templates, settings, and WooCommerce data live in the WordPress database/uploads. Keep Hostinger backups and normal WordPress/plugin updates enabled.
- Keep request-form pages out of long-lived full-page caches, or refresh them within the WordPress nonce validity window; expired forms ask visitors to reload. Cart/Checkout/My Account should use WooCommerce’s normal cache exclusions.
- Booking/enquiry records are private administrator-managed post types, excluded from public search and REST listings. Customer charging history selects only the signed-in customer’s records. Forms use WordPress nonces, origin checks, field/date validation, a honeypot, size limits, and rate limiting.
- Only administrators can verify stations. Verification requires an HTTPS source, a valid non-future date, opening hours, charging power, and connectors. Staff remain responsible for source accuracy and ongoing checks.
- The map bundles Leaflet 1.9.4 and loads OpenStreetMap raster tiles with attribution. Keep the attribution and follow the tile provider’s usage policy; use an appropriate tile provider for higher traffic. The station list remains readable without JavaScript.
- WordPress’s normal page/post sitemap remains available. Install a compatible SEO plugin if you need additional SEO controls; the built-in description output yields to Yoast, Rank Math, and All in One SEO. Other integrations can disable it with the `evpower_output_meta_description` filter.

## Rebuild and validate

Validated on WordPress **7.1.4**, WooCommerce **11.2.1**, PHP **8.3**, and MariaDB **11.4**. All 45 integration checks and the full browser suite passed, including mobile layouts/navigation, map filters, requests, cart/checkout, protected receipts, native block validation, and saving a real WordPress page edit. Test map tiles and Chapa responses were simulated; no real email or payment was sent.

`python wordpress/package.py` rebuilds the two uploadable packages and their SHA-256 manifest. It packages only `evpower/` and `evpower-core/`, never local databases, test credentials, the testing mail/network fixture, or WordPress itself. Local fonts include their OFL licenses; vendored Leaflet includes its license and npm integrity record.

Tests run only against a disposable Docker runtime, with private generated credentials and no real email/payment calls. The runtime uses official WordPress PHP 8.3 and MariaDB 11.4 images. Run `python wordpress/tests/run.py` with Docker, Python Playwright, and Chromium available. It downloads official WooCommerce 11.2.1/WP-CLI when missing, creates or reuses only the labelled local test containers, and runs the integration and browser suites. Stop those servers with `python wordpress/tests/runtime.py stop`. Never point these tests at production. The fixed local target is checked before test data is changed.
