# Evpower for WordPress

This is a separate, installable WordPress version of Evpower, with Elementor editing, Elementor Pro Theme Builder support, the WordPress block editor, and WooCommerce. The existing Next.js application remains in the repository and is not converted by uploading these packages.

## Elementor: the owner workflow

Use **Evpower theme 1.1.0** and **Evpower Core 1.1.4** using the ZIPs under `packages/`. Upload each ZIP in its matching Themes/Plugins screen and choose **Replace current with uploaded**. Existing WordPress content, products, orders and customers remain in the database.

1. Activate **Elementor** and **WooCommerce**. To use your Pro licence, upload the official **Elementor Pro** ZIP from your Elementor account, activate it, and connect the licence privately in WordPress.
2. Open **Evpower → Elementor & plugins → Prepare Elementor editing**. This converts Evpower marketing pages into individual heading, image, text, button, accordion and container widgets. It creates editable header/footer templates from the current layouts. Existing Elementor pages/designs are skipped rather than replaced. Original WordPress blocks are backed up before conversion.
3. Use the page/header/footer **Edit with Elementor** buttons on that screen. Change text, replace photos, add/remove/move sections, and use Elementor’s responsive controls. Theme photos are imported into your Media Library so you can manage their alt text and replace them normally.
4. With Pro active, use **Templates → Theme Builder** for Header, Footer, Single, Archive and WooCommerce designs. After preparing, save the Header and Footer display conditions using Pro's native controls: **Include → Entire Site** for global layouts, or your preferred scope. Preparation prefills missing conditions metadata and preserves any existing choices; Pro's UI saves and activates the published conditions. A template created before Pro activation can be promoted by running Prepare again without losing its design.
5. Use **Appearance → Menus** for navigation link names, destinations and order. The Elementor **Evpower Navigation** widget controls its appearance. **Site Identity** controls the logo/text logo; **Account & Cart** gives you one icon/link for each with optional labels.

Elementor Free can edit the pages and assigned header/footer templates through Evpower while Pro is inactive; no separate header-builder plugin is needed. Matching Pro Theme Builder locations take priority over fallback layouts. The owner can choose **Use WordPress header & footer** or **Use Elementor header & footer**. Individual converted pages offer **Restore original WordPress blocks**. Re-running preparation keeps existing Elementor edits and customized global styles. Elementor’s own history/revisions remain available.

Products, categories, prices, stock, delivery, checkout, customer accounts and orders remain in WooCommerce. Conversion leaves Shop/Cart/Checkout/My Account alone; use Pro’s product/archive templates for their visual layout. Keep the included Chapa gateway on classic Checkout as described below. Dynamic blocks from other plugins are preserved in a dedicated WordPress Block widget rather than discarded.

**Focused plugin list:** Elementor + your Elementor Pro, WooCommerce and Evpower Core are the essentials. The dashboard provides official installer/activation links for **Yoast SEO** (optional SEO tools), **WP Mail SMTP** (optional reliable email delivery), and **LiteSpeed Cache** (optional on compatible Hostinger/LiteSpeed hosting). Use one SEO plugin and one page-cache plugin. Credentials and licences stay in their private plugin settings. Third-party plugins are not bundled or silently installed by the ZIPs.

Duplicate Account/Cart controls are fixed by preventing WooCommerce’s automatic header insertion when Evpower supplies those controls. Explicit controls in existing header blocks are normalized to a single pair when prepared for Elementor. Other navigation links and layouts are retained.

### Fix “the content area was not found” when editing the header/footer

Update **Evpower Core to 1.1.4**, clear the Hostinger/LiteSpeed cache, then reopen **Evpower → Elementor & plugins → Edit header with Elementor** (or Edit footer). Confirm Core 1.1.4 on the setup screen's version line. The preview selects the authenticated edited header/footer ID even when Elementor uses a normal page as preview context. It initializes the native Elementor preview for that document and calls `the_content()` with the document's post. Existing templates need no re-conversion or recreation. The public website keeps its normal templates and Pro display conditions. Keep both Elementor and Elementor Pro active.

Core 1.1.4 sends layout previews to WordPress's own `index.php` under the WordPress Address, with a document-specific nonce and Elementor's edit permissions. It binds both the document configuration and the completed editor settings, so document subclasses cannot leave the initial editor using a different preview URL. The signed route runs before later template dispatchers and marks responses as non-cacheable. Unsigned legacy previews remain supported; normal pages are not routed through this layout handler.

If the editor still fails, use **Check header preview / Check footer preview** on the Evpower editing screen. This checks HTTP status, the delivered version marker, native preview state and the requested editing area. Choose **Open editor with diagnostics** to inspect the actual editor iframe, then **Copy Evpower editor report**. Reports contain versions, domains, document IDs and readiness states; they omit query strings, nonce values, cookies and page content. The check is read-only and requires administrator access. No diagnostic details appear to public visitors, and no site/domain settings are changed.

