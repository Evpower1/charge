"""Accept the services site in the disposable local WordPress + Elementor runtime.

Run with /tmp/evpower-card-tools/bin/python wordpress/tests/services-browser.py.
Requires services-site.integration.php fixtures; never targets a hosted site.
Use --editing-only for save/restore checks or --responsive-only for final screenshots.
"""
import asyncio
import base64
import json
import re
import sys
import uuid

from playwright.async_api import async_playwright, expect
from runtime import TEMP, docker, wp

BASE = 'http://localhost:8094'
SCREENSHOTS = TEMP / 'services-browser'
EDITING_ONLY = '--editing-only' in sys.argv
RESPONSIVE_ONLY = '--responsive-only' in sys.argv


def php_json(code):
    return json.loads(wp('eval', 'echo wp_json_encode(' + code + ');'))


async def dismiss_editor_overlays(page):
    for name in ['Close', 'Close Structure', 'Close structure']:
        buttons = page.get_by_role('button', name=name, exact=True)
        for button in await buttons.all():
            if await button.is_visible():
                await button.click()


async def choose_widget(page, widget):
    await widget.scroll_into_view_if_needed()
    await widget.hover()
    await widget.locator('.elementor-editor-element-edit').first.click()


async def save_and_check(page, visitor, url, selector, expected, attribute=None):
    publish = page.get_by_role('button', name=re.compile(r'^(Publish|Update)$'))
    await publish.last.click()
    for _ in range(30):
        await visitor.goto(url, wait_until='domcontentloaded')
        target = visitor.locator(selector).first
        actual = await target.get_attribute(attribute) if attribute else await target.inner_text()
        if actual == expected:
            return
        await page.wait_for_timeout(250)
    raise AssertionError('The saved Elementor edit did not reach the public page: ' + selector + '; expected=' + repr(expected) + ', actual=' + repr(actual))


async def select_library_image(page, image_widget, attachment_id, title):
    await choose_widget(page, image_widget)
    await page.locator('.elementor-control-image .elementor-control-media__content').click()
    modal = page.locator('.media-modal:visible')
    await expect(modal).to_be_visible()
    await modal.get_by_role('tab', name='Media Library', exact=True).click()
    await modal.locator('input[type="search"]').fill(title)
    choice = modal.locator('.attachment[data-id="' + str(attachment_id) + '"]')
    await expect(choice).to_be_visible(timeout=30000)
    if 'selected' not in (await choice.get_attribute('class')).split():
        await choice.click()
    await modal.locator('.media-button-select').click()


