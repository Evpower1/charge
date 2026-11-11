# Evpower services website — 1.3.0

A responsive WordPress website for Mobile EV Charging, Charger Supply, Charger Installation and Charger Maintenance. Includes Home, Services, four service pages, About, Contact, Request a Quote and an unpublished privacy-policy draft. Uses Evpower's approved blue/cyan logo and company contact details.

## Review before installing

`packages/evpower-website-preview.zip` is a portable **design preview**, separate from the installable WordPress files. Extract it and open `index.html` in a browser. Its nine pages, images, navigation and FAQ work locally. Forms display a clear preview notice and do not send or save requests; the actual WordPress package supplies the functioning request form. The Cart, if shown, is also a preview control rather than a separate shop.

Desktop and phone screenshots are in `preview/`. No new website has been published to your domain.

## Install on your existing Hostinger WordPress site

1. Download `packages/evpower.zip` and `packages/evpower-core.zip`. Keep both ZIP files zipped. Back up the hosted website first using Hostinger's backup tools.
2. In **Appearance → Themes → Add New → Upload Theme**, upload `evpower.zip`. If Evpower is already installed, choose **Replace current with uploaded**, then activate it.
3. In **Plugins → Add New → Upload Plugin**, upload `evpower-core.zip`. Replace the existing Evpower Core if prompted, then activate it.
4. Keep **Elementor** and your licensed **Elementor Pro** active. No additional Elementor add-on pack is required.
5. Open **Evpower → Services website** and click **Prepare services website**. Leave the publish checkbox unchecked while reviewing. This creates separate draft pages and editable header/footer templates without replacing existing page designs, shop data or menus.
6. Use the **Edit with Elementor** and **Preview** links on that screen. When satisfied, click **Activate services website**. This publishes the nine public pages, selects the new homepage and layouts, and backs up the previous selections. The privacy policy remains a draft for your review.

Updating the ZIPs alone does not publish the new design. Existing site content and Elementor edits are preserved when preparation runs again. Slugs already used by other pages are avoided; the new page links remain connected to their IDs. The app and digital cards are separate and unchanged.

## Control your website

| What to change | Where |
| --- | --- |
| Text, headings, buttons, spacing and responsive settings | Evpower → Services website → page's **Edit with Elementor** |
| Photos and logo | Select the actual **Image** widget → **Choose Image**; use your Media Library |
| Global header and footer | **Header, footer and navigation** on the same screen, or Elementor Pro → Templates → Theme Builder |
| Navigation links | **Edit services navigation**; the header uses one separate four-link menu |
| Form labels, preselected service, button text, colours and type | Select the **Evpower Service Request** widget in Elementor |
| Form fields or advanced integrations | Replace the request widget with your own Elementor Pro Form, then configure its actions and delivery |
| Saved service requests | **Evpower → Enquiries**; records are private and available to administrators |
| Notification recipient | **Evpower → Setup & help → notification email** |
| Previous homepage and layout selection | **Evpower → Services website → Restore previous homepage and layouts** |

The new design uses individual native Elementor containers, text, headings, images and buttons, rather than a single HTML embed. Brand defaults are scoped to the new design; per-element Elementor style controls can override them. Header and footer previews use the existing protected WordPress/Elementor preview route that supplies the editable content area.

If the header/footer were prepared before Elementor Pro was activated, run **Prepare missing Elementor editing** after activating Pro. The templates are promoted without replacing the design. With Pro active, review their Theme Builder display conditions; the initial new templates use Entire Site. Activation temporarily drafts the previous assigned Pro header/footer to prevent overlapping layouts; Restore recovers their previous statuses and selections.

The page blocks are retained for restoration. Each service request is functional without WooCommerce or Pro Forms: it checks required details, consent, service selection and an optional date, saves a private record, then attempts a notification. It is a request, not an automatically confirmed appointment or payment.

## Finish before launch

- Review your service descriptions, coverage, business details and illustrative photos. Replace any image from Elementor's Image widget. No invented prices, guaranteed response times or station availability are included.
- Review and publish the privacy-policy draft, then add its published link to the editable footer and any form notice. The starter footer does not link to the unpublished draft.
- Set up authenticated email delivery with **WP Mail SMTP** and test it on your own site. Requests stay saved even if email delivery fails.
- Optionally install **one** SEO plugin (for example Yoast SEO) and **LiteSpeed Cache** if supported by your Hostinger plan. Their official installer links are under **Evpower → Elementor & plugins**. Configure them after installation.
- WooCommerce is optional. It is needed only if you add product sales; the header shows one Cart link if WooCommerce is active when the header is prepared. Remove that link in Elementor if you do not operate a shop. Shop products, inventory, payment settings, orders and accounts are not reset by service setup.
- Check phone, WhatsApp and email links, send a test enquiry, and review your mobile view in Elementor. Clear WordPress/Hostinger cache after uploading an update.

## Verification and limits

Verified in an isolated WordPress 7.1.4 / PHP 8.3 environment using Elementor 4.3.6, with and without WooCommerce. Integration checks cover permissions, nonces, input validation, private records, rate limits, real editable widgets, imported media, draft defaults, owner-edit preservation, activation rollback and restoring prior selections. Browser checks cover mobile/desktop layouts, navigation, form submission and the actual Elementor editing interface. Test email is intercepted; no customer or hosted-site data is used.

The licensed Elementor Pro package is not bundled. Pro location/preview integration is maintained using its public APIs and compatibility fixtures; your licensed Pro installation must be checked on the hosted site. This package does not install itself on Hostinger, connect live charger hardware, process payments or publish the domain.

## Developer checks

The local harness in `tests/runtime.py` operates only on labelled disposable Docker containers at `http://localhost:8094`. Never point it at production.

```sh
python wordpress/tests/runtime.py wp --user=evpower-test-admin eval-file /test-scripts/services-site.integration.php
python wordpress/tests/runtime.py wp --skip-plugins=woocommerce --user=evpower-test-admin eval-file /test-scripts/services-site.integration.php
python wordpress/tests/runtime.py wp --user=evpower-test-admin eval-file /test-scripts/services-forms.integration.php
/tmp/evpower-card-tools/bin/python wordpress/tests/services-browser.py
python wordpress/package.py
```

The setup integration checks intentionally recreate their own local service fixtures. Run them before browser checks. Do not package test runtime files or credentials. ZIP checksums and sizes are recorded in `packages/manifest.json`.