### Critical error when clicking Prepare Elementor editing

Core 1.1.3 removes the direct call to Pro's conditions-saving handler that could produce **Cannot unset string offsets (conditions-manager.php)**. Preparation stores native metadata for missing defaults and leaves condition activation to **Templates → Theme Builder → Header/Footer → Display Conditions → Save**. Existing owner conditions are preserved; use **Include → Entire Site** only when that is the intended scope.

Preparation exceptions and PHP errors return details only to the administrator. Failed page saves restore their previous content, template and Elementor metadata. A failed Pro promotion restores the prior template type. The selected header/footer mode changes only after successful preparation. Missing DOM/XML support gives a PHP-extension setup message before conversion begins.

If preparation still stops, copy the displayed error and the Core/Elementor/Pro/PHP versions shown on the editor setup screen. A generic WordPress critical-error page still requires its recovery email's Error Details or the private Hostinger PHP error log; the screen itself does not identify the cause. Do not share recovery links or credentials. Memory exhaustion and plugin-load failures can occur outside the conversion exception handler and require their server error details.

### Change photos and the logo

For page photos, use **Pages → choose Home/About/etc. → Edit with Elementor**. The header editor controls header content. Hover the photo and click its pencil, then use **Content → Choose Image → Upload files / Media Library**. Select the replacement, click **Select** (or **Insert Media**, depending on the Elementor version), then **Publish/Update**. Changing the image in the library alone does not replace it on the page. If the floating Structure panel covers a photo, close it or select its Image widget through Structure. Core 1.1.1 makes the homepage photo selectable through its decorative layout layers. For the logo, edit the header's **Evpower Site Identity → Logo image** control. Product photos are managed under **Products → choose product → Product image / Product gallery**.

If an existing page has not been prepared for Elementor, first use **Evpower → Elementor & plugins → Enable Elementor** for that page. Standard page photos remain native Image widgets. An upload error or an empty media dialog needs its exact WordPress error message checked; the theme does not change WordPress upload permissions or file-size limits.

## Install into your existing Hostinger WordPress site

1. Back up the WordPress files and database in Hostinger. Use a staging copy to review the change before replacing the live design. Keep the old Next.js database separately if it contains orders or accounts.
2. Open **Hostinger hPanel → Websites → your WordPress website → WordPress Admin**. The administrator is the account created during that WordPress installation. The Next.js `ADMIN_EMAIL`/`ADMIN_PASSWORD` settings do not log you into WordPress. Hostinger’s WordPress Admin button can provide access without sharing credentials in chat.
3. Under **Plugins → Add New**, install and activate **WooCommerce** from the WordPress plugin directory. Complete its business setup as appropriate for Evpower.
4. Download [evpower.zip](packages/evpower.zip). In **Appearance → Themes → Add New → Upload Theme**, upload this file and activate **Evpower**.
5. Download [evpower-core.zip](packages/evpower-core.zip). In **Plugins → Add New → Upload Plugin**, upload this file and activate **Evpower Core**. Upload the two ZIPs separately; the theme ZIP belongs under Themes and the plugin ZIP under Plugins.
6. Open **Evpower → Setup & help**. Select **Set the Evpower Home page as this WordPress site’s homepage**. On a new site, also select **Use Post name URLs**. Then choose **Create missing starter content**. It preserves existing page content and products. Options let you set the new homepage and site identity, import draft sample products, and explicitly switch the Cart/Checkout pages to the classic shortcodes needed by the included Chapa gateway. The Cart/Checkout option replaces only those two pages’ content; leave it unchecked if you need to preserve a custom checkout.
7. If an existing page has the same address (for example `/about/`), setup keeps it. To use the Evpower design there, open the page and insert the corresponding **Evpower** pattern, then review and update it. **Settings → Reading** controls the homepage.
8. In **WooCommerce → Settings**, configure Ethiopia, Ethiopian birr (**ETB**), taxes, delivery zones/rates, guest checkout, and registration. Review actual product photos, specifications, prices, warranty, and stock. The optional six sample products are **drafts with zero stock**.
9. Complete and publish the Privacy Policy and Terms drafts. Assign them in **Settings → Privacy** and **WooCommerce → Settings → Advanced**. Supply real station records in **Evpower → Charging locations**. Setup creates no verified stations or invented availability.
10. Configure notification email under **Evpower → Setup & help** and configure Hostinger’s mail/SMTP service. Test a contact enquiry, a charging request, a guest order, account login, and any enabled payment method before setting **WooCommerce → Settings → Site visibility → Live**. Submissions are saved even if email delivery fails.

