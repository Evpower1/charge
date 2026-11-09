# Evpower emblem preloader

A standalone preloader using Evpower's blue-and-cyan car, charging pulse and connector emblem. A light trail follows the pulse and illuminates the connector contacts; a blue-to-cyan charging indicator sits below the artwork.

Current version: **1.0.1**. The artwork and animation accents use blue and cyan, with versioned asset URLs to refresh existing browser caches after an update.

## Downloads

- [Download WordPress plugin ZIP](https://github.com/Evpower1/charge/raw/refs/heads/main/wordpress/preloader/dist/evpower-preloader.zip?download=1).
- [Download interactive HTML preview](https://github.com/Evpower1/charge/raw/refs/heads/main/wordpress/preloader/dist/evpower-preloader-preview.html?download=1); choose Replay or Show page.
- [Download animated GIF](https://github.com/Evpower1/charge/raw/refs/heads/main/wordpress/preloader/dist/evpower-preloader.gif?download=1): looping preview, 480 × 240.
- [Download MP4 preview](https://github.com/Evpower1/charge/raw/refs/heads/main/wordpress/preloader/dist/evpower-preloader-preview.mp4?download=1).

## Install in WordPress

1. For Evolta, turn off its built-in page preloader in Theme Options when using this plugin.
2. Open **Plugins → Add New → Upload Plugin**, upload `evpower-preloader.zip`, then activate **Evpower Emblem Preloader**. For an existing installation, choose **Replace current with uploaded**.
3. Open **Appearance → Evpower Preloader**. Enable/disable the preloader, choose once per browser tab or every eligible page, and change or hide the loading caption.
4. Clear the website's page cache after installing or changing settings. Open the public site in a new browser tab to see the first-visit animation.

The plugin works with normal WordPress theme hooks and is independent of the earlier Evpower theme/Core plugin. It does not need Elementor or an Elementor Pro licence. It includes no remote fonts, libraries, trackers or service calls. If a performance plugin delays all scripts, exempt `assets/preloader.js` / `evpower-emblem-preloader` from delayed execution.

## Loading and accessibility

The overlay clears when the browser's page-load event fires, with a brief 640 ms minimum on ordinary motion settings and a 280 ms fade. A six-second JavaScript limit and an independent seven-second CSS release keep a slow or interrupted page accessible. The loading bar is indeterminate; it does not invent a progress percentage. Visitors can choose Skip animation or press Escape. No keyboard focus trap or scroll lock is added.

Reduced-motion visitors get a still emblem and no moving light trail or loading bar. Their overlay clears on readiness without the minimum hold or fade. Without JavaScript the overlay is hidden. Restricted session storage does not prevent the page from working. Restoring a page with the browser's Back/Forward cache clears stale overlays.

WordPress administration, Elementor editing and template previews, WordPress previews, the Customizer, feeds, REST requests, and WooCommerce Cart/Checkout/My Account pages are excluded. The plugin does not change pages, products, customer accounts, orders, payment settings or theme files.

The GIF and MP4 are visual previews. The WordPress plugin provides page-readiness dismissal, skip controls, frequency settings and reduced-motion behaviour.

## Build and check

Run `python build.py` to generate the plugin ZIP, self-contained preview and SHA256 manifest. `tests/browser.py` uses locally installed Playwright, Chromium and ffmpeg to check loading behaviour, storage failure, JavaScript-disabled access, reduced motion, CSS safety release, keyboard/skip dismissal and 320–1440px layouts, then records the animation. WordPress integration checks are in `tests/wordpress.py`.

No hosted website was changed during creation; the ZIP must be installed in the chosen WordPress site.

## Validation

Browser checks passed for page readiness, first-tab frequency, skip/Escape, slow-resource timeout, reduced motion, missing JavaScript, blocked storage, independent CSS release, Back/Forward restoration and 320/390/768/1440px layouts. GIF and MP4 previews were rendered from the actual browser animation.

Native WordPress 7.1.4 checks passed for installation/activation, actual settings saves and sanitation, single overlay/head asset order, invalid nonce and subscriber rejection, disable controls, Elementor/WordPress previews, and WooCommerce transaction-page exclusions. Tests used a disposable local installation; its settings and temporary user were restored. Package contents, directory/file permissions, ZIP CRC and SHA256 values were verified.