async def main():
    # These guards must pass before this test creates or changes any local record.
    assert wp('option', 'get', 'home') == BASE, 'Disposable local WordPress required.'
    assert wp('eval', 'echo wp_get_environment_type();') == 'local'
    assert wp('eval', 'echo false !== has_filter("pre_wp_mail", "__return_true") ? "intercepted" : "unsafe";') == 'intercepted', 'Test notification interceptor required.'
    fixtures = json.loads(docker('exec', 'evpower-wp-test', 'cat', '/tmp/evpower-services-fixtures.json'))
    credentials = json.loads((TEMP / 'credentials.json').read_text())
    urls = php_json('array_combine(array_keys(get_option("evpower_services_pages")),array_map("get_permalink",get_option("evpower_services_pages")))')
    assert all(url.startswith(BASE + '/') for url in urls.values())
    assert wp('post', 'get', str(fixtures['pages']['privacy']), '--field=post_status') == 'draft'
    SCREENSHOTS.mkdir(exist_ok=True)
    original_home = wp('post', 'meta', 'get', str(fixtures['pages']['home']), '_elementor_data')
    original_footer = wp('post', 'meta', 'get', str(fixtures['layouts']['footer']), '_elementor_data')
    created_enquiries = []
    request_name = 'Browser Acceptance ' + uuid.uuid4().hex[:8]
    changed_heading = False
    changed_image = False
    changed_footer = False
    errors = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        visitor_context = await browser.new_context(viewport={'width':1440, 'height':1000}, reduced_motion='reduce')
        visitor = await visitor_context.new_page()
        visitor.on('pageerror', lambda error: errors.append(str(error)))
        owner_context = await browser.new_context(viewport={'width':1600, 'height':1100})
        owner = await owner_context.new_page()
        try:
            # Every public service page must remain readable and contained at narrow widths.
            for width in ([] if EDITING_ONLY else [320, 390, 768, 1440]):
                await visitor.set_viewport_size({'width':width, 'height':900})
                for key, url in urls.items():
                    if key == 'privacy':
                        continue
                    response = await visitor.goto(url, wait_until='networkidle')
                    assert response.status == 200, (key, width, response.status)
                    await expect(visitor.locator('main h1')).to_have_count(1)
                    await expect(visitor.locator('main h1')).to_be_visible()
                    await expect(visitor.locator('.evs-header')).to_be_visible()
                    await expect(visitor.locator('.evs-footer')).to_be_visible()
                    dimensions = await visitor.evaluate('({width:innerWidth,content:document.documentElement.scrollWidth})')
                    assert dimensions['content'] <= dimensions['width'] + 1, (key, width, dimensions)
                    # Trigger lazy images and verify real image responses, not empty placeholders.
                    images = visitor.locator('.evs-page img, .evs-header img, .evs-footer img')
                    await images.evaluate_all('(images) => images.forEach(image => image.loading = "eager")')
                    await visitor.wait_for_function('Array.from(document.querySelectorAll(".evs-page img, .evs-header img, .evs-footer img")).every(image => image.complete && image.naturalWidth > 0)')
                    assert await images.count() >= 2, key
                    header = visitor.locator('.evs-header')
                    await expect(header.locator('.evs-brand-image a')).to_have_attribute('href', urls['home'])
                    await expect(header.get_by_role('link', name='Request a quote', exact=True)).to_be_visible()
                    assert await header.get_by_role('link', name='Cart', exact=True).count() <= 1
                    if key in ['home', 'installation', 'quote'] and width in [390, 1440]:
                        await visitor.screenshot(path=str(SCREENSHOTS / f'{key}-{width}.png'), full_page=True)
                print(f'PASS: all nine public pages return 200, contain one H1 and loaded images, and fit {width}px')

            if RESPONSIVE_ONLY:
                assert not errors, errors
                print('PASS: final responsive checks and screenshots are complete; no content was changed.')
                return

            if not EDITING_ONLY:
                # The real mobile menu must open and follow the allocated services page URL.
                await visitor.set_viewport_size({'width':390, 'height':844})
                await visitor.goto(urls['home'], wait_until='networkidle')
                header = visitor.locator('.evs-header')
                toggle = header.get_by_role('button', name='Open menu', exact=True)
                await expect(toggle).to_be_visible()
                await toggle.click()
                menu = header.locator('.is-menu-open')
                await expect(menu).to_be_visible()
                await expect(menu.get_by_role('link')).to_have_count(4)
                await menu.get_by_role('link', name='Services', exact=True).click()
                await expect(visitor).to_have_url(urls['services'])
                await expect(visitor.locator('main h1')).to_contain_text('Charging support')
                print('PASS: the mobile menu exposes four links and navigates to the allocated services page')

                # Submit a real anonymous request; notifications are intercepted by the local MU plugin.
                before = set(php_json('get_posts(array("post_type"=>"ev_enquiry","post_status"=>"private","numberposts"=>-1,"fields"=>"ids"))'))
                await visitor.goto(urls['quote'] + ('&' if '?' in urls['quote'] else '?') + 'service=installation', wait_until='networkidle')
                form = visitor.get_by_role('form', name='Service request', exact=True)
                await expect(form.locator('[name="service"]')).to_have_value('installation')
                await form.get_by_label('Full name', exact=True).fill(request_name)
                await form.get_by_label('Email address', exact=True).fill('acceptance@example.test')
                await form.get_by_label('Phone number', exact=True).fill('+251911000001')
                await form.get_by_label('City / area', exact=True).fill('Addis Ababa test fixture')
                await form.get_by_label('Tell us what you need', exact=True).fill('Disposable browser test: assess a home charger installation.')
                await form.locator('[name="consent"]').check()
                await form.get_by_role('button', name='Send request', exact=True).click()
                await expect(visitor.locator('.evs-request__notice[role="status"]')).to_contain_text('Your request is saved')
                after = set(php_json('get_posts(array("post_type"=>"ev_enquiry","post_status"=>"private","numberposts"=>-1,"fields"=>"ids"))'))
                created_enquiries = list(after - before)
                assert 'evs_request=saved' in visitor.url
                assert len(created_enquiries) == 1
                enquiry = created_enquiries[0]
                assert wp('post', 'meta', 'get', str(enquiry), '_ev_service_id') == 'installation'
                assert wp('post', 'get', str(enquiry), '--field=post_status') == 'private'
                assert (await visitor_context.request.get(BASE + '/?post_type=ev_enquiry&p=' + str(enquiry))).status == 404
                print('PASS: an anonymous form submission saves one private enquiry and shows a clear confirmation')

            # Use the same actual editor that the owner will use for images and layout.
            await owner.goto(BASE + '/wp-login.php', wait_until='domcontentloaded')
            await owner.locator('#user_login').fill(credentials['username'])
            await owner.locator('#user_pass').fill(credentials['password'])
            await owner.locator('#wp-submit').click()
            await owner.wait_for_url('**/wp-admin/**')
            for area, document in [('header', fixtures['layouts']['header']), ('footer', fixtures['layouts']['footer']), ('home', fixtures['pages']['home'])]:
                await owner.goto(BASE + '/wp-admin/post.php?post=' + str(document) + '&action=elementor', wait_until='domcontentloaded')
                frame = owner.frame_locator('#elementor-preview-iframe')
                await expect(frame.locator('.elementor-edit-area-active[data-elementor-id="' + str(document) + '"]')).to_be_visible(timeout=45000)
                await expect(owner.get_by_text('Sorry, the content area was not found in your page.', exact=True)).to_have_count(0)
                await owner.wait_for_timeout(600)
                await dismiss_editor_overlays(owner)
                image_class = {'header':'evs-brand-image','footer':'evs-footer-logo','home':'evs-hero-image'}[area]
                widget = frame.locator('.' + image_class + '.elementor-widget-image')
                await expect(widget).to_be_visible()
                await choose_widget(owner, widget)
                await expect(owner.locator('.elementor-control-image')).to_be_visible()
                await owner.locator('.elementor-control-image .elementor-control-media__content').click()
                await expect(owner.locator('.media-modal:visible')).to_be_visible()
                await owner.locator('.media-modal:visible .media-modal-close').click()
                await owner.screenshot(path=str(SCREENSHOTS / f'elementor-{area}-editable.png'))
                print(f'PASS: {area} opens a real Elementor editing area and its image opens the Media Library')

            # Replace a real photo through WordPress's native Media Library, save and restore.
            frame = owner.frame_locator('#elementor-preview-iframe')
            image_widget = frame.locator('.evs-hero-image.elementor-widget-image')
            original_image_url = await image_widget.locator('img').get_attribute('src')
            original_image_class = await image_widget.locator('img').get_attribute('class')
            original_image_id = re.search(r'wp-image-(\d+)', original_image_class).group(1)
            alternatives = php_json('get_posts(array("post_type"=>"attachment","post_status"=>"inherit","numberposts"=>1,"fields"=>"ids","meta_key"=>"_evpower_source_image","meta_value"=>get_theme_file_uri("assets/images/services-installation.png")))')
            assert alternatives and str(alternatives[0]) != original_image_id
            alternative_id = alternatives[0]
            alternative_title = wp('post', 'get', str(alternative_id), '--field=post_title')
            alternative_url = wp('eval', 'echo wp_get_attachment_url(' + str(alternative_id) + ');')
            original_image_title = wp('post', 'get', original_image_id, '--field=post_title')
            changed_image = True
            await select_library_image(owner, image_widget, alternative_id, alternative_title)
            await expect(image_widget.locator('img')).to_have_attribute('src', alternative_url)
            await save_and_check(owner, visitor, urls['home'], '.evs-hero-image img', alternative_url, 'src')
            await select_library_image(owner, image_widget, original_image_id, original_image_title)
            await save_and_check(owner, visitor, urls['home'], '.evs-hero-image img', original_image_url, 'src')
            changed_image = False
            print('PASS: choosing another Media Library photo updates the public homepage after Publish and the original image can be restored')

            # Publish an actual heading edit, observe it publicly, then restore the original.
            heading = frame.locator('.elementor-widget-heading').filter(has=frame.locator('h1'))
            await choose_widget(owner, heading)
            title = owner.locator('.elementor-control-title textarea')
            await expect(title).to_be_visible()
            original_title = await title.input_value()
            edited_title = 'EV charging, shaped around you.'
            await title.fill(edited_title)
            await title.dispatch_event('change')
            changed_heading = True
            await save_and_check(owner, visitor, urls['home'], 'main h1', edited_title)
            await title.fill(original_title)
            await title.dispatch_event('change')
            await save_and_check(owner, visitor, urls['home'], 'main h1', original_title)
            changed_heading = False
            print('PASS: an owner can publish a native Elementor heading edit and restore it through the editor')

            # A footer text edit must be global, including pages other than the preview.
            await owner.goto(BASE + '/wp-admin/post.php?post=' + str(fixtures['layouts']['footer']) + '&action=elementor', wait_until='domcontentloaded')
            frame = owner.frame_locator('#elementor-preview-iframe')
            widget = frame.locator('.evs-footer-heading.elementor-widget-text-editor').first
            await expect(widget).to_be_visible(timeout=45000)
            await dismiss_editor_overlays(owner)
            await choose_widget(owner, widget)
            await owner.locator('.elementor-control-editor .switch-tmce').click()
            footer_field = owner.frame_locator('.elementor-control-editor iframe').locator('body')
            await expect(footer_field).to_be_visible()
            original_footer_text = await widget.inner_text()
            changed_footer = True
            for value in ['Services & support', original_footer_text]:
                await footer_field.fill(value)
                await footer_field.press('Tab')
                await owner.wait_for_timeout(250)
                expected = value
                await save_and_check(owner, visitor, urls['contact'], '.evs-footer-heading', expected)
                await visitor.goto(urls['services'], wait_until='domcontentloaded')
                await expect(visitor.locator('.evs-footer-heading').first).to_have_text(expected)
            changed_footer = False
            print('PASS: a footer text edit publishes globally on Contact and Services and is restored through the editor')
            assert not errors, errors
        except Exception:
            await visitor.screenshot(path=str(SCREENSHOTS / 'visitor-failure.png'), full_page=True)
            await owner.screenshot(path=str(SCREENSHOTS / 'owner-failure.png'))
            raise
        finally:
            for changed, document, data in [(changed_heading or changed_image, fixtures['pages']['home'], original_home), (changed_footer, fixtures['layouts']['footer'], original_footer)]:
                if changed:
                    encoded = base64.b64encode(data.encode()).decode()
                    wp('eval', '\\Elementor\\Plugin::$instance->documents->get(' + str(document) + ')->save(array("elements"=>json_decode(base64_decode("' + encoded + '"),true)));')
            # Also collect this request if a browser assertion failed just after submission.
            matching = php_json('get_posts(array("post_type"=>"ev_enquiry","post_status"=>"private","numberposts"=>-1,"fields"=>"ids","s"=>"' + request_name + '"))')
            for enquiry in set(created_enquiries + matching):
                wp('post', 'delete', str(enquiry), '--force')
            await browser.close()
    print('PASS: ' + ('actual Elementor image, heading and footer save/restore controls are verified' if EDITING_ONLY else 'responsive pages, mobile navigation, request delivery and actual Elementor save/restore controls are verified') + '; no hosted site was changed.')


if __name__ == '__main__':
    asyncio.run(main())