The packages do not change DNS, remove the deployed Next.js app, import its SQLite data, or change the hosted website by themselves. Move `evpower.et` to the reviewed WordPress installation through Hostinger only when ready. Existing Next.js accounts, password hashes, orders, invoices, images, and Website Studio revisions need a separate data migration; they are not silently copied into WordPress.

## Fix the default post or 404 menu links

If the Evpower header/footer appear around “Welcome to WordPress”, the theme is active but WordPress is still displaying its latest post. Open **Evpower → Setup & help**, select the homepage option, and create missing starter content. If the button is disabled, activate WooCommerce first. Version 1.0.1 fixes a setup-button bug in 1.0.0 that could keep the button disabled even when WooCommerce was active; upload the updated Evpower Core ZIP under Plugins and choose Replace current before retrying. If Home already exists, check it in **Pages** and confirm it is published.

Then open **Settings → Reading**, choose **A static page → Home**, and save. Open **Settings → Permalinks**, choose **Post name**, and save. Version 1.0.1 also offers the Post name choice on the setup screen; changing the site-wide URL structure requires selecting that option. Clear Hostinger/LiteSpeed page caches afterward. Existing page and template edits are preserved.

## Edit the website

| What to change | Where in WordPress |
| --- | --- |
| Elementor pages/header/footer | **Evpower → Elementor & plugins → Edit with Elementor** |
| Original block-editor page content | **Pages → choose page → Edit** |
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

Elementor integration uses the official stable **Elementor 4.3.6** release. All 31 Elementor integration checks and the Elementor browser suite passed, covering widget conversion, Media Library ownership, duplicate prevention, permissions, retaining owner edits, WordPress fallback layouts, responsive pages (including Full Width), and publishing actual Elementor page/header/footer edits. Pro’s public location API and display-condition exclusions are contract-tested with a local fixture; a licensed Pro ZIP is not bundled and was not available for a full Pro-plugin end-to-end test.

The 1.1.1 preview regression reproduces the exact missing-content-area dialog for both layouts using a saved Single template without a post-content block. It then verifies that both editors load their editable documents with the dedicated preview, and anonymous requests cannot activate it. The temporary Single template is removed afterward.

The media browser regression verifies that a regular About page photo opens its image controls and Media Library. It also selects the homepage Image widget on the canvas, uploads a photo through WordPress's native media dialog, publishes the changed image, verifies it on the public page, then selects the original library image and publishes its restoration. Only the uniquely identified test upload is removed afterward.

The 1.1.2 context regression reproduces an absent editable layout area when an ordinary page is used for header/footer preview. Both layouts then open, edit, save and restore through the real Elementor UI with that page context. All 18 preparation failure/API checks passed. They inject an exception after a document save and verify rollback and successful retry, preserve designs during promotion, and create new published layouts with editable data. The real dashboard also reports a readable preparation failure and retries successfully without a premature layout-mode switch. Local fixtures cover an inaccessible Pro conditions method and promotion failures; these are contract tests rather than execution of the licensed Pro plugin.

The 1.1.3 regression adds a public, record-oriented conditions handler that reproduces **Cannot unset string offsets** when given path strings. The old setup fails that case. Updated preparation succeeds without invoking that editor handler and preserves owner conditions and widget data. Pro display-condition activation is completed through its native Theme Builder UI.

The 1.1.4 regression models a document subclass overriding its preview URL after its parent configuration, a different preview domain, and an early `template_redirect` dispatcher. It demonstrates that the legacy request can be intercepted before `template_include`, then verifies direct-route header/footer editing and saves, diagnostics and clipboard reports, origin preservation, and rejection of guests, missing nonces and non-layout IDs. This fixture models preview lifecycle conflicts; the user's licensed Pro 4.3.3 package was not available for a full end-to-end run.

The 1.0.1 setup regression also runs through the real dashboard: it reproduces the default-post homepage, selects the homepage and Post name options, confirms the hero and six public page routes, and checks that repeated setup preserves settings when those options are not selected.

`python wordpress/package.py` rebuilds the two uploadable packages and their SHA-256 manifest. It packages only `evpower/` and `evpower-core/`, never local databases, test credentials, the testing mail/network fixture, or WordPress itself. Local fonts include their OFL licenses; vendored Leaflet includes its license and npm integrity record.

Tests run only against a disposable Docker runtime, with private generated credentials and no real email/payment calls. The runtime uses official WordPress PHP 8.3 and MariaDB 11.4 images. Run `python wordpress/tests/run.py` with Docker, Python Playwright, and Chromium available. It downloads official WooCommerce 11.2.1/WP-CLI when missing, creates or reuses only the labelled local test containers, and runs the integration and browser suites. Stop those servers with `python wordpress/tests/runtime.py stop`. Never point these tests at production. The fixed local target is checked before test data is changed.
