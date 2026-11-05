"""Exercise actual Elementor editing and responsive storefront behaviour locally."""
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright, expect
from runtime import wp

BASE = 'http://localhost:8094'
TEMP = Path('/tmp/evpower-wordpress-test')
CREDENTIALS = json.loads((TEMP / 'credentials.json').read_text())
FIXTURES = json.loads((TEMP / 'elementor-fixtures.json').read_text())

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        public = await browser.new_context(viewport={'width':1440,'height':1000})
        await public.route('https://tile.openstreetmap.org/**', lambda r: r.fulfill(status=200, content_type='image/png', body=bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082')))
        visitor = await public.new_page()
        async def check_header_controls():
            simple = await visitor.locator('header .ep-header-simple').count() > 0
            assert await visitor.locator('header a[aria-label="Sign in"]' if simple else 'header a[aria-label="Account"]').count() == 1
            assert await visitor.locator('header a[aria-label="Cart"]').count() == 1
        errors = []
        visitor.on('pageerror', lambda error: errors.append(str(error)))
        if not os.environ.get('EVPOWER_TEST_EDITOR_ONLY'):
            for width in [1440,320,390,768]:
                await visitor.set_viewport_size({'width':width,'height':1000 if width == 1440 else 844})
                for path in ['/','/services/','/locations/','/about/','/contact/','/book-charging/','/faq/','/shop/','/my-account/']:
                    response = await visitor.goto(BASE + path, wait_until='networkidle')
                    assert response.status == 200, path
                    assert await visitor.locator('main h1').count() == 1, path
                    assert not await visitor.evaluate('document.documentElement.scrollWidth > innerWidth'), (path,width)
                    await check_header_controls()
                print(f'PASS: Elementor pages and chosen account/cart controls at {width}px')
            await visitor.set_viewport_size({'width':1440,'height':1000})
            await visitor.goto(BASE + '/', wait_until='networkidle')
            await expect(visitor.locator('.ep-hero h1')).to_have_css('color','rgb(255, 255, 255)')
            await visitor.screenshot(path=str(TEMP / 'elementor-desktop.png'), full_page=True)
            await visitor.set_viewport_size({'width':390,'height':844})
            await visitor.screenshot(path=str(TEMP / 'elementor-mobile.png'), full_page=True)
            await visitor.get_by_role('button', name='Open menu', exact=True).click()
            simple = await visitor.locator('header .ep-header-simple').count() > 0
            await visitor.locator('.is-menu-open').get_by_role('link', name='Services' if simple else 'Contact Us', exact=True).click()
            await expect(visitor.locator('main h1')).to_have_text('Our Services' if simple else 'Contact Us')
            print('PASS: accessible mobile navigation and preserved readable hero styling')

        admin = await browser.new_context(viewport={'width':1600,'height':1100})
        page = await admin.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto(BASE + '/wp-login.php', wait_until='domcontentloaded')
        await page.locator('#user_login').fill(CREDENTIALS['username'])
        await page.locator('#user_pass').fill(CREDENTIALS['password'])
        await page.locator('#wp-submit').click()
        await page.wait_for_url('**/wp-admin/**')
        await page.goto(BASE + '/wp-admin/admin.php?page=evpower-elementor', wait_until='domcontentloaded')
        await expect(page.get_by_role('heading', name='Your Evpower website — Elementor & plugins')).to_be_visible()
        await expect(page.get_by_role('link', name='Edit header with Elementor')).to_be_visible()
        await expect(page.get_by_role('link', name='Edit footer with Elementor')).to_be_visible()
        for plugin in ['Yoast SEO','WP Mail SMTP','LiteSpeed Cache']:
            await expect(page.get_by_text(plugin, exact=True)).to_be_visible()
        print('PASS: owner dashboard exposes page/header/footer editing and focused plugin installation controls')

        home_id = str(FIXTURES['pages']['home'])
        original_template = wp('post', 'meta', 'get', home_id, '_wp_page_template')
        try:
            wp('post', 'meta', 'update', home_id, '_wp_page_template', 'elementor_header_footer')
            for width in [1440,390]:
                await visitor.set_viewport_size({'width':width,'height':1000})
                await visitor.goto(BASE + '/', wait_until='networkidle')
                await expect(visitor.locator('main h1')).to_contain_text('A better way')
                await expect(visitor.locator('header .ep-identity-link')).to_have_text('Evpower')
                await check_header_controls()
                await expect(visitor.locator('footer .elementor')).to_have_count(1)
                assert not await visitor.evaluate('document.documentElement.scrollWidth > innerWidth')
            print('PASS: Elementor Full Width preserves the editable header/footer on desktop and mobile')
        finally:
            wp('post', 'meta', 'update', home_id, '_wp_page_template', original_template)

        async def open_editor(url):
            await page.goto(url, wait_until='domcontentloaded')
            frame = page.frame_locator('iframe#elementor-preview-iframe')
            await expect(frame.locator('.elementor').first).to_be_visible(timeout=30000)
            await page.wait_for_timeout(1200)
            close = page.get_by_role('dialog').get_by_role('button', name='Close', exact=True)
            if await close.count():
                await close.first.click()
            return frame

        async def publish_and_check(path, selector, expected, exact=False):
            await page.get_by_role('button', name='Publish', exact=True).click()
            for attempt in range(20):
                await visitor.goto(BASE + path, wait_until='domcontentloaded')
                text = await visitor.locator(selector).inner_text()
                if ( text == expected if exact else expected in text ):
                    return
                await page.wait_for_timeout(300)
            raise AssertionError('Elementor save was not reflected on the public page: ' + selector)

        async def edit_control(field, value):
            await field.fill(value)
            await field.press('End')
            await field.dispatch_event('change')

        async def select_widget(widget):
            await widget.hover()
            await widget.locator('.elementor-editor-element-edit').first.click()

        frame = await open_editor(BASE + '/wp-admin/post.php?post=' + str(FIXTURES['pages']['home']) + '&action=elementor')
        await select_widget(frame.locator('.elementor-widget-heading:has(h1)').first)
        close = page.get_by_role('dialog').get_by_role('button', name='Close', exact=True)
        if await close.count():
            await close.first.click()
            await select_widget(frame.locator('.elementor-widget-heading:has(h1)').first)
        title = page.locator('.elementor-control-title textarea')
        await expect(title).to_be_visible()
        original = await title.input_value()
        try:
            await edit_control(title, 'Your electric future. Your control.')
            await expect(frame.locator('h1').first).to_have_text('Your electric future. Your control.')
            await publish_and_check('/', 'main h1', 'Your electric future. Your control.')
            await page.screenshot(path=str(TEMP / 'elementor-editor.png'))
            print('PASS: editing and publishing a real Elementor heading updates the public homepage')
        finally:
            await edit_control(title, original)
            await publish_and_check('/', 'main h1', 'A better way')

        frame = await open_editor(FIXTURES['header_editor'])
        await select_widget(frame.locator('.elementor-widget-evpower-identity').first)
        identity = page.locator('.elementor-control-title input')
        await expect(identity).to_be_visible()
        original = await identity.input_value()
        try:
            await edit_control(identity, 'Evpower Owner Edit')
            await expect(frame.locator('.ep-identity-link')).to_contain_text('Evpower Owner Edit')
            await publish_and_check('/services/', 'header .ep-identity-link', 'Evpower Owner Edit', exact=True)
            assert 'Evpower Owner Edit' not in await visitor.locator('footer').inner_text()
            print('PASS: the header is globally editable in Elementor without changing the footer')
        finally:
            await edit_control(identity, original)
            await publish_and_check('/', 'header .ep-identity-link', 'Evpower', exact=True)

        frame = await open_editor(FIXTURES['footer_editor'])
        await select_widget(frame.locator('.elementor-widget-heading:has(h3)').first)
        title = page.locator('.elementor-control-title textarea')
        await expect(title).to_be_visible()
        original = await title.input_value()
        try:
            await edit_control(title, 'Discover Evpower')
            await publish_and_check('/contact/', 'footer', 'Discover Evpower')
            print('PASS: the footer is globally editable and publishable in Elementor')
        finally:
            await edit_control(title, original)
            await publish_and_check('/', 'footer', original)
        assert not errors, errors
        print('PASS: no browser JavaScript exceptions')
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
