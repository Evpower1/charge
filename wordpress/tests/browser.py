"""Real WordPress editor/storefront checks. Uses generated local test credentials only."""
import asyncio
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from playwright.async_api import async_playwright, expect

BASE = 'http://localhost:8094'
TEMP = Path('/tmp/evpower-wordpress-test')
CREDENTIALS = json.loads((TEMP / 'credentials.json').read_text())
FIXTURES = json.loads((TEMP / 'fixtures.json').read_text())

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        context = await browser.new_context(viewport={'width':1440,'height':1000})
        # The local network policy has no map-tile grant. Keep map controls/pins real
        # and replace only external raster tiles with a harmless local test image.
        await context.route('https://tile.openstreetmap.org/**', lambda route: route.fulfill(status=200, content_type='image/png', body=bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082')))
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        if not os.environ.get('EVPOWER_TEST_FLOWS_ONLY'):
            paths = ['/', '/services/', '/locations/', '/shop/', '/about/', '/contact/', '/book-charging/', '/faq/', '/my-account/', '/cart/']
            for path in paths:
                response = await page.goto(BASE + path, wait_until='networkidle')
                assert response.status == 200, path
                assert await page.locator('main h1').count() == 1, path
                assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth'), path
                assert '[products ' not in await page.locator('body').inner_text(), path
                assert 'Great things are on the horizon' not in await page.locator('main').inner_text(), path
                if path == '/shop/':
                    assert await page.locator('main .product').count() > 0
            await page.goto(BASE + '/', wait_until='networkidle')
            await page.screenshot(path=str(TEMP / 'desktop.png'), full_page=True)
            print('PASS: ten public pages, native WooCommerce and single primary headings')
            for width in [320,390,768]:
                await page.set_viewport_size({'width':width,'height':844})
                for path in paths:
                    await page.goto(BASE + path, wait_until='networkidle')
                    assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth'), (path,width)
                if width == 390:
                    await page.goto(BASE + '/', wait_until='networkidle')
                    await page.screenshot(path=str(TEMP / 'mobile.png'), full_page=True)
                print(f'PASS: mobile/tablet pages at {width}px without horizontal overflow')

            await page.set_viewport_size({'width':390,'height':844})
            await page.goto(BASE + '/', wait_until='networkidle')
            await page.get_by_role('button', name='Open menu', exact=True).click()
            simple = await page.locator('header .ep-header-simple').count() > 0
            await page.locator('.is-menu-open').get_by_role('link', name='Services' if simple else 'Contact Us', exact=True).click()
            await expect(page.locator('main h1')).to_have_text('Our Services' if simple else 'Contact Us')
            print('PASS: native mobile navigation opens and follows a page link')

            await page.goto(BASE + '/locations/', wait_until='networkidle')
            await expect(page.locator('.leaflet-container')).to_be_visible()
            await expect(page.locator('.ep-station:visible')).to_have_count(2)
            await page.locator('.ep-city-filter').select_option('Adama')
            await expect(page.locator('.ep-station:visible')).to_have_count(1)
            await page.locator('.ep-verified-filter').check()
            await expect(page.locator('.ep-station:visible')).to_have_count(0)
            await expect(page.locator('.ep-no-stations')).to_be_visible()
            await page.locator('.ep-city-filter').select_option('Addis Ababa')
            await page.get_by_role('button', name='Test Bole station').click()
            await expect(page.locator('.leaflet-popup')).to_contain_text('Test Bole station')
            print('PASS: interactive map, city/verification filters and station selection')

        if not os.environ.get('EVPOWER_TEST_EDITOR_ONLY'):
            await page.goto(BASE + '/contact/', wait_until='networkidle')
            await page.get_by_label('Full name', exact=True).fill('WordPress browser contact')
            await page.get_by_label('Email address', exact=True).fill('browser@example.test')
            await page.locator('select[name=topic]').select_option('Business partnership')
            await page.get_by_label('Your message', exact=True).fill('A local automated test of the private enquiry workflow.')
            await page.locator('input[name=consent]').check()
            await page.get_by_role('button', name='Send your message').click()
            await expect(page.get_by_role('heading', name='Thanks for reaching out.')).to_be_visible()
            await page.goto(BASE + '/book-charging/', wait_until='networkidle')
            await page.get_by_label('Full name', exact=True).fill('WordPress browser driver')
            await page.get_by_label('Email address', exact=True).fill('driver-browser@example.test')
            await page.get_by_label('Phone number', exact=True).fill('+251911000000')
            await page.get_by_label('Preferred date', exact=True).fill((datetime.now()+timedelta(days=2)).strftime('%Y-%m-%d'))
            await page.get_by_label('Your location', exact=True).fill('Bole local test address')
            await page.locator('input[name=consent]').check()
            await page.get_by_role('button', name='Request charging').click()
            await expect(page.get_by_role('heading', name='Your charging request is in.')).to_be_visible()
            print('PASS: guest contact and charging request submissions')

            await page.goto(FIXTURES['product_url'], wait_until='networkidle')
            await page.get_by_role('button', name='Add to cart', exact=True).click()
            await page.goto(BASE + '/cart/', wait_until='networkidle')
            await expect(page.locator('main')).to_contain_text('100.00')
            await page.get_by_role('link', name='Proceed to checkout').click()
            await expect(page.locator('main')).to_contain_text('Billing details')
            await expect(page.get_by_label('Request an installation quote', exact=False)).to_be_visible()
            assert await page.locator('input[value=evpower_chapa]').count() == 0
            bad = await context.request.get(BASE + '/wp-admin/admin-post.php?action=evpower_receipt&order_id=' + str(FIXTURES['guest_order_id']) + '&key=invalid')
            assert bad.status == 403
            receipt = await context.request.get(BASE + '/wp-admin/admin-post.php?action=evpower_receipt&order_id=' + str(FIXTURES['guest_order_id']) + '&key=' + FIXTURES['guest_order_key'])
            assert receipt.ok and 'Payment receipt' in await receipt.text()
            print('PASS: product/cart/checkout, optional installation request, disabled unconfigured payments and private receipts')

        await page.set_viewport_size({'width':1440,'height':1100})
        await page.goto(BASE + '/wp-login.php', wait_until='networkidle')
        await page.locator('#user_login').fill(CREDENTIALS['username'])
        await page.locator('#user_pass').fill(CREDENTIALS['password'])
        await page.locator('#wp-submit').click()
        await page.wait_for_url('**/wp-admin/**')
        await page.goto(BASE + '/wp-admin/post.php?post=' + str(FIXTURES['pages']['home']) + '&action=edit', wait_until='networkidle')
        await page.screenshot(path=str(TEMP / 'editor.png'), full_page=True)
        await page.wait_for_function('window.wp && wp.blocks && wp.blocks.getBlockTypes().length > 10')
        invalid = await page.evaluate('''patterns => {
            const bad = [];
            function inspect(block, name) { if (block.isValid === false) bad.push({pattern:name,block:block.name}); (block.innerBlocks || []).forEach(child=>inspect(child,name)); }
            patterns.forEach(pattern => wp.blocks.parse(pattern.content).forEach(block => inspect(block,pattern.name)));
            return bad;
        }''', FIXTURES['patterns'])
        assert not invalid, invalid
        print('PASS: every Evpower pattern passes the actual WordPress block editor validation')
        close = page.get_by_role('dialog').get_by_role('button', name='Close', exact=True)
        if await close.count():
            await close.click()
        original = await page.evaluate('id => wp.apiFetch({path:"/wp/v2/pages/" + id + "?context=edit"})', FIXTURES['pages']['home'])
        try:
            canvas = page.frame_locator('iframe[name="editor-canvas"]')
            heading = canvas.locator('h1[data-type="core/heading"][contenteditable=true]').first
            await heading.fill('Your WordPress edits are live.')
            await page.wait_for_function('wp.data.select("core/editor").isEditedPostDirty()')
            await page.get_by_role('button', name='Save', exact=True).first.click()
            await page.wait_for_function('!wp.data.select("core/editor").isSavingPost() && !wp.data.select("core/editor").isEditedPostDirty()')
            visitor = await browser.new_page()
            await visitor.goto(BASE + '/', wait_until='networkidle')
            await expect(visitor.locator('main h1')).to_have_text('Your WordPress edits are live.')
            await visitor.close()
            await page.screenshot(path=str(TEMP / 'editor.png'), full_page=True)
            print('PASS: editing and saving a real heading in the native WordPress editor updates the public page')
        finally:
            await page.evaluate('data => wp.apiFetch({path:"/wp/v2/pages/" + data.id,method:"POST",data:{content:data.content,title:data.title}})', {'id': FIXTURES['pages']['home'], 'content':original['content']['raw'], 'title':original['title']['raw']})
        await page.goto(BASE + '/wp-admin/site-editor.php', wait_until='domcontentloaded')
        await page.wait_for_function('window.wp && wp.data')
        await expect(page.locator('body')).to_contain_text('Styles')
        print('PASS: WordPress Site Editor exposes global styles and templates for the block theme')
        assert not errors, errors
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
